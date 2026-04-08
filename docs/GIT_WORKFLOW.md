# Git Workflow

## Branch model

| Branch | Purpose |
|--------|---------|
| `main` | Production only. Never push directly. |
| `develop` | Integration branch. All PRs merge here first. |
| `feat/REF-XX-description` | Feature work |
| `chore/REF-XX-description` | Infrastructure, config, CI |
| `fix/REF-XX-description` | Bug fixes |

## PR rules

- No direct push to `main` or `develop`
- Every PR needs 1 approval before merge
- PRs stay small — max 400 lines, one logical change
- Review within 4 hours
- Squash and merge for features, regular merge for hotfixes
- Pull `develop` into your branch daily to avoid drift
- If a contract (API, DB schema, queue payload) changes in your PR, update the relevant `docs/` file in the same PR

## Commit format

```
feat: add job creation endpoint
fix: correct workflow_runs status update
chore: provision Azure Service Bus queues
refactor: extract queue publish helper
```

## Daily routine

```bash
git checkout develop
git pull origin develop
git checkout feat/REF-XX-your-feature
git merge develop
# work...
git push origin feat/REF-XX-your-feature
# open PR into develop
```

## REF ticket reference

See `docs/EXECUTION_PLAN.md` for the full list of REF numbers and branch assignments.
