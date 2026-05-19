"""User context block for Ref AI calls.

REF-32 promotion + REF-33a wiring.

UserContext dataclass holds both v1 (name/email — populated from
User row) and v2 (resume-derived: skills, experience_*, education,
job_titles_history, target_*, raw_resume_text) fields.

REF-33a wires the v2 fields up: build_user_context(user, db)
JOINs the new user_profiles table and populates v2 when a profile
exists. Users without a profile row keep is_thin()=True; the
prompt's §3 thin-context branch handles that case identically to
REF-32 behavior.

The zero-arg build_user_context_block() shim is kept as backward-
compat insurance. REF-33a swapped all known callers
(generate_initial_draft, revise_draft) to the new path; the shim
remains only as a defensive landing for anything missed by grep.
"""

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.db.models.user import User


@dataclass
class UserContext:
    """REF-32 (DD-1): foundation for Ref's view of the user.

    v1 fields (REF-32) populate from the User row.
    v2 fields (REF-33) populate from a future user_profiles table
    derived from resume parsing + onboarding answers; they default
    to empty here. The prompt's §3 has explicit conditional rules
    for thin (v1-only) vs rich (v1+v2) contexts.

    is_thin() lets renderers decide between the two paths without
    duplicating the emptiness check.
    """

    # v1 (REF-32) — derivable from User row today
    full_name: str
    first_name: str
    email: str

    # v2 (REF-33) — empty defaults; populated when resume parsing ships
    skills: list[str] = field(default_factory=list)
    experience_years: int | None = None
    experience_summary: str = ""              # 1-2 sentence summary
    education: str = ""                       # "MS Computer Science, NYU"
    job_titles_history: list[str] = field(default_factory=list)
    target_roles: list[str] = field(default_factory=list)
    target_companies: list[str] = field(default_factory=list)
    raw_resume_text: str | None = None

    def is_thin(self) -> bool:
        """True if no REF-33 enrichment has happened yet."""
        return not (
            self.skills
            or self.experience_summary
            or self.experience_years
            or self.education
            or self.job_titles_history
            or self.target_roles
            or self.raw_resume_text
        )


def build_user_context(user: User, db: Session) -> UserContext:
    """REF-33a: JOIN user_profiles to populate v2 fields when a
    profile exists.

    Backward compat: if no UserProfile row → v2 fields stay
    defaulted → UserContext.is_thin() returns True → the prompt's
    §3 thin-context branch handles. Identical thin behavior to
    pre-REF-33a.

    Local import for UserProfile avoids a top-level circular
    (user_context is imported by ref_ai which is imported by
    routes that also import the User model).
    """
    from app.db.models.user import UserProfile

    name = user.name or ""
    first = name.split(" ")[0] if name else ""
    email = user.email or ""

    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile is None:
        return UserContext(full_name=name, first_name=first, email=email)

    return UserContext(
        full_name=name, first_name=first, email=email,
        skills=profile.skills or [],
        experience_years=profile.experience_years,
        experience_summary=profile.experience_summary or "",
        education=profile.education or "",
        job_titles_history=profile.job_titles_history or [],
        target_roles=profile.target_roles or [],
        target_companies=profile.target_companies or [],
        raw_resume_text=profile.raw_resume_text,
    )


def render_user_context_block(ctx: UserContext) -> str:
    """REF-32: render UserContext as a prompt-injectable block.

    Thin contexts emit a short block + the explicit "keep claims
    general" marker the prompt's §3 looks for. Rich contexts emit
    each populated field as a bullet line.
    """
    lines = [f"- Name: {ctx.full_name or 'Unknown'}"]
    if ctx.experience_summary:
        lines.append(f"- Summary: {ctx.experience_summary}")
    if ctx.skills:
        lines.append(f"- Skills: {', '.join(ctx.skills[:10])}")
    if ctx.experience_years is not None:
        lines.append(f"- Experience: {ctx.experience_years} years")
    if ctx.education:
        lines.append(f"- Education: {ctx.education}")
    if ctx.job_titles_history:
        lines.append(f"- Past titles: {', '.join(ctx.job_titles_history[:5])}")
    if ctx.target_roles:
        lines.append(f"- Looking for: {', '.join(ctx.target_roles)}")
    if ctx.target_companies:
        lines.append(f"- Target companies: {', '.join(ctx.target_companies)}")
    if ctx.is_thin():
        lines.append("- (Resume not yet provided — keep claims general.)")
    return "\n".join(lines)


def build_user_context_block() -> None:
    """DEPRECATED REF-32-era shim. REF-33a swapped all known callers
    (generate_initial_draft, revise_draft) to
    render_user_context_block(build_user_context(user, db)).

    Kept as backward-compat insurance for anything grep missed at
    REF-33a time. Remove in a future cleanup ticket once we're
    certain no caller remains.
    """
    return None
