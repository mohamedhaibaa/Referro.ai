from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.job import WorkflowRun
from app.db.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/{workflow_run_id}")
def get_workflow_run(
    workflow_run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.query(WorkflowRun).filter(
        WorkflowRun.id == workflow_run_id,
        WorkflowRun.user_id == current_user.id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")

    return {
        "data": {
            "id": str(run.id),
            "type": run.type,
            "status": run.status,
            "jobId": str(run.job_id) if run.job_id else None,
            "outputData": run.output_data,
            "errorMessage": run.error_message,
            "createdAt": run.created_at.isoformat(),
            "startedAt": run.started_at.isoformat() if run.started_at else None,
            "completedAt": run.completed_at.isoformat() if run.completed_at else None,
        },
        "error": None,
    }
