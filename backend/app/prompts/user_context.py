"""User context block for Ref AI calls.

REF-32 promotion (was a 21-line stub): exports a UserContext
dataclass + builder + renderer. v1 fields populate from the User
row today; v2 fields (resume-derived) default empty and will be
populated when REF-33 ships the resume parser + user_profiles
table.

The old zero-arg `build_user_context_block()` shim is preserved so
generate_initial_draft / revise_draft keep their current behavior
(emit the "Not provided yet" placeholder via ref_context.py's
fallback path). REF-33 will swap those callers to the new
build_user_context(user) path.
"""

from dataclasses import dataclass, field

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


def build_user_context(user: User) -> UserContext:
    """REF-32 (DD-1): build UserContext from a User row.

    v1: only name + email populate; v2 fields stay defaulted.
    REF-33 will extend the signature to accept the db session and
    JOIN a user_profiles row, keeping callers unchanged.
    """
    name = user.name or ""
    first = name.split(" ")[0] if name else ""
    return UserContext(
        full_name=name,
        first_name=first,
        email=user.email or "",
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
    """Backward-compat shim for generate_initial_draft / revise_draft.

    Returns None so ref_context.py falls back to the "Not provided
    yet" placeholder for the existing callers. REF-33 will replace
    these callers with build_user_context(user) +
    render_user_context_block(ctx).

    Kept to avoid behavior changes in generate_initial_draft /
    revise_draft as part of REF-32.
    """
    return None
