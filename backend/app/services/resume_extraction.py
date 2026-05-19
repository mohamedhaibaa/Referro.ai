"""REF-33a: extract plain text from PDF/DOCX resumes.

Defensive — returns "" on any extraction failure. The downstream
parse_resume handles empty input via its fallback path
(all-empty fields + parse_failed=True), so the upload still
succeeds and the user can manually fill fields via PATCH.

Does NOT raise. Logs the failure and returns "".

REF-33b Bug B fix: also returns an error_info dict on exception
so the caller can persist it (e.g. to parse_raw_response) for
offline observability. Live logs aren't always available (Mohamed
hit a transient python-docx flake at 2026-05-19 01:45:58 UTC and
no log was captured); making the failure queryable in the DB
closes that observability gap if the bug recurs.
"""
import logging
from io import BytesIO
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text(filename: str, content: bytes) -> tuple[str, Optional[dict]]:
    """Route by extension; extract plain text from PDF or DOCX bytes.

    Returns:
        (text, error_info)
        - text: extracted plain text, or "" on failure / unsupported.
        - error_info: None on success / unsupported extension.
          On exception: {"type": str, "message": str, "extension": str}
          so the caller can persist it to the user_profiles row for
          later debugging.

    Complex layouts (multi-column, tables, image-only PDFs) often
    produce messy text. By design we pass even messy text through
    to the AI — gpt-4o-mini handles imperfect input. Don't
    over-engineer extraction.
    """
    ext = Path(filename).suffix.lower()
    try:
        if ext == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content))
            text = "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()
            return text, None
        elif ext == ".docx":
            from docx import Document

            doc = Document(BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs).strip()
            return text, None
        else:
            logger.warning("extract_text: unsupported extension %r for %r", ext, filename)
            # Not an "error" — the upload validation should have caught
            # this. error_info=None signals "no exception, just nothing
            # to extract."
            return "", None
    except Exception as exc:
        logger.exception("extract_text failed for filename=%r", filename)
        return "", {
            "type": type(exc).__name__,
            "message": str(exc)[:500],
            "extension": ext,
        }
