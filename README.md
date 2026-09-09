# Kisan Card

A lightweight browser-based Kisan Card generator for creating, saving, and printing farmer identity cards.

## Features

- Live card preview while entering farmer details
- English and Marathi name fields with auto-translation
- Aadhaar number formatting and validation
- Land details including village, survey, sub-survey, and area
- Dynamic farmer image upload with remove option
- QR code on the back card linked to the card number
- Form validation for required fields before download/print
- Save farmers to the API and load them back
- Saved farmers panel with load and delete actions
- Download the front card as a PDF
- Print-friendly card layout
- Responsive design for desktop and mobile screens

## Run Locally

1. Install dependencies with `npm install`.
2. Start the server with `npm start`.
3. Open `http://localhost:3000` in your browser.
4. Enter the farmer details in the form.
5. Use **Save Farmer** to store the record.
6. Use **Download PDF** or **Print Card** when finished.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/farmers` | List all farmers |
| GET | `/api/farmers/:id` | Get a single farmer |
| POST | `/api/farmers` | Create a new farmer |
| PUT | `/api/farmers/:id` | Update a farmer |
| DELETE | `/api/farmers/:id` | Delete a farmer |

The name translation fields use the Google Translate endpoint and require an internet connection. PDF generation also loads `html2pdf.js` from a CDN.

## Tests

Run the test suite:

```bash
node --test
```

## Project Files

- `index.html` – Page structure, form fields, and card markup
- `style.css` – Responsive layout, card design, validation styles, and print styles
- `script.js` – Live updates, image handling, translation, validation, API integration, PDF download, and printing
- `api.js` – Express API for managing farmer records with file-based storage
- `server.js` – Starts the API server and serves static frontend files
- `farmer-placeholder.svg` – Default image shown before a photo is uploaded
- `tests/api.test.js` – Comprehensive API and utility function tests

## Repository

https://github.com/maheshkumbhar2005/kisan-card
