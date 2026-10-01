# 🌱 Kisan Card Studio

> **AgriStack – Farmer Identity & Card Generation System**

A modern web application and backend API for generating, previewing, managing, and exporting official Kisan Cards (Agricultural Identity Cards) with live bilingual translation (English + Marathi / मराठी), live card preview, dual-sided PDF generation, camera capture, and CSV data export.

---

## ✨ Features

- **📇 Live Dynamic Card Generation**:
  - Live synchronized preview for both Front and Back of the CR-80 standard card (85.6mm × 54mm).
  - High-resolution SVG national emblem and leaf graphic styling.
  - QR Code integration embedding farmer identity and digital verification URL.

- **🌐 Live Marathi Translation**:
  - Automatic English-to-Marathi transliteration & translation for Farmer Name and Father's Name as you type.

- **🔒 Aadhaar Privacy Masking**:
  - UIDAI-compliant privacy toggle (XXXX XXXX 1234 masking) on cards and preview.

- **📷 Multi-Source Photo Input**:
  - Upload photos from local filesystem or capture directly using laptop/mobile webcam.

- **📥 Dual-Sided PDF & Print Layout**:
  - Export **Dual-Sided (Front + Back)** combined PDF document.
  - Single-click **Front PDF**, **Back PDF**, and clean browser print integration.

- **📊 Statistics & CSV Export**:
  - Real-time top bar metrics (Total Registered Farmers, Villages Covered, Total Land in Hectares).
  - One-click CSV export of all registered farmers for record-keeping and agricultural census.

- **💾 CRUD Operations & Local Persistence**:
  - Full REST API with validation, card numbering (KC-1001, KC-1002, ...), search filtering, edit, and deletion.

---

## 🚀 Quickstart

### 1. Install Dependencies
`ash
npm install
`

### 2. Start the Server
`ash
npm start
`
The server will start on **http://localhost:3000**.

### 3. Run Automated Tests
`ash
npm test
`
*(Runs 24 automated unit and API integration tests with Node.js test runner)*

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | API health check status |
| GET | /api/stats | Summary statistics (total farmers, villages, area) |
| GET | /api/farmers | List all registered farmers |
| GET | /api/farmers/:id | Get details for a specific farmer |
| POST | /api/farmers | Register a new farmer |
| PUT | /api/farmers/:id | Update existing farmer details |
| DELETE | /api/farmers/:id | Delete a farmer record |
| GET | /api/farmers/export/csv | Download complete farmer registry as .csv |

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Modern Grid & Flexbox), Vanilla JavaScript (ES6+)
- **Typography**: DM Sans, Noto Sans Devanagari, Space Grotesk
- **Backend**: Node.js, Express.js
- **PDF Generation**: html2pdf.js
- **Testing**: Node.js Built-in Test Runner (
ode:test, 
ode:assert/strict)

---

## 📄 License
MIT License
