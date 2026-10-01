# 🌾 Kisan Card Pro — Digital Identity & Agricultural Management Suite

[![Node.js](https://img.shields.io/badge/Node.js-v24.x-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite3-blue.svg)](https://www.sqlite.org/)
[![Status](https://img.shields.io/badge/Status-Active%20Production-success.svg)]()
[![License](https://img.shields.io/badge/License-MIT-amber.svg)]()

**Kisan Card Pro** is a comprehensive, government-grade digital identity platform for farmers. Built for agricultural departments and village clusters, it provides executive analytics, instant bilingual card generation, standard CR-80 printing, secure QR verification, and high-performance SQLite database storage.

---

## 🌟 Key Features

### 1. 📊 Executive Dashboard & Analytics
* **Live KPI Counters**: Total registered farmers, active vs. pending status, covered village clusters, and total agricultural land holding (in Hectares).
* **Village-wise Demographics**: Visual distribution bars indicating farmer counts across clusters.
* **Recent Registrations Feed**: Instant real-time audit log of the latest generated cards with quick-view controls.

### 2. 🪪 Card Studio & Customization
* **Unique Sequential Card IDs**: Automatic `KC-XXXX` unique sequence generation with an instant `⚡ Auto` button.
* **Card Status Management**: Visual status badges for `Active` (🟢), `Pending` (🟡), and `Expired` (🔴).
* **Issue Date & 5-Year Validity**: Automated valid term calculations (`Issued: DD/MM/YYYY` • `Valid: YYYY-YYYY`).
* **4 Professional Card Templates**:
  * 🌿 **Emerald Classic**: Official Forest Green & Gold trim on pure white background.
  * 🔷 **Sapphire Tech**: Modern Navy Blue & Cyan digital identity design.
  * 🇮🇳 **Tricolor National**: Saffron, White & Green band with Ashoka Chakra accents.
  * 👑 **Midnight Executive**: Dark Obsidian with Champagne Gold metallic highlights.
* **✍️ Digital Farmer Signature**:
  * Canvas-based drawing pad for stylus, mouse, or touch devices.
  * Realistic handwritten cursive typography rendering (Google Font *Caveat*).
* **✂️ Photo Editor & Cropper**:
  * Built-in interactive modal to crop to standard $35\text{mm} \times 45\text{mm}$ ID proportion.
  * $90^\circ$ rotation, zoom slider ($0.5\times$ to $3.0\times$), and drag-to-reposition viewport.
  * Web camera snapshot capture integration.

### 3. 🛡️ Safe Online QR Code Verification
* **Encrypted Verification URL**: Back card QR codes dynamically encode `/verify.html?id=KC-XXXX`.
* **Privacy Safeguarded**: Non-sensitive identity view showing farmer name, village, survey number, land holding, and digital verification seal while keeping Aadhaar strictly masked (`XXXX-XXXX-9012`).
* **Demo Scan Support**: Instant demonstration verification for sample cards (`KC-1001`, `DEMO`).

### 4. 🖨️ CR-80 High-DPI Printing & Dual Exports
* **CR-80 Standard**: Exact ISO/IEC 7810 ID-1 standard dimensions: **`85.6mm × 53.98mm`** ($3.370'' \times 2.125''$).
* **Print Preview Dialog**: Side-by-side high-fidelity Front & Back preview with millimeter ruler guides.
* **Multiple Export Formats**:
  * 📑 **Dual PDF (A4)**: Front & Back centered on A4 with cut marks.
  * 🪪 **Single PDFs**: `PDF Front` and `PDF Back` at exact CR-80 scale.
  * 🖼️ **300 DPI PNG Images**: `PNG Front`, `PNG Back`, and `PNG Combined Side-by-Side`.

### 5. 📁 Farmers Registry Directory
* **Real-time Search**: Search by farmer name, village, or card number.
* **Filter & Sort**: Filter by village cluster and card status; sort by newest, name, or land holding.
* **Duplicate Detection**: Real-time warning alert if an identical Aadhaar, Card No, or Name/Village/Survey combination is entered, with a 1-click option to edit the existing record.
* **CSV & JSON Backup**: One-click full CSV export, timestamped database backup export, and atomic JSON restore with rollback safety.

### 6. 🌐 Full Bilingual Language Support (English ⇄ Marathi)
* **Navbar Language Switcher**: Toggle between English and Marathi (मराठी).
* **Automatic Phonetic Transliteration**: Real-time phonetic conversion of English names into Marathi Devanagari (`Ramesh Patil` ➔ `रमेश पाटील`).

### 7. 🔒 Robust Security & Backend
* **Native SQLite Storage**: High-throughput ACID storage (`data/kisan_cards.db`) using native `node:sqlite`.
* **Authentication**: Token-based administrator login with brute-force rate limiting (15 attempts / 5 mins).
* **Data Validation**: Strict Aadhaar 12-digit checks, boundary limits on land area, and sanitized inputs.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) v18.0.0 or later (v24.x recommended)

### Installation
```bash
# Clone repository
git clone https://github.com/maheshkumbhar2005/kisan-card.git
cd kisan-card

# Start the application server
node server.js
```

### Accessing the Portal
* **Main Application**: [http://localhost:3000](http://localhost:3000)
* **Public QR Verification**: [http://localhost:3000/verify.html](http://localhost:3000/verify.html)
* **Administrator Login**: Username: `admin` | Password: `admin` (or `admin123`)

---

## 🧪 Automated Testing

Run the built-in test suite covering database transactions, auth flows, validations, and exports:
```bash
node --test tests/api.test.js
```

---

## 📂 Project Architecture

```
kisan-card/
├── api.js              # REST API, SQLite storage, validation & rate limiting
├── server.js           # Production HTTP server entrypoint
├── index.html          # Main SPA (Dashboard, Studio, Registry, Modals)
├── verify.html         # Public privacy-preserving QR verification portal
├── style.css           # Design system, CR-80 layout, themes & print styles
├── script.js           # Client controller, photo editor, signature & exports
├── data/               # Persistent SQLite database (`kisan_cards.db`)
└── tests/
    └── api.test.js     # Comprehensive automated test suite (16 tests)
```

---

## 📜 License
This project is open source and available under the [MIT License](LICENSE).
