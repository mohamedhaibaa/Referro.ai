import logging
import re

import httpx
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from app.core.config import settings

logger = logging.getLogger(__name__)

_STRIP_TAGS = ["script", "style", "nav", "footer", "header"]
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


def _clean(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(_STRIP_TAGS):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)[:8000]


def extract_company_linkedin_url(html: str) -> str | None:
    """Extract the primary company LinkedIn URL from a job page's raw HTML.

    LinkedIn embeds the company slug in multiple <a> hrefs near the top of the
    page (logo, org-name links) before the similar-jobs section. We take the
    first match and strip tracking params.
    """
    matches = re.findall(r'linkedin\.com/company/([^/?"\s]+)', html)
    if matches:
        slug = matches[0].split("?")[0].rstrip("/")
        return f"https://www.linkedin.com/company/{slug}/"
    return None


def extract_domain(url: str) -> str:
    """Return the root domain from any URL, stripping subdomains like 'jobs.'"""
    match = re.search(r"https?://(?:www\.|jobs\.|careers\.)?([^/]+)", url)
    return match.group(1).lower() if match else ""


async def find_linkedin_url_from_homepage(domain: str) -> str | None:
    """Fetch the company homepage and look for a LinkedIn company link in the HTML.

    Most companies list their LinkedIn page as a social icon in the footer.
    Returns the LinkedIn company URL if found, None otherwise.
    """
    for scheme_domain in [f"https://{domain}", f"https://www.{domain}"]:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as c:
                r = await c.get(scheme_domain, headers={"User-Agent": _USER_AGENT})
                r.raise_for_status()
            matches = re.findall(r'linkedin\.com/company/([^/?"\s<>]+)', r.text)
            if matches:
                slug = matches[0].split("?")[0].rstrip("/")
                url = f"https://www.linkedin.com/company/{slug}/"
                logger.info("Footer scrape found LinkedIn URL for %s: %s", domain, url)
                return url
        except Exception as exc:
            logger.debug("Footer scrape failed for %s: %s", scheme_domain, exc)
    return None


def is_valid_scrape(text: str) -> bool:
    if len(text) < 500:
        return False
    failure_signals = [
        "enable javascript",
        "please enable",
        "sign in to view",
        "log in to continue",
        "access denied",
        "403 forbidden",
        "loading...",
        "linkedin.com/jobs/collections",
        "linkedin.com/uas/login",
    ]
    if any(signal in text.lower() for signal in failure_signals):
        return False
    return True


async def _tier1_httpx(url: str) -> tuple[str, str | None]:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as c:
        r = await c.get(url, headers={"User-Agent": _USER_AGENT})
        r.raise_for_status()
    return _clean(r.text), extract_company_linkedin_url(r.text)


async def _tier2_playwright(url: str) -> tuple[str, str | None]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            html = await page.content()
        finally:
            await browser.close()
    return _clean(html), extract_company_linkedin_url(html)


async def _tier3_scrapingdog(url: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as c:
        if "linkedin.com/jobs" in url:
            match = re.search(r"/jobs/view/(\d+)", url)
            if not match:
                raise ValueError(f"Could not extract LinkedIn job ID from URL: {url}")
            job_id = match.group(1)
            r = await c.get(
                "https://api.scrapingdog.com/jobs",
                params={"api_key": settings.SCRAPINGDOG_API_KEY, "job_id": job_id},
            )
            r.raise_for_status()
            return r.json().get("job_description", "")
        else:
            r = await c.get(
                "https://api.scrapingdog.com/scrape",
                params={
                    "api_key": settings.SCRAPINGDOG_API_KEY,
                    "url": url,
                    "dynamic": "true",
                },
            )
            r.raise_for_status()
            return _clean(r.text)


async def scrape(url: str) -> tuple[str, str | None]:
    """Return (page_text, company_linkedin_url).

    company_linkedin_url is only extracted for linkedin.com/jobs URLs — on
    those pages the first company link reliably belongs to the posting company.
    For all other job sites the HTML may contain unrelated LinkedIn links
    (footers, widgets), so we return None and let contact discovery fall back
    to slug guessing.
    """
    is_linkedin_job = "linkedin.com/jobs" in url

    try:
        text, company_url = await _tier1_httpx(url)
        if is_valid_scrape(text):
            logger.info("scraper: tier1 succeeded for %s", url)
            return text, (company_url if is_linkedin_job else None)
        logger.info("scraper: tier1 invalid, escalating to tier2 for %s", url)
    except Exception as exc:
        logger.warning("scraper: tier1 failed (%s), escalating to tier2", exc)

    try:
        text, company_url = await _tier2_playwright(url)
        if is_valid_scrape(text):
            logger.info("scraper: tier2 succeeded for %s", url)
            return text, (company_url if is_linkedin_job else None)
        logger.info("scraper: tier2 invalid, escalating to tier3 for %s", url)
    except Exception as exc:
        logger.warning("scraper: tier2 failed (%s), escalating to tier3", exc)

    logger.info("scraper: tier3 (scrapingdog) for %s", url)
    return await _tier3_scrapingdog(url), None
