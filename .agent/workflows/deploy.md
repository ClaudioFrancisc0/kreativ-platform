---
description: How to push changes and deploy to production
---

# Deploy Workflow

The Kreativ Platform operates on a 100% Cloud-Tested Workflow. Local execution/testing is forbidden. All deployments and tests occur through Railway.

## 1. Daily Development (Auto-Run)
All routine work MUST happen on the `develop` branch. Because local testing is disabled, when finishing code changes, you MUST automatically commit and push to `develop` to trigger the Railway staging environment for testing.
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
