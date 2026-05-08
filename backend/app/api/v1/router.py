from fastapi import APIRouter
from app.api.v1 import auth, jobs, contacts, outreach, follow_up, flash_cards, pitch_deck, attachments, dashboard, inbox, notes, activity, workflow_runs, credits, ref_chat

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
router.include_router(contacts.router, prefix="/jobs", tags=["contacts"])
router.include_router(outreach.router, prefix="/jobs", tags=["outreach"])
router.include_router(follow_up.router, prefix="/jobs", tags=["follow-up"])
router.include_router(flash_cards.router, prefix="/jobs", tags=["flash-cards"])
router.include_router(pitch_deck.router, prefix="/jobs", tags=["pitch-deck"])
router.include_router(attachments.router, prefix="/attachments", tags=["attachments"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(inbox.router, prefix="/inbox", tags=["inbox"])
router.include_router(notes.router, prefix="/jobs", tags=["notes"])
router.include_router(activity.router, prefix="/jobs", tags=["activity"])
router.include_router(workflow_runs.router, prefix="/workflow-runs", tags=["workflow-runs"])
router.include_router(credits.router, prefix="/credits", tags=["credits"])
router.include_router(ref_chat.router, prefix="/jobs", tags=["ref-chat"])
