from fastapi import APIRouter

router = APIRouter()


@router.get("/{workflow_run_id}")
def get_workflow_run(workflow_run_id: str):
    # TODO: return workflow status — frontend polls this until completed/failed
    return {"data": None, "meta": {}, "error": None}
