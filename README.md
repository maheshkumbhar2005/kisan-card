# Kisan Card

A lightweight browser-based Kisan Card generator for creating and printing farmer identity cards.

## Features

- Live card preview while entering farmer details
- English and Marathi name fields
- Aadhaar number formatting
- Land details including village, survey, sub-survey, and area
- Dynamic farmer image upload
- Default farmer image placeholder
- Remove image and restore the default placeholder
- Download the front card as a PDF
- Print-friendly card layout
- Responsive design for desktop and mobile screens

## Run Locally

No build tools are required.

1. Download or clone the repository.
2. Open `index.html` in a modern web browser.
3. Enter the farmer details in the form.
4. Use **Change image** to upload a farmer photograph.
5. Use **Download PDF** or **Print Card** when finished.

The name translation fields use the Google Translate endpoint and require an internet connection. PDF generation also loads `html2pdf.js` from a CDN.

## Project Files

- `index.html` - Page structure, form fields, and card markup
- `style.css` - Responsive layout, card design, and print styles
- `script.js` - Live updates, image handling, translation, PDF download, and printing
- `farmer-placeholder.svg` - Default image shown before a photo is uploaded

## Repository

https://github.com/maheshkumbhar2005/kisan-card
