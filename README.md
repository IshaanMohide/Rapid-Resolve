# Rapid Resolve — Supernova 2.0 🚀

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Engine](https://img.shields.io/badge/AI%20Engine-Google%20Gemini%20Flash-orange.svg)](https://ai.google.dev/)
[![Version](https://img.shields.io/badge/Release-Supernova%202.0-cyan.svg)]()

> **Enterprise AI Triage & Civic Emergency Dispatch Platform**  
> Unified full-stack application delivering instant incident classification, deterministic SLA timers, real-time emergency dispatch with SMS bypass, and interactive geospatial mapping.

---

## 🌟 Key Highlights

- ⚡ **Google Gemini AI Triage**: Intelligently analyzes citizen descriptions in real time, assigning urgency and SLA timers.
- 🏛️ **12 Specialized Municipal Divisions**:
  1. Disaster Management & Flood Control (Enforces `<30m SLA` Critical Escalation)
  2. Fire & Rescue Services
  3. Emergency Medical & Ambulance
  4. Water Supply & Sewerage Board
  5. Electricity & Power Distribution
  6. Roads, Bridges & Infrastructure
  7. Traffic Police & Road Safety
  8. Public Health, Sanitation & Waste
  9. Pollution Control & Environment
  10. Parks, Trees & Horticulture
  11. Town Planning & Building Safety
  12. Stray Animal & Veterinary Control
- 🌊 **Critical Flood Protocol**: Incidents mentioning floods or inundations are instantly escalated to `CRITICAL` urgency with automated emergency dispatch.
- 🔍 **Real-Time Citizen Complaint Tracking**: Search complaints by Ticket ID, monitor deterministic SLA countdowns, and inspect interactive 4-stage lifecycle resolution progress.
- 📍 **Interactive Geospatial Map**: Leaflet map integration with draggable pin, Nominatim reverse geocoding, and GPS auto-location.
- 🔒 **Admin Command Center**: Role-secured interface protected by `admin_credentials.json` with human-in-the-loop override capabilities.
- 🛡️ **Verified Resolution Retention**: Completed incidents preserve verifiable resolution timestamps and inspector notes for citizen transparency.
- 📱 **Automated SMS Dispatch**: Simulates or delivers live Twilio SMS notifications directly to first responders on critical events.

---

## 📁 Repository Structure

```
rapidresolve/
├── admin_credentials.json     # Admin ID and password clearance file
├── backend                    # Core API reference implementation
├── Dockerfile                 # Multi-stage production container build
├── frontend                   # Standalone frontend view reference
├── index.html                 # Main HTML entry with Google Fonts & Leaflet
├── package.json               # Full-stack dependencies & build scripts
├── postcss.config.js          # PostCSS configuration
├── render.yaml                # 1-Click Render.com deployment blueprint
├── server.js                  # Unified Express server & static asset host
├── src/
│   ├── App.jsx                # Main React UI (Citizen Desk, Tracker & Admin Center)
│   ├── ComplaintTracker.jsx   # Citizen complaint tracker with lifecycle stepper & SLA timer
│   ├── EmergencyMap.jsx       # Geospatial incident map view
│   ├── ErrorBoundary.jsx      # React error boundary component
│   ├── LocationPickerModal.jsx# Interactive map modal with pin drop & GPS
│   ├── SLAChart.jsx           # Departmental incident SLA chart
│   ├── index.css              # Custom styling & Tailwind directives
│   └── main.jsx               # React entry point
├── tailwind.config.js         # Tailwind CSS styling tokens
└── vite.config.js             # Vite build bundler configuration
```

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### 2. Clone & Install
```bash
git clone https://github.com/IshaanMohide/rapid-resolve.git
cd rapid-resolve
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Build & Launch Unified Server
```bash
# Build the production React frontend
npm run build

# Start the unified server (serves both API & Frontend on port 5000)
npm run start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🌐 Deploy to Live Website

### 1. Deploy on Render.com (Recommended & Free)
1. Fork or push this repository to GitHub.
2. Log into [dashboard.render.com](https://dashboard.render.com/) and choose **New +** ➔ **Web Service**.
3. Select your repository `IshaanMohide/rapid-resolve`.
4. Set:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server.js`
5. Under **Environment Variables**, add `GEMINI_API_KEY`.
6. Click **Deploy**. Render gives you a free HTTPS live domain (`https://rapid-resolve.onrender.com`).

### 2. Deploy on Railway.app
1. Go to [Railway.app](https://railway.app/) ➔ **New Project** ➔ **Deploy from GitHub**.
2. Select `IshaanMohide/rapid-resolve`.
3. Add `GEMINI_API_KEY` under **Variables**.
4. In **Settings** ➔ **Networking**, click **Generate Domain**.

---

## 🔐 Admin Credentials

Default credentials stored in [`admin_credentials.json`](admin_credentials.json):
- **Admin ID**: `admin`
- **Password**: `rapidresolve2026`

*You can update the ID, password, or department title anytime by directly editing `admin_credentials.json`.*

---

## 📄 License
This project is licensed under the MIT License.
