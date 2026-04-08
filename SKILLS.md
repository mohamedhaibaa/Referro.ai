# SKILLS.md — Referoo.ai Code Patterns

> **Follow these patterns exactly.** Every code example here is derived from working code in the repo. When implementing new features, copy the pattern and adapt — don't invent new approaches.

---

## Skill 1: Backend API Endpoint

**Reference file:** `backend/app/api/v1/jobs.py` (the most complete example)

### Pattern: GET list endpoint
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.db.models.user import User
from app.db.models.job import Job  # or whatever model

router = APIRouter()

@router.get("")
def list_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = (
        db.query(Model)
        .filter(
            Model.user_id == current_user.id,
            # ALWAYS include ownership filter
        )
        .order_by(Model.created_at.desc())
        .all()
    )
    return {
        "data": [_to_dict(item) for item in items],
        "meta": {"total": len(items)},
        "error": None,
    }
```

### Pattern: GET single item
```python
@router.get("/{item_id}")
def get_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(Model)
        .filter(
            Model.id == item_id,
            Model.user_id == current_user.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return {"data": _to_dict(item), "error": None}
```

### Pattern: POST with async job trigger
```python
@router.post("", status_code=202)
def create_with_workflow(
    body: CreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Create the main record
    item = Model(user_id=current_user.id, **body.dict())
    db.add(item)
    db.flush()  # Get item.id before commit

    # 2. Create WorkflowRun
    run = WorkflowRun(
        user_id=current_user.id,
        job_id=item.id,  # or None for standalone
        type="your-workflow-type",
        status="queued",
    )
    db.add(run)
    db.flush()

    # 3. Publish to Service Bus
    publish_to_queue("queue-name", {
        "workflow_run_id": str(run.id),
        "user_id": str(current_user.id),
        "job_id": str(item.id),
        # ... other data worker needs
    })

    # 4. Commit after publish succeeds
    db.commit()

    return {
        "data": {
            "id": str(item.id),
            "workflowRunId": str(run.id),
        },
        "error": None,
    }
```

### Pattern: PATCH update
```python
@router.patch("/{item_id}")
def update_item(
    item_id: str,
    body: UpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(Model)
        .filter(Model.id == item_id, Model.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    update_data = body.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return {"data": _to_dict(item), "error": None}
```

### Pattern: DELETE (soft delete)
```python
@router.delete("/{item_id}", status_code=204)
def delete_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(Model)
        .filter(
            Model.id == item_id,
            Model.user_id == current_user.id,
            Model.is_deleted == False,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.is_deleted = True
    db.commit()
```

### Pattern: Response serializer helper
```python
def _to_dict(item: Model) -> dict:
    return {
        "id": str(item.id),
        "userId": str(item.user_id),          # camelCase in responses
        "name": item.name,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
    }
```

**Critical:** Response JSON fields are **camelCase**. Database columns are **snake_case**. The `_to_dict` helper bridges this.

### Pattern: Pydantic request model
```python
from pydantic import BaseModel
from typing import Optional

class CreateRequest(BaseModel):
    url: str
    title: str = ""
    company: str = ""

class UpdateRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    fit_score: Optional[str] = None
```

### Pattern: Router registration
In `backend/app/api/v1/router.py`:
```python
from app.api.v1.your_feature import router as your_feature_router

router.include_router(your_feature_router, prefix="/your-feature", tags=["your-feature"])
```

---

## Skill 2: Database Model

**Reference file:** `backend/app/db/models/job.py`

### Pattern: SQLAlchemy model
```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

def utcnow():
    return datetime.now(timezone.utc)

class YourModel(Base):
    __tablename__ = "your_models"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("your_models_user_id_idx", "user_id"),
        Index("your_models_job_id_idx", "job_id"),
    )
```

**Rules:**
- Always UUID primary keys with `default=uuid.uuid4`
- Always include `user_id` FK for ownership/RLS
- Always include `created_at` with `default=utcnow`
- Table names are **plural snake_case**
- Index names follow `{table}_{columns}_idx`

---

## Skill 3: Worker Consumer

**Reference file:** `worker/app/consumers/job_parsing.py` (the only working example)

### Pattern: Service Bus consumer
```python
import json
import logging
from azure.servicebus.aio import ServiceBusClient
from app.core.config import settings
from app.integrations.ai_foundry import AIFoundryClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

QUEUE_NAME = "your-queue-name"  # kebab-case, must match publisher

_engine = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
_Session = sessionmaker(bind=_engine)

async def listen():
    """Listen on the '{QUEUE_NAME}' queue and process messages."""
    async with ServiceBusClient.from_connection_string(
        settings.SERVICE_BUS_CONNECTION_STRING
    ) as client:
        async with client.get_queue_receiver(QUEUE_NAME) as receiver:
            async for message in receiver:
                try:
                    payload = json.loads(str(message))
                    await _process(payload)
                    await message.complete()
                except Exception as e:
                    logger.error(f"Failed to process message: {e}")
                    await _handle_failure(payload, str(e))
                    await message.complete()


async def _process(payload: dict):
    """Process a single queue message."""
    db = _Session()
    try:
        workflow_run_id = payload["workflow_run_id"]
        job_id = payload["job_id"]
        user_id = payload["user_id"]

        # 1. Mark workflow as running
        run = db.query(WorkflowRun).filter(WorkflowRun.id == workflow_run_id).first()
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        db.commit()

        # 2. Do the actual work (AI call, scraping, etc.)
        ai = AIFoundryClient()
        result = await ai.chat_completion(
            system_prompt="Your system prompt here",
            user_message="Your user message here",
        )

        # 3. Parse AI response and write to DB
        parsed = json.loads(result)
        # ... create/update records ...

        # 4. Mark workflow as completed
        run.status = "completed"
        run.output_data = parsed
        run.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        # 5. Mark workflow as failed
        run = db.query(WorkflowRun).filter(
            WorkflowRun.id == payload.get("workflow_run_id")
        ).first()
        if run:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
        raise
    finally:
        db.close()
```

**Rules:**
- Queue names are **kebab-case** and case-sensitive
- Always update WorkflowRun status: queued → running → completed/failed
- Always close DB session in `finally`
- Worker uses its own engine with `AUTOCOMMIT` isolation
- Worker functions are **async** — never block the event loop

---

## Skill 4: AI Foundry Prompt

**Reference file:** `worker/app/prompts/job_parsing.py`

### Pattern: System prompt for structured output
```python
SYSTEM_PROMPT = """You are an AI assistant that analyzes job postings.

Given the text content of a job posting page, extract the following information and return it as a JSON object:

{
  "title": "exact job title",
  "company": "company name",
  "work_mode": "Remote" | "Hybrid" | "On-site",
  "role_family": "PM" | "SWE" | "DS" | "Design" | "Other",
  "description": "brief 2-3 sentence summary"
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- If a field cannot be determined, use null
- work_mode must be exactly one of: Remote, Hybrid, On-site
- role_family must be exactly one of: PM, SWE, DS, Design, Other
"""
```

**Rules:**
- Always request JSON-only output
- Define exact field names and allowed values
- Include "return ONLY valid JSON" instruction
- Store prompts in `worker/app/prompts/` as Python constants

---

## Skill 5: Frontend API Hook

**Reference file:** `frontend/src/hooks/useJobs.ts`

### Pattern: React Query hook (list)
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

interface Item {
  id: string;
  name: string;
  createdAt: string;
}

interface ListResponse {
  data: Item[];
  meta: { total: number };
  error: string | null;
}

export function useItems() {
  return useQuery<ListResponse>({
    queryKey: ["items"],
    queryFn: () => api.get<ListResponse>("/items"),
  });
}
```

### Pattern: React Query hook (mutation)
```typescript
export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api.post<{ data: Item }>("/items", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string }) =>
      api.patch<{ data: Item }>(`/items/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
```

### Pattern: Workflow polling hook
```typescript
import { useQuery } from "@tanstack/react-query";
import { getWorkflowRun } from "@/lib/api/workflowRuns";

export function useWorkflowRun(workflowRunId: string | null) {
  return useQuery({
    queryKey: ["workflow-run", workflowRunId],
    queryFn: () => getWorkflowRun(workflowRunId!),
    enabled: !!workflowRunId,
    refetchInterval: (data) => {
      const status = data?.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 2000; // poll every 2 seconds
    },
  });
}
```

**Rules:**
- Always invalidate queries `onSuccess` of mutations
- Use `queryKey` arrays that are specific and hierarchical
- Use `enabled` to conditionally run queries
- Stop polling when workflow reaches terminal status

---

## Skill 6: Frontend API Client

**Reference file:** `frontend/src/lib/api/client.ts`

### Pattern: API call function
```typescript
import { api } from "./client";

export async function listItems(): Promise<ListResponse> {
  return api.get<ListResponse>("/items");
}

export async function createItem(body: CreateBody): Promise<CreateResponse> {
  return api.post<CreateResponse>("/items", body);
}

export async function getItem(id: string): Promise<ItemResponse> {
  return api.get<ItemResponse>(`/items/${id}`);
}
```

The `api` client auto-injects `Authorization: Bearer {token}` from localStorage. Always use `api.get/post/patch/delete` — never raw `fetch`.

---

## Skill 7: Frontend Component

**Reference file:** `frontend/src/components/job-detail/ContactDiscovery.tsx`

### Pattern: Feature component with API integration
```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useItems, useCreateItem } from "@/hooks/useItems";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
}

const FeaturePanel = ({ jobId }: Props) => {
  const { data, isLoading } = useItems(jobId);
  const createMutation = useCreateItem();

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({ jobId });
      toast.success("Created successfully");
    } catch (error) {
      toast.error("Failed to create");
    }
  };

  if (isLoading) {
    return <Loader2 className="animate-spin" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Name</CardTitle>
      </CardHeader>
      <CardContent>
        {data?.data?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No items yet</p>
            <Button onClick={handleCreate} className="mt-4">
              Generate
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.data?.map((item) => (
              <div key={item.id} className="p-3 border rounded-lg">
                {item.name}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeaturePanel;
```

**Rules:**
- Always type props with an interface
- Use shadcn/ui components (`Card`, `Button`, `Dialog`, etc.)
- Use Tailwind for all styling — no inline styles, no CSS modules
- Use `sonner` toast for user feedback
- Use `lucide-react` for icons
- Handle loading, empty, and error states
- Default export for components

---

## Skill 8: Queue Publishing (Backend)

**Reference file:** `backend/app/services/queue.py`

### Pattern: Publishing to Service Bus
```python
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from app.core.config import settings
import json

def _publish(queue_name: str, payload: dict):
    """Publish a message to an Azure Service Bus queue."""
    with ServiceBusClient.from_connection_string(
        settings.SERVICE_BUS_CONNECTION_STRING
    ) as client:
        with client.get_queue_sender(queue_name) as sender:
            message = ServiceBusMessage(json.dumps(payload))
            sender.send_messages(message)


def publish_job_parsing(workflow_run_id: str, user_id: str, job_id: str, url: str):
    _publish("job-parsing", {
        "workflow_run_id": workflow_run_id,
        "user_id": user_id,
        "job_id": job_id,
        "url": url,
    })
```

Always create a named `publish_*` function wrapping `_publish`. Message payloads always include `workflow_run_id`, `user_id`, and `job_id`.

---

## Skill 9: Alembic Migration

### Pattern: Generate and apply
```bash
# After modifying a model in backend/app/db/models/
cd backend
alembic revision --autogenerate -m "add_your_table"
alembic upgrade head
```

**Never edit existing migration files.** Always create new ones. Check the generated migration before applying — autogenerate sometimes misses things or creates incorrect operations.

---

## Skill 10: Type Definitions (Frontend)

**Reference file:** `frontend/src/types/job.ts`

### Pattern: Type file with enum unions
```typescript
export type ItemStatus = "Active" | "Archived" | "Deleted";
export type Priority = "High" | "Medium" | "Low";

export interface Item {
  id: string;
  userId: string;
  name: string;
  status: ItemStatus;
  priority: Priority | null;
  createdAt: string;
  updatedAt: string;
}

// Helper function exported alongside types
export function getStatusLabel(status: ItemStatus): string {
  const labels: Record<ItemStatus, string> = {
    Active: "Active",
    Archived: "Archived",
    Deleted: "Deleted",
  };
  return labels[status] ?? status;
}
```

**Rules:**
- Use union string types instead of TypeScript enums
- Co-locate helper functions with their types
- All date fields are `string` (ISO 8601 from API)
- Nullable fields use `| null`
