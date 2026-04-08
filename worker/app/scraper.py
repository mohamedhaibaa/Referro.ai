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


async def _tier1_httpx(url: str) -> str:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as c:
        r = await c.get(url, headers={"User-Agent": _USER_AGENT})
        r.raise_for_status()
    return _clean(r.text)


async def _tier2_playwright(url: str) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            html = await page.content()
        finally:
            await browser.close()
    return _clean(html)


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


async def scrape(url: str) -> str:
    try:
        text = await _tier1_httpx(url)
        if is_valid_scrape(text):
            logger.info("scraper: tier1 succeeded for %s", url)
            return text
        logger.info("scraper: tier1 invalid, escalating to tier2 for %s", url)
    except Exception as exc:
        logger.warning("scraper: tier1 failed (%s), escalating to tier2", exc)

    try:
        text = await _tier2_playwright(url)
        if is_valid_scrape(text):
            logger.info("scraper: tier2 succeeded for %s", url)
            return text
        logger.info("scraper: tier2 invalid, escalating to tier3 for %s", url)
    except Exception as exc:
        logger.warning("scraper: tier2 failed (%s), escalating to tier3", exc)

    logger.info("scraper: tier3 (scrapingdog) for %s", url)
    return await _tier3_scrapingdog(url)
