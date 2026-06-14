# GitHub PR Workflow Guide — Qanunora

## Branch Convention

```
phase-NN-description       # Feature branches (e.g. phase-05-legislative-item-management)
fix/short-description      # Bug fixes
hotfix/critical-issue      # Production hotfixes
```

## Development Workflow

```bash
# 1. Start from up-to-date main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b phase-05-legislative-item-management

# 3. Make atomic commits
git add apps/backend/src/modules/legislative/
git commit -m "Add legislative item API with CRUD endpoints"

git add apps/frontend/src/app/(dashboard)/legislative-items/
git commit -m "Add legislative item list and detail frontend pages"

# 4. Push branch
git push -u origin phase-05-legislative-item-management

# 5. Create PR
gh pr create --title "Phase 05 — Legislative Item Management" --body "..."

# 6. After review and CI pass — merge
gh pr merge <number> --merge --delete-branch

# 7. Update local main
git checkout main
git pull origin main
```

## Commit Message Convention

```
<type>: <short summary>

Types: Add, Update, Fix, Remove, Refactor, Test, Docs
```

Examples:
```
Add legislative item API with CRUD endpoints
Add item status and type filters with search pagination
Fix JWT refresh token rotation on concurrent requests
Update committee review to include recommendation field
Add legislative service unit tests
```

## PR Description Template

```markdown
## Summary
- Bullet points of what was built
- Key design decisions

## Test plan
- [ ] Specific thing to verify manually
- [ ] API endpoint returns correct response
- [ ] Frontend page renders without errors
- [ ] Unit tests pass
```

## CI Checks

Every PR should pass:
- [ ] TypeScript compilation (`npm run typecheck`)
- [ ] ESLint (`npm run lint`)
- [ ] Unit tests (`npm test`)
- [ ] No new security vulnerabilities (`npm audit`)

## Merge Strategy

Use **squash-merge** for individual fixes, **merge-commit** for phase branches (to preserve atomic commit history).
