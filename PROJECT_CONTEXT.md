# Kreativ Platform

## Overview
Kreativ is a creative studio (Studio Criativo) and platform for intelligent agents designed to empower businesses with personalized and automated solutions.
Official Website/Instagram: [we_are_kreativ](https://www.instagram.com/we_are_kreativ/)

## Brand Guidelines
- **Palette**: Minimalist High-Contrast.
    - **Primary**: Black (#000000) and White (#FFFFFF).
    - **Secondary**: Neutral Greys for secondary text and dividers.
    - **Highlight**: Sky Blue (#B9E5FB) for subtle accents and interactive elements.
- **Tone**: Professional, boutique, innovative, and clean.

## UI Adaptive Rules
- **Color Scheme**: Always respect `prefers-color-scheme`.
- **Adaptive Contrast**:
    - **Light Mode**: Use high-contrast dark text on light backgrounds and white text on dark buttons (--brand-color: #007AFF).
    - **Dark Mode**: Use light text on dark backgrounds and dark text (#000000) on light-colored buttons/highlights (--brand-color: #B9E5FB).
- **Adaptive Logos**: Use CSS filters (`filter: invert(1)` or `filter: brightness(0) invert(1)`) for monochrome logos to ensure visibility across themes.

## Architecture
- **Backend:** Node.js + Express
- **Database:** SQLite3
- **Automation Focus:** Primary agent focus is currently the **RB Podcast**.
- **User Management Maintenance:** When creating new future agents, you must update the `availableAgents` dictionary inside `/public/admin-users.html` to ensure the new agents can be managed and assigned to users via the Admin dashboard.
