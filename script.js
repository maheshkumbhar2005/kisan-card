// ============================================================================
// Kisan Card Studio - Frontend Logic
// ============================================================================

let _cameraStream = null;
let _editingFarmerId = null;
let _cachedFarmers = [];
let _nameTimer = null;
let _fatherTimer = null;

const API_BASE = window.location.origin;

// ----------------------------------------------------------------------------
// Photo Management & Camera Snapshot
// ----------------------------------------------------------------------------

function loadPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const photo = document.getElementById('photo');
    if (photo) {
      photo.src = event.target.result;
      photo.alt = 'Uploaded farmer photo';
    }
  };
  reader.readAsDataURL(file);

  const photoName = document.getElementById('photoName');
  if (photoName) photoName.innerText = file.name;
}

function resetPhoto() {
  const photo = document.getElementById('photo');
  const photoInput = document.getElementById('photoInput');
  const photoName = document.getElementById('photoName');

  if (photo) {
    photo.src = 'farmer-placeholder.svg';
    photo.alt = 'Farmer photo placeholder';
  }
  if (photoInput) photoInput.value = '';
  if (photoName) photoName.innerText = 'Default image selected';
}

async function openCameraModal() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraStream');
  if (!modal || !video) return;

  modal.style.display = 'flex';
  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    });
    video.srcObject = _cameraStream;
  } catch (err) {
    alert('Camera access denied or unavailable: ' + err.message);
    closeCameraModal();
  }
}

function closeCameraModal() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraStream');
  if (_cameraStream) {
    _cameraStream.getTracks().forEach((track) => track.stop());
    _cameraStream = null;
  }
  if (video) video.srcObject = null;
  if (modal) modal.style.display = 'none';
}

function captureCameraPhoto() {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('cameraCanvas');
  const photo = document.getElementById('photo');
  const photoName = document.getElementById('photoName');

  if (!video || !canvas || !photo) return;

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  photo.src = dataUrl;
  photo.alt = 'Camera captured farmer photo';
  if (photoName) photoName.innerText = 'Captured via Camera';

  closeCameraModal();
}

// ----------------------------------------------------------------------------
// Form Utilities & Live Updates
// ----------------------------------------------------------------------------

function clearForm() {
  _editingFarmerId = null;
  const inputs = document.querySelectorAll('.form-box input:not([type=file]):not([type=checkbox])');
  inputs.forEach((el) => {
    el.value = '';
    el.classList.remove('input-error');
  });
  resetPhoto();

  const errorsDiv = document.getElementById('validationErrors');
  if (errorsDiv) errorsDiv.innerHTML = '';

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.textContent = '💾 Save Farmer';

  const defaults = {
    name_en: 'Example Name',
    name_mr: 'उदा. रमेश पाटील',
    father_en: 'Example Name',
    father_mr: 'उदा. सुरेश पाटील',
    address: 'ABC Street',
    aadhaar: 'XXXX XXXX XXXX',
    village: 'Takarkheda',
    survey: '213',
    sub: '2',
    area: '1.08'
  };
  Object.entries(defaults).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  });

  const fid = document.getElementById('fid');
  if (fid) fid.innerText = 'KC-1001';
  setID('KC-1001');
}

function setID(val) {
  const cardId = val ? val.trim() : 'KC-1001';
  const fid = document.getElementById('fid');
  if (fid) fid.innerText = cardId;

  const qr = document.getElementById('qr');
  if (qr) {
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(cardId)}`;
  }
}

function handleAadhaarInput(el) {
  let val = el.value.replace(/\D/g, '').slice(0, 12);
  val = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  el.value = val;
  updateAadhaarDisplay(val);
  clearError(el);
}

function toggleAadhaarMask() {
  const el = document.getElementById('aadhaarInput');
  if (el) updateAadhaarDisplay(el.value);
}

function updateAadhaarDisplay(val) {
  const aadhaarSpan = document.getElementById('aadhaar');
  if (!aadhaarSpan) return;

  const isMasked = document.getElementById('maskAadhaarCheck')?.checked;
  const digits = val.replace(/\D/g, '');

  if (!digits) {
    aadhaarSpan.innerText = 'XXXX XXXX XXXX';
    return;
  }

  if (isMasked && digits.length >= 8) {
    const last4 = digits.slice(-4);
    aadhaarSpan.innerText = `XXXX XXXX ${last4}`;
  } else {
    aadhaarSpan.innerText = val || 'XXXX XXXX XXXX';
  }
}

// ----------------------------------------------------------------------------
// PDF & Printing Helpers
// ----------------------------------------------------------------------------

function downloadPDF() {
  html2pdf()
    .set({
      margin: 0,
      filename: 'Kisan_Card_Front.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3, useCORS: true },
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
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: 'mm', format: [85.6, 54], orientation: 'landscape' }
    })
    .from(document.getElementById('cardBack'))
    .save();
}

function handleDownloadCombined() {
  if (!validateForm()) return;

  const element = document.getElementById('printContainer');
  const opt = {
    margin: [10, 10, 10, 10],
    filename: 'Kisan_Card_Dual_Sided.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}

function handleDownload() {
  if (validateForm()) downloadPDF();
}

function handleDownloadBack() {
  if (validateForm()) downloadBackPDF();
}

function handlePrint() {
  if (validateForm()) window.print();
}

// ----------------------------------------------------------------------------
// Live Google Translate Helpers (Marathi)
// ----------------------------------------------------------------------------

async function translateName(text) {
  const nameEn = document.getElementById('name_en');
  if (nameEn) nameEn.innerText = text || 'Example Name';

  clearTimeout(_nameTimer);
  _nameTimer = setTimeout(async () => {
    const nameMrSpan = document.getElementById('name_mr');
    const nameMrInput = document.getElementById('nameMrInput');
    if (text.length > 0) {
      try {
        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=${encodeURIComponent(text)}`
        );
        const data = await res.json();
        const translated = data?.[0]?.[0]?.[0] || '';
        if (nameMrSpan) nameMrSpan.innerText = translated || 'उदा. रमेश पाटील';
        if (nameMrInput && !nameMrInput.value) nameMrInput.value = translated;
      } catch (error) {
        if (nameMrSpan) nameMrSpan.innerText = nameMrInput?.value || 'उदा. रमेश पाटील';
      }
    } else {
      if (nameMrSpan) nameMrSpan.innerText = 'उदा. रमेश पाटील';
    }
  }, 350);
}

async function translateFather(text) {
  const fatherEn = document.getElementById('father_en');
  if (fatherEn) fatherEn.innerText = text || 'Example Name';

  clearTimeout(_fatherTimer);
  _fatherTimer = setTimeout(async () => {
    const fatherMrSpan = document.getElementById('father_mr');
    const fatherMrInput = document.getElementById('fatherMrInput');
    if (text.length > 0) {
      try {
        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=${encodeURIComponent(text)}`
        );
        const data = await res.json();
        const translated = data?.[0]?.[0]?.[0] || '';
        if (fatherMrSpan) fatherMrSpan.innerText = translated || 'उदा. सुरेश पाटील';
        if (fatherMrInput && !fatherMrInput.value) fatherMrInput.value = translated;
      } catch (error) {
        if (fatherMrSpan) fatherMrSpan.innerText = fatherMrInput?.value || 'उदा. सुरेश पाटील';
      }
    } else {
      if (fatherMrSpan) fatherMrSpan.innerText = 'उदा. सुरेश पाटील';
    }
  }, 350);
}

// ----------------------------------------------------------------------------
// Form Validation
// ----------------------------------------------------------------------------

function clearError(el) {
  if (el) el.classList.remove('input-error');
}

function validateForm() {
  const errors = [];
  const errorsDiv = document.getElementById('validationErrors');
  if (errorsDiv) errorsDiv.innerHTML = '';

  const required = [
    { id: 'nameInput', label: 'Farmer Name (English)' },
    { id: 'fatherInput', label: "Father's Name (English)" },
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
    errorsDiv.innerHTML = errors.map((e) => `<p class="error-msg">⚠️ ${escapeHtml(e)}</p>`).join('');
  }

  return valid;
}

// ----------------------------------------------------------------------------
// Backend API Integration & Directory
// ----------------------------------------------------------------------------

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) return;
    const { stats } = await res.json();
    if (stats) {
      document.getElementById('statTotal').innerText = stats.totalFarmers || '0';
      document.getElementById('statVillages').innerText = stats.totalVillages || '0';
      document.getElementById('statArea').innerText = `${stats.totalAreaHectare || 0} Ha`;
    }
  } catch (err) {
    // silently ignore
  }
}

async function saveFarmer() {
  if (!validateForm()) return;

  const photoEl = document.getElementById('photo');
  const photoSrc = photoEl ? photoEl.src : '';

  const body = {
    farmerName: document.getElementById('nameInput')?.value.trim() || '',
    farmerNameMr: document.getElementById('nameMrInput')?.value.trim() || '',
    fatherName: document.getElementById('fatherInput')?.value.trim() || '',
    fatherNameMr: document.getElementById('fatherMrInput')?.value.trim() || '',
    address: document.getElementById('addressInput')?.value.trim() || '',
    aadhaar: document.getElementById('aadhaarInput')?.value.trim() || '',
    village: document.getElementById('villageInput')?.value.trim() || '',
    survey: document.getElementById('surveyInput')?.value.trim() || '',
    subSurvey: document.getElementById('subSurveyInput')?.value.trim() || '',
    area: document.getElementById('areaInput')?.value.trim() || '',
    cardNumber: document.getElementById('cardInput')?.value.trim() || '',
    photo: photoSrc.startsWith('data:image') ? photoSrc : ''
  };

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    const isEdit = Boolean(_editingFarmerId);
    const url = isEdit ? `${API_BASE}/api/farmers/${_editingFarmerId}` : `${API_BASE}/api/farmers`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      alert('Save failed: ' + (err.errors || []).join(', '));
      return;
    }

    const { farmer } = await res.json();
    if (farmer?.cardNumber) {
      document.getElementById('cardInput').value = farmer.cardNumber;
      setID(farmer.cardNumber);
    }

    const errorsDiv = document.getElementById('validationErrors');
    if (errorsDiv) {
      errorsDiv.innerHTML = `<p class="save-success">✅ Farmer card ${isEdit ? 'updated' : 'registered'} successfully!</p>`;
      setTimeout(() => {
        errorsDiv.innerHTML = '';
      }, 3000);
    }

    if (isEdit) {
      _editingFarmerId = null;
      if (saveBtn) saveBtn.textContent = '💾 Save Farmer';
    }

    loadFarmers();
    loadStats();
  } catch (error) {
    alert('Could not connect to the API server.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = _editingFarmerId ? '💾 Update Farmer' : '💾 Save Farmer';
    }
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
    // ignore
  }
}

function renderFarmers(farmers) {
  const listDiv = document.getElementById('farmerList');
  const countEl = document.getElementById('farmerCount');
  if (!listDiv) return;

  if (!farmers || farmers.length === 0) {
    listDiv.innerHTML = '<p class="empty-msg">No saved farmers yet. Fill the form and click Save Farmer.</p>';
    if (countEl) countEl.textContent = '0 farmers registered';
    return;
  }

  if (countEl) {
    countEl.textContent = `${farmers.length} farmer${farmers.length > 1 ? 's' : ''} registered`;
  }

  listDiv.innerHTML = farmers
    .map(
      (f) => `
    <div class="farmer-card" onclick="loadFarmerToForm(${f.id})">
      <div class="farmer-card-top">
        <h4>${escapeHtml(f.farmerName || 'Unnamed')}</h4>
        <span class="card-badge">${escapeHtml(f.cardNumber || 'KC-1001')}</span>
      </div>
      <p><strong>Father:</strong> ${escapeHtml(f.fatherName || '-')}</p>
      <p><strong>Village:</strong> ${escapeHtml(f.village || '-')} (Survey: ${escapeHtml(f.survey || '-')}/${escapeHtml(f.subSurvey || '-')})</p>
      <p><strong>Area:</strong> ${escapeHtml(f.area || '0')} Ha</p>
      <div class="card-actions">
        <button type="button" class="btn-action load-btn" onclick="event.stopPropagation(); loadFarmerToForm(${f.id})">✏️ Edit</button>
        <button type="button" class="btn-action delete-btn" onclick="event.stopPropagation(); deleteFarmer(${f.id})">🗑️ Delete</button>
      </div>
    </div>
  `
    )
    .join('');
}

function filterFarmers(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderFarmers(_cachedFarmers);
    return;
  }
  const filtered = _cachedFarmers.filter(
    (f) =>
      (f.farmerName || '').toLowerCase().includes(q) ||
      (f.farmerNameMr || '').toLowerCase().includes(q) ||
      (f.village || '').toLowerCase().includes(q) ||
      (f.cardNumber || '').toLowerCase().includes(q) ||
      (f.fatherName || '').toLowerCase().includes(q) ||
      (f.survey || '').toLowerCase().includes(q)
  );
  renderFarmers(filtered);
}

async function loadFarmerToForm(id) {
  try {
    const res = await fetch(`${API_BASE}/api/farmers/${id}`);
    if (!res.ok) return;

    const { farmer } = await res.json();
    _editingFarmerId = farmer.id;

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.textContent = '💾 Update Farmer';

    document.getElementById('cardInput').value = farmer.cardNumber || '';
    document.getElementById('nameInput').value = farmer.farmerName || '';
    document.getElementById('nameMrInput').value = farmer.farmerNameMr || '';
    document.getElementById('fatherInput').value = farmer.fatherName || '';
    document.getElementById('fatherMrInput').value = farmer.fatherNameMr || '';
    document.getElementById('addressInput').value = farmer.address || '';
    document.getElementById('aadhaarInput').value = farmer.aadhaar || '';
    document.getElementById('villageInput').value = farmer.village || '';
    document.getElementById('surveyInput').value = farmer.survey || '';
    document.getElementById('subSurveyInput').value = farmer.subSurvey || '';
    document.getElementById('areaInput').value = farmer.area || '';

    if (farmer.photo) {
      const photo = document.getElementById('photo');
      if (photo) photo.src = farmer.photo;
      const photoName = document.getElementById('photoName');
      if (photoName) photoName.innerText = 'Saved farmer photo loaded';
    }

    // Trigger preview updates
    document.getElementById('name_en').innerText = farmer.farmerName || 'Example Name';
    document.getElementById('name_mr').innerText = farmer.farmerNameMr || 'उदा. रमेश पाटील';
    document.getElementById('father_en').innerText = farmer.fatherName || 'Example Name';
    document.getElementById('father_mr').innerText = farmer.fatherNameMr || 'उदा. सुरेश पाटील';
    document.getElementById('address').innerText = farmer.address || 'ABC Street';
    document.getElementById('village').innerText = farmer.village || 'Takarkheda';
    document.getElementById('survey').innerText = farmer.survey || '213';
    document.getElementById('sub').innerText = farmer.subSurvey || '2';
    document.getElementById('area').innerText = farmer.area || '1.08';
    setID(farmer.cardNumber);
    updateAadhaarDisplay(farmer.aadhaar || '');

    const errorsDiv = document.getElementById('validationErrors');
    if (errorsDiv) errorsDiv.innerHTML = '';

    document.querySelector('.form-box')?.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    // ignore
  }
}

async function deleteFarmer(id) {
  if (!confirm('Are you sure you want to delete this farmer record?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/farmers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (_editingFarmerId === id) {
        clearForm();
      }
      loadFarmers();
      loadStats();
    }
  } catch (error) {
    // ignore
  }
}

function exportCSV() {
  window.open(`${API_BASE}/api/farmers/export/csv`, '_blank');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadFarmers();
  loadStats();
});
