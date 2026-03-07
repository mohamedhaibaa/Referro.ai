# Workflow Lifecycle

Every async AI job goes through this exact lifecycle.

## Statuses

| Status | Meaning |
|--------|---------|
| `queued` | API created the row, message published to queue, not yet picked up |
| `running` | Worker received the message and is processing |
| `completed` | Worker finished successfully, results written to DB |
| `failed` | Worker encountered an error, `error_message` is set |

## Rules

- API creates `workflow_runs` row with `status = 'queued'`
- API publishes message to the appropriate Service Bus queue
- API returns `workflow_run_id` to the frontend
- Frontend polls `GET /workflow-runs/{id}` every 2 seconds
- Worker moves status to `running` when consumption starts
- Worker moves status to `completed` when results are written successfully
- Worker moves status to `failed` on any unhandled exception
- Worker always writes `error_message` on failure
- Frontend stops polling on `completed` or `failed`

## Flow diagram

```
Frontend          API                  Service Bus         Worker
   |               |                       |                  |
   | POST /jobs    |                       |                  |
   |-------------->|                       |                  |
   |               | INSERT workflow_runs  |                  |
   |               | status='queued'       |                  |
   |               |                       |                  |
   |               | PUBLISH message       |                  |
   |               |---------------------->|                  |
   |               |                       |                  |
   | 202 + run_id  |                       | RECEIVE message  |
   |<--------------|                       |----------------->|
   |               |                       |                  |
   | poll GET /workflow-runs/{id}          | UPDATE status    |
   |-------------->|                       | ='running'       |
   | { status: 'queued' }                  |                  |
   |<--------------|                       |                  |
   |               |                       | call AI Foundry  |
   | poll again    |                       | write results    |
   |-------------->|                       | UPDATE status    |
   | { status: 'running' }                 | ='completed'     |
   |<--------------|                       |                  |
   |               |                       |                  |
   | poll again    |                       |                  |
   |-------------->|                       |                  |
   | { status: 'completed' }               |                  |
   |<--------------|                       |                  |
   | STOP POLLING                          |                  |
   | load results                          |                  |
```
