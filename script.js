function loadPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const photo = document.getElementById('photo');
  if (photo) {
    if (photo.dataset.objectUrl) URL.revokeObjectURL(photo.dataset.objectUrl);
    photo.dataset.objectUrl = URL.createObjectURL(file);
    photo.src = photo.dataset.objectUrl;
    photo.alt = 'Uploaded farmer photo';
  }

  const photoName = document.getElementById('photoName');
  if (photoName) photoName.innerText = file.name;
}

function resetPhoto() {
  const photo = document.getElementById('photo');
  const photoInput = document.getElementById('photoInput');
  const photoName = document.getElementById('photoName');

  if (photo?.dataset.objectUrl) URL.revokeObjectURL(photo.dataset.objectUrl);
  if (photo) {
    photo.removeAttribute('data-object-url');
    photo.src = 'farmer-placeholder.svg';
    photo.alt = 'Farmer photo placeholder';
  }
  if (photoInput) photoInput.value = '';
  if (photoName) photoName.innerText = 'Default image selected';
}

function clearForm() {
  const inputs = document.querySelectorAll('.form-box input:not([type="file"])');
  inputs.forEach((el) => {
    el.value = '';
    el.classList.remove('input-error');
    el.dispatchEvent(new Event('input'));
  });
  resetPhoto();

  const errorsDiv = document.getElementById('validationErrors');
  if (errorsDiv) errorsDiv.innerHTML = '';

  // Reset card preview text
  const defaults = {
    name_en: 'Example Name', name_mr: 'उदाहरण नाव',
    father_en: 'Example Name', father_mr: 'उदाहरण नाव',
    address: 'ABC Street', aadhaar: 'XXXX XXXX XXXX',
    village: 'Takarkheda', survey: '213', sub: '2', area: '1.08'
  };
  Object.entries(defaults).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  });

  const fid = document.getElementById('fid');
  if (fid) fid.innerText = '1234-XXXX-5457';
}

function setID(val) {
  const fid = document.getElementById('fid');
  if (fid) {
    fid.innerText = val || '1234-XXXX-5457';
  }

  const qr = document.getElementById('qr');
  if (qr) {
    qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(val || '');
  }
}

function downloadPDF() {
  html2pdf()
    .set({
      margin: 0,
      filename: 'Kisan_Card_Govt.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: 'mm', format: [85.6, 54], orientation: 'landscape' }
    })
    .from(document.getElementById('card'))
    .save();
}

function downloadBackPDF() {
  html2pdf()
    .set({
      margin: 0,
      filename: 'Kisan_Card_Back.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: 'mm', format: [85.6, 54], orientation: 'landscape' }
    })
    .from(document.getElementById('cardBack'))
    .save();
}

function printCard() {
  window.print();
}

// ---------------------------------------------------------------------------
// Debounce helper for translation calls
// ---------------------------------------------------------------------------

let _nameTimer = null;
let _fatherTimer = null;

async function translateName(text) {
  const nameEn = document.getElementById('name_en');
  if (nameEn) nameEn.innerText = text;

  clearTimeout(_nameTimer);
  _nameTimer = setTimeout(async () => {
    const nameMr = document.getElementById('name_mr');
    if (text.length > 0) {
      try {
        const res = await fetch(
          'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=' + encodeURIComponent(text)
        );
        const data = await res.json();
        if (nameMr) nameMr.innerText = data?.[0]?.[0]?.[0] || '';
      } catch (error) {
        if (nameMr) nameMr.innerText = '';
      }
    } else if (nameMr) {
      nameMr.innerText = '';
    }
  }, 350);
}

async function translateFather(text) {
  const fatherEn = document.getElementById('father_en');
  if (fatherEn) fatherEn.innerText = text;

  clearTimeout(_fatherTimer);
  _fatherTimer = setTimeout(async () => {
    const fatherMr = document.getElementById('father_mr');
    if (text.length > 0) {
      try {
        const res = await fetch(
          'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=' + encodeURIComponent(text)
        );
        const data = await res.json();
        if (fatherMr) fatherMr.innerText = data?.[0]?.[0]?.[0] || '';
      } catch (error) {
        if (fatherMr) fatherMr.innerText = '';
      }
    } else if (fatherMr) {
      fatherMr.innerText = '';
    }
  }, 350);
}


// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

function clearError(el) {
  if (el) el.classList.remove('input-error');
}

function validateForm() {
  const errors = [];
  const errorsDiv = document.getElementById('validationErrors');
  if (errorsDiv) errorsDiv.innerHTML = '';

  // Required fields
  const required = [
    { id: 'nameInput', label: 'Name (English)' },
    { id: 'fatherInput', label: 'Father Name (English)' },
    { id: 'addressInput', label: 'Address' },
    { id: 'villageInput', label: 'Village' }
  ];

  let valid = true;

  required.forEach(({ id, label }) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (!el.value.trim()) {
      el.classList.add('input-error');
      errors.push(`${label} is required`);
      valid = false;
    } else {
      el.classList.remove('input-error');
    }
  });

  // Aadhaar validation (optional but if entered must be 12 digits)
  const aadhaarEl = document.getElementById('aadhaarInput');
  if (aadhaarEl) {
    const digits = aadhaarEl.value.replace(/\D/g, '');
    if (digits.length > 0 && digits.length !== 12) {
      aadhaarEl.classList.add('input-error');
      errors.push('Aadhaar number must be exactly 12 digits');
      valid = false;
    } else {
      aadhaarEl.classList.remove('input-error');
    }
  }

  if (errorsDiv && errors.length > 0) {
    errorsDiv.innerHTML = errors.map((e) => `<p>${e}</p>`).join('');
  }

  return valid;
}

function handleDownload() {
  if (validateForm()) downloadPDF();
}

function handleDownloadBack() {
  if (validateForm()) downloadBackPDF();
}

function handlePrint() {
  if (validateForm()) printCard();
}

// ---------------------------------------------------------------------------
// API integration – save & load farmers
// ---------------------------------------------------------------------------

const API_BASE = window.location.origin;
let _cachedFarmers = [];

async function saveFarmer() {
  if (!validateForm()) return;

  const body = {
    farmerName: document.getElementById('nameInput')?.value.trim() || '',
    fatherName: document.getElementById('fatherInput')?.value.trim() || '',
    address: document.getElementById('addressInput')?.value.trim() || '',
    aadhaar: document.getElementById('aadhaarInput')?.value.trim() || '',
    village: document.getElementById('villageInput')?.value.trim() || '',
    survey: document.getElementById('surveyInput')?.value.trim() || '',
    subSurvey: document.getElementById('subSurveyInput')?.value.trim() || '',
    area: document.getElementById('areaInput')?.value.trim() || '',
    cardNumber: document.getElementById('cardInput')?.value.trim() || ''
  };

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    const res = await fetch(`${API_BASE}/api/farmers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      alert('Save failed: ' + (err.errors || []).join(', '));
      return;
    }

    const errorsDiv = document.getElementById('validationErrors');
    if (errorsDiv) {
      errorsDiv.innerHTML = '<p class="save-success">✅ Farmer saved successfully!</p>';
      setTimeout(() => { errorsDiv.innerHTML = ''; }, 3000);
    }

    loadFarmers();
  } catch (error) {
    alert('Could not connect to the API. Make sure the server is running (npm start).');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Farmer'; }
  }
}

async function loadFarmers() {
  const listDiv = document.getElementById('farmerList');
  if (!listDiv) return;

  try {
    const res = await fetch(`${API_BASE}/api/farmers`);
    if (!res.ok) return;

    const { farmers } = await res.json();
    _cachedFarmers = farmers || [];
    renderFarmers(_cachedFarmers);
  } catch (error) {
    // API not running — silently ignore
  }
}

function renderFarmers(farmers) {
  const listDiv = document.getElementById('farmerList');
  const countEl = document.getElementById('farmerCount');
  if (!listDiv) return;

  if (!farmers || farmers.length === 0) {
    listDiv.innerHTML = '<p class="empty-msg">No saved farmers yet. Fill the form and click "Save Farmer".</p>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = `${farmers.length} farmer${farmers.length !== 1 ? 's' : ''} saved`;

  listDiv.innerHTML = farmers.map((f) => `
    <div class="farmer-card" onclick="loadFarmerToForm(${f.id})">
      <h4>${escapeHtml(f.farmerName || 'Unnamed')}</h4>
      <p>Father: ${escapeHtml(f.fatherName || '-')}</p>
      <p>Village: ${escapeHtml(f.village || '-')}</p>
      <p>Card: ${escapeHtml(f.cardNumber || '-')}</p>
      <div class="card-actions">
        <button onclick="event.stopPropagation(); loadFarmerToForm(${f.id})">Load</button>
        <button class="delete-btn" onclick="event.stopPropagation(); deleteFarmer(${f.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function filterFarmers(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderFarmers(_cachedFarmers);
    return;
  }
  const filtered = _cachedFarmers.filter((f) =>
    (f.farmerName || '').toLowerCase().includes(q) ||
    (f.village || '').toLowerCase().includes(q) ||
    (f.cardNumber || '').toLowerCase().includes(q) ||
    (f.fatherName || '').toLowerCase().includes(q)
  );
  renderFarmers(filtered);
}

async function loadFarmerToForm(id) {
  try {
    const res = await fetch(`${API_BASE}/api/farmers/${id}`);
    if (!res.ok) return;

    const { farmer } = await res.json();

    const fields = {
      cardInput: farmer.cardNumber || '',
      nameInput: farmer.farmerName || '',
      fatherInput: farmer.fatherName || '',
      addressInput: farmer.address || '',
      aadhaarInput: farmer.aadhaar || '',
      villageInput: farmer.village || '',
      surveyInput: farmer.survey || '',
      subSurveyInput: farmer.subSurvey || '',
      areaInput: farmer.area || ''
    };

    Object.entries(fields).forEach(([inputId, value]) => {
      const el = document.getElementById(inputId);
      if (el) {
        el.value = value;
        el.classList.remove('input-error');
        el.dispatchEvent(new Event('input'));
      }
    });

    // Clear any previous validation errors
    const errorsDiv = document.getElementById('validationErrors');
    if (errorsDiv) errorsDiv.innerHTML = '';

    document.querySelector('.form-box')?.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    // ignore
  }
}

async function deleteFarmer(id) {
  if (!confirm('Delete this farmer record?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/farmers/${id}`, { method: 'DELETE' });
    if (res.ok) loadFarmers();
  } catch (error) {
    // ignore
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Load saved farmers on page load
document.addEventListener('DOMContentLoaded', loadFarmers);
