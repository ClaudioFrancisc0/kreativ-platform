---
description: How to push changes and deploy to production
---

# Deploy Workflow

The Kreativ Platform follows a strict Git Branching strategy to protect the Railway production environment.

## 1. Daily Development (Auto-Run)
All routine work MUST happen on the `develop` branch. When finishing a task or testing, you should automatically commit and push to `develop`.
// turbo-all
```bash
git checkout develop
git add .
git commit -m "chore: auto-save development progress"
git push origin develop
```

## 2. Production Deployment (Requires User OK)
When the user EXPLICITLY asks to deploy to Production OR main branch, run the following:
```bash
git checkout main
git pull origin main
git merge develop -m "Merge develop into main for production deployment"
git push origin main
git checkout develop
```
