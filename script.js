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

function printCard() {
  window.print();
}

async function translateName(text) {
  const nameEn = document.getElementById('name_en');
  const nameMr = document.getElementById('name_mr');

  if (nameEn) nameEn.innerText = text;

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
}

async function translateFather(text) {
  const fatherEn = document.getElementById('father_en');
  const fatherMr = document.getElementById('father_mr');

  if (fatherEn) fatherEn.innerText = text;

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

function handlePrint() {
  if (validateForm()) printCard();
}
