"""REF-33a: extract plain text from PDF/DOCX resumes.

Defensive — returns "" on any extraction failure. The downstream
parse_resume handles empty input via its fallback path
(all-empty fields + parse_failed=True), so the upload still
succeeds and the user can manually fill fields via PATCH.

Does NOT raise. Logs the failure and returns "".
"""
import logging
from io import BytesIO
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text(filename: str, content: bytes) -> str:
    """Route by extension; extract plain text from PDF or DOCX bytes.

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
            return "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()
        elif ext == ".docx":
            from docx import Document

            doc = Document(BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs).strip()
        else:
            logger.warning("extract_text: unsupported extension %r for %r", ext, filename)
            return ""
    except Exception:
        logger.exception("extract_text failed for filename=%r", filename)
        return ""
