# Kreativ Platform

## Overview
Kreativ is a platform for intelligent agents designed to empower businesses with personalized and automated solutions.

## Architecture
- **Backend:** Node.js + Express
- **Database:** SQLite3
- **Scraping/Automation:** Puppeteer
- **Persistence:** Local `data/` directory for configuration and `database/` for operational data.

## Core Reusable Components (Migrated from StudioMe)
- **Authentication:** JWT-based login and registration.
- **Middleware:** Security and request validation.
- **Services:** Modular service architecture for agent logic.

## Deployment
Deployed via **Railway** with a direct connection to the GitHub repository.
