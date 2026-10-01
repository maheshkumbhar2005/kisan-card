// ==========================================================================
// KISAN CARD PRO - CLIENT APPLICATION LOGIC
// Includes: Unique ID generation, Card Status, Issue Date, Digital Signature,
// Template Selection, Photo Editor (Crop/Rotate/Zoom), PNG/PDF Exports & Print Preview
// ==========================================================================

const API_BASE = '/api/farmers';
const AUTH_BASE = '/api/auth';
const defaultPhotoSrc = 'farmer-placeholder.svg';
let cameraStreamTrack = null;

// Registry State
let registryState = {
  search: '',
  village: '',
  status: '',
  sortBy: 'date_desc',
  page: 1,
  limit: 8,
  total: 0,
  totalPages: 1,
  viewMode: 'table'
};

let searchDebounceTimer = null;
let currentLanguage = localStorage.getItem('kisan_lang') || 'en';

// Signature State
let sigMode = 'draw';
let isDrawing = false;
let currentSignatureData = null; // { type: 'image' | 'text', data: '...' }

// Photo Editor State
let photoEditorState = {
  imgSrc: defaultPhotoSrc,
  rotation: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0
};

// Current Card State
let currentCardState = {
  template: 'emerald',
  status: 'active',
  issueDate: new Date().toISOString().slice(0, 10),
  signature: ''
};

// ==========================================================================
// BILINGUAL TRANSLATION DICTIONARY (ENGLISH & MARATHI)
// ==========================================================================
const translations = {
  en: {
    langLabel: 'मराठी',
    appTitle: 'KISAN CARD <span>PRO</span>',
    appSubtitle: 'Department of Agriculture • Digital Identity Suite',
    navDashboard: 'Dashboard',
    navGenerator: 'Generator',
    navRegistry: 'Registry',
    navVerify: 'Verify Card',
    navAdmin: 'Admin',
    navNewCard: 'New Card',

    // Dashboard
    dashHeroTitle: 'Agricultural Identity & Analytics Intelligence',
    dashHeroSubtitle: 'Real-time analytics for registered farmers, village demographic distribution, and land parcels.',
    dashBtnGenerate: 'Generate Kisan Card',
    dashBtnRefresh: 'Refresh Analytics',
    metricTotalFarmers: 'Total Farmers Registered',
    badgeLive: 'Live Count',
    metricActive: 'active',
    metricPending: 'pending',
    metricVillages: 'Villages Covered',
    badgeClusters: 'Clusters',
    metricActiveClusters: 'Active rural clusters',
    metricLandArea: 'Total Land Area',
    badgeHectares: 'Hectares',
    metricAvgHolding: 'Avg:',
    metricFarmer: 'farmer',
    dashVillageDist: '🏘️ Village-wise Farmer Distribution',
    dashRecentReg: '⏱️ Recent Registrations',
    viewAll: 'View All →',
    loadingStats: 'Loading village statistics...',
    loadingRecent: 'Loading recent registrations...',

    // Form
    formTitle: '📝 Farmer Details',
    badgeLiveSync: 'Live Sync',
    labelCardNumber: 'Card Number',
    labelNameEn: 'Farmer Name (English) *',
    labelNameMr: 'Farmer Name (Marathi / मराठी)',
    labelFatherEn: "Father's Name (English) *",
    labelFatherMr: "Father's Name (Marathi / मराठी)",
    labelAddress: 'Address *',
    labelAadhaar: 'Aadhaar Number (12 digits)',
    labelMask: 'Mask',
    labelVillage: 'Village *',
    labelSurvey: 'Survey / Gat No.',
    labelSubSurvey: 'Sub-Survey / Hissa',
    labelArea: 'Land Area (Hectare)',
    labelFarmerPhoto: 'Farmer Photo',
    defaultPhoto: 'Default image selected',
    btnUpload: 'Upload',
    btnCamera: 'Camera',
    btnReset: 'Reset',
    btnSaveFarmer: 'Save Farmer',
    btnClearForm: 'Clear Form',

    // Preview
    previewTitle: '🪪 Live Card Preview',
    faceFront: 'Front Card',
    faceBack: 'Back Card (Land)',
    faceBoth: 'Both Cards',
    cardHeaderTitle: 'KISAN CARD',
    cardHeaderSub: 'Department of Agriculture • Maharashtra',
    cardLblName: 'Kisan Name:',
    cardLblNameMr: 'नाव (मराठी):',
    cardLblFather: 'Father Name:',
    cardLblFatherMr: 'वडिलांचे नाव:',
    cardLblAddress: 'Address:',
    cardLblAadhaar: 'Aadhaar:',
    cardBottomBar: 'AGRI STACK • DIGITAL FARMER ID',
    cardBackTagline: 'Digital Farm Holding Certificate',
    cardBackScan: 'SCAN TO VERIFY',
    cardBackPortal: 'AgriStack Portal',
    cardLandHeading: '🌾 Land Holding Details',
    thVillage: 'Village',
    thSurvey: 'Survey',
    thSub: 'Sub',
    thArea: 'Area (Hectare)',
    cardBackNotice: '* This digital identity card is valid across all state agriculture departments, subsidy programs & crop insurance schemes.',

    // Registry
    registryTitle: '📁 Registered Farmers Directory',
    loadingFarmers: 'Loading registered farmers...',
    btnExportCsv: 'Export CSV',
    btnBackup: 'Backup',
    btnRestore: 'Restore',
    btnNewCard: 'Add Farmer',
    lblVillageFilter: 'Village:',
    optAllVillages: 'All Villages',
    lblStatusFilter: 'Status:',
    optAllStatus: 'All Status',
    optActive: 'Active',
    optPending: 'Pending',
    lblSort: 'Sort By:',
    sortDateDesc: 'Newest First',
    sortDateAsc: 'Oldest First',
    sortNameAsc: 'Name (A-Z)',
    sortNameDesc: 'Name (Z-A)',
    sortCardAsc: 'Card No (Asc)',
    sortAreaDesc: 'Area (High to Low)',
    colCardNo: 'Card No ⬍',
    colFarmerName: 'Farmer Name ⬍',
    colVillage: 'Village ⬍',
    colSurvey: 'Survey/Gat',
    colArea: 'Area (Ha) ⬍',
    colStatus: 'Status',
    colActions: 'Actions'
  },
  mr: {
    langLabel: 'English',
    appTitle: 'किसान कार्ड <span>प्रो</span>',
    appSubtitle: 'कृषी विभाग • डिजिटल ओळख प्रणाली',
    navDashboard: 'डॅशबोर्ड',
    navGenerator: 'कार्ड जनरेटर',
    navRegistry: 'शेतकरी यादी',
    navVerify: 'कार्ड पडताळणी',
    navAdmin: 'अ‍ॅडमिन',
    navNewCard: 'नवीन कार्ड',

    // Dashboard
    dashHeroTitle: 'कृषी ओळख व डिजिटल विश्लेषण प्रणाली',
    dashHeroSubtitle: 'नोंदणीकृत शेतकरी, गावनिहाय वितरण व शेतजमिनीचे रिअल-टाइम विश्लेषण.',
    dashBtnGenerate: 'किसान कार्ड बनवा',
    dashBtnRefresh: 'माहिती ताजी करा',
    metricTotalFarmers: 'एकूण नोंदणीकृत शेतकरी',
    badgeLive: 'थेट संख्या',
    metricActive: 'सक्रिय',
    metricPending: 'प्रलंबित',
    metricVillages: 'समाविष्ट गावे',
    badgeClusters: 'मंडळे',
    metricActiveClusters: 'सक्रिय ग्रामीण क्षेत्रे',
    metricLandArea: 'एकूण जमीन क्षेत्रफळ',
    badgeHectares: 'हेक्टर',
    metricAvgHolding: 'सरासरी:',
    metricFarmer: 'शेतकरी',
    dashVillageDist: '🏘️ गावनिहाय शेतकरी संख्या',
    dashRecentReg: '⏱️ अलीकडील नोंदणी',
    viewAll: 'सर्व पहा →',
    loadingStats: 'गाव आकडेवारी लोड होत आहे...',
    loadingRecent: 'नोंदणी लोड होत आहे...',

    // Form
    formTitle: '📝 शेतकरी तपशील',
    badgeLiveSync: 'थेट सिंक',
    labelCardNumber: 'कार्ड क्रमांक',
    labelNameEn: 'शेतकऱ्याचे नाव (इंग्रजी) *',
    labelNameMr: 'शेतकऱ्याचे नाव (मराठी / देवनागरी)',
    labelFatherEn: "वडिलांचे नाव (इंग्रजी) *",
    labelFatherMr: "वडिलांचे नाव (मराठी / देवनागरी)",
    labelAddress: 'पत्ता *',
    labelAadhaar: 'आधार क्रमांक (१२ अंक)',
    labelMask: 'मास्क करा',
    labelVillage: 'गाव *',
    labelSurvey: 'सर्व्हे / गट क्र.',
    labelSubSurvey: 'उप-सर्व्हे / हिस्सा',
    labelArea: 'जमीन क्षेत्रफळ (हेक्टर)',
    labelFarmerPhoto: 'शेतकऱ्याचा फोटो',
    defaultPhoto: 'डीफॉल्ट फोटो निवडला आहे',
    btnUpload: 'अपलोड',
    btnCamera: 'कॅमेरा',
    btnReset: 'रीसेट',
    btnSaveFarmer: 'शेतकरी जतन करा',
    btnClearForm: 'फॉर्म साफ करा',

    // Preview
    previewTitle: '🪪 थेट कार्ड पूर्वावलोकन',
    faceFront: 'पुढील बाजू',
    faceBack: 'मागील बाजू (जमीन)',
    faceBoth: 'दोन्ही बाजू',
    cardHeaderTitle: 'किसान ओळखपत्र',
    cardHeaderSub: 'कृषी विभाग • महाराष्ट्र शासन',
    cardLblName: 'शेतकऱ्याचे नाव:',
    cardLblNameMr: 'नाव (मराठी):',
    cardLblFather: 'वडिलांचे नाव:',
    cardLblFatherMr: 'वडिलांचे नाव (मराठी):',
    cardLblAddress: 'पत्ता:',
    cardLblAadhaar: 'आधार क्रमांक:',
    cardBottomBar: 'अ‍ॅग्रीस्टॅक • डिजिटल शेतकरी ओळख',
    cardBackTagline: 'डिजिटल शेतजमीन धारणा प्रमाणपत्र',
    cardBackScan: 'पडताळणीसाठी स्कॅन करा',
    cardBackPortal: 'अ‍ॅग्रीस्टॅक पोर्टल',
    cardLandHeading: '🌾 शेतजमीन तपशील',
    thVillage: 'गाव',
    thSurvey: 'सर्व्हे क्र.',
    thSub: 'हिस्सा',
    thArea: 'क्षेत्रफळ (हेक्टर)',
    cardBackNotice: '* हे डिजिटल ओळखपत्र सर्व शासकीय योजना, अनुदान व पीक विम्यासाठी अधिकृतपणे वैध आहे.',

    // Registry
    registryTitle: '📁 नोंदणीकृत शेतकरी यादी',
    loadingFarmers: 'शेतकऱ्यांची यादी लोड होत आहे...',
    btnExportCsv: 'CSV निर्यात',
    btnBackup: 'बॅकअप',
    btnRestore: 'रिस्टोअर',
    btnNewCard: 'नवीन जोडा',
    lblVillageFilter: 'गाव निवडा:',
    optAllVillages: 'सर्व गावे',
    lblStatusFilter: 'स्थिती:',
    optAllStatus: 'सर्व स्थिती',
    optActive: 'सक्रिय',
    optPending: 'प्रलंबित',
    lblSort: 'क्रमवारी:',
    sortDateDesc: 'नवीनतम प्रथम',
    sortDateAsc: 'जुने प्रथम',
    sortNameAsc: 'नाव (A-Z)',
    sortNameDesc: 'नाव (Z-A)',
    sortCardAsc: 'कार्ड क्र. (चढता)',
    sortAreaDesc: 'क्षेत्रफळ (जास्त ते कमी)',
    colCardNo: 'कार्ड क्र. ⬍',
    colFarmerName: 'शेतकऱ्याचे नाव ⬍',
    colVillage: 'गाव ⬍',
    colSurvey: 'सर्व्हे/गट',
    colArea: 'क्षेत्रफळ (हे.) ⬍',
    colStatus: 'स्थिती',
    colActions: 'कृती'
  }
};

function updateLanguageUI() {
  const dict = translations[currentLanguage] || translations.en;
  const langLabelEl = document.getElementById('currentLangLabel');
  if (langLabelEl) langLabelEl.innerText = dict.langLabel;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  if (document.getElementById('viewDashboard')?.classList.contains('active')) {
    loadDashboardStats();
  }
  if (document.getElementById('viewRegistry')?.classList.contains('active')) {
    fetchFilteredFarmers();
  }
}

function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'mr' : 'en';
  localStorage.setItem('kisan_lang', currentLanguage);
  updateLanguageUI();
}

// ==========================================================================
// TRANSLITERATION ENGINE (English -> Marathi)
// ==========================================================================
const nameMap = {
  ramesh: 'रमेश', suresh: 'सुरेश', mahesh: 'महेश', ganesh: 'गणेश', dinesh: 'दिनेश',
  rajesh: 'राजेश', patil: 'पाटील', deshmukh: 'देशमुख', shinde: 'शिंदे', pawar: 'पवार',
  jadhav: 'जाधव', kale: 'काळे', kadam: 'कदम', gaikwad: 'गायकवाड', chavan: 'चव्हाण',
  more: 'मोरे', bhosale: 'भोसले', thombre: 'ठोंबरे', kumbhar: 'कुंभार', wagh: 'वाघ',
  sambhaji: 'संभाजी', shivaji: 'शिवाजी', anand: 'आनंद', santosh: 'संतोष', vilas: 'विलास',
  sunil: 'सुनील', anil: 'अनिल', pradeep: 'प्रदीप', sachin: 'सचिन', vijay: 'विजय',
  ashok: 'अशोक', prakash: 'प्रकाश', sanjay: 'संजय', nitin: 'नितीन', rahul: 'राहुल',
  pandurang: 'पांडुरंग', balasaheb: 'बाळासाहेब', baban: 'बबन', narayan: 'नारायण',
  dattatray: 'दत्तात्रय', tukaram: 'तुकाराम', maruti: 'मारुती', bhagwan: 'भगवान'
};

function autoTranslate(text) {
  if (!text) return '';
  return text.toLowerCase().split(/\s+/).map(word => {
    const clean = word.replace(/[^a-z]/g, '');
    return nameMap[clean] || word;
  }).join(' ');
}

// ==========================================================================
// AUTHENTICATION & SECURITY HEADERS
// ==========================================================================
function getAuthHeaders() {
  const token = localStorage.getItem('kisan_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function checkAuthStatus() {
  const token = localStorage.getItem('kisan_admin_token');
  if (!token) {
    updateAuthUI(false);
    return false;
  }
  try {
    const res = await fetch(`${AUTH_BASE}/verify`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.authenticated) {
      updateAuthUI(true, data.username || data.user?.username || 'Admin');
      return true;
    } else {
      localStorage.removeItem('kisan_admin_token');
      updateAuthUI(false);
      return false;
    }
  } catch (err) {
    updateAuthUI(false);
    return false;
  }
}

function updateAuthUI(isLoggedIn, username = 'Admin') {
  const loginBtn = document.getElementById('loginBtn');
  const userBadge = document.getElementById('loggedInUserBadge');
  const userDisplay = document.getElementById('adminUserDisplay');

  if (isLoggedIn) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userBadge) userBadge.style.display = 'inline-flex';
    if (userDisplay) userDisplay.innerText = username;
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userBadge) userBadge.style.display = 'none';
  }
}

function openLoginModal(onSuccessCallback = null) {
  const modal = document.getElementById('loginModal');
  const errBox = document.getElementById('loginErrorMsg');
  if (errBox) errBox.innerHTML = '';
  modal.classList.add('active');
  window._authSuccessCallback = onSuccessCallback;

  const userInput = document.getElementById('adminUsername');
  const passInput = document.getElementById('adminPassword');
  if (userInput && !userInput.value) userInput.value = 'admin';
  setTimeout(() => {
    if (passInput) passInput.focus();
  }, 100);
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  modal.classList.remove('active');
  window._authSuccessCallback = null;
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const u = document.getElementById('adminUsername').value.trim();
  const p = document.getElementById('adminPassword').value.trim();
  const errBox = document.getElementById('loginErrorMsg');
  const submitBtn = document.getElementById('loginSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Authenticating...';
  errBox.innerHTML = '';

  try {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    if (data.token) {
      localStorage.setItem('kisan_admin_token', data.token);
    }
    const adminName = data.username || data.user?.username || u;
    updateAuthUI(true, adminName);
    closeLoginModal();

    // Reload active records and statistics
    loadDashboardStats();
    if (document.getElementById('viewRegistry')?.classList.contains('active')) {
      fetchFilteredFarmers();
    }

    if (typeof window._authSuccessCallback === 'function') {
      const cb = window._authSuccessCallback;
      window._authSuccessCallback = null;
      cb();
    }
  } catch (err) {
    errBox.innerHTML = `⚠️ ${err.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Authenticate';
  }
}

async function logoutAdmin() {
  try {
    await fetch(`${AUTH_BASE}/logout`, { method: 'POST', headers: getAuthHeaders() });
  } catch (e) {}
  localStorage.removeItem('kisan_admin_token');
  updateAuthUI(false);
  switchView('dashboard');
}

async function handleProtectedNavigation(targetView) {
  const authed = await checkAuthStatus();
  if (authed) {
    switchView(targetView);
  } else {
    openLoginModal(() => {
      switchView(targetView);
    });
  }
}

// ==========================================================================
// 1. UNIQUE CARD NUMBER AUTO GENERATION
// ==========================================================================
async function fetchNextCardNumber() {
  try {
    const res = await fetch(`${API_BASE}/next-card-number`);
    if (!res.ok) throw new Error('Failed to fetch next number');
    const data = await res.json();
    return data.nextCardNumber || 'KC-1001';
  } catch (err) {
    return 'KC-' + Math.floor(1000 + Math.random() * 9000);
  }
}

async function autoGenCardNumber() {
  const nextId = await fetchNextCardNumber();
  document.getElementById('cardInput').value = nextId;
  setID(nextId);
}

// ==========================================================================
// 2. CARD STATUS (Active / Pending / Expired)
// ==========================================================================
function setCardStatus(status) {
  currentCardState.status = status;
  const badge = document.getElementById('cardStatusBadge');
  if (!badge) return;

  badge.className = 'card-status-badge';
  if (status === 'active') {
    badge.classList.add('card-status-active');
    badge.innerText = 'ACTIVE';
  } else if (status === 'pending') {
    badge.classList.add('card-status-pending');
    badge.innerText = 'PENDING';
  } else if (status === 'expired') {
    badge.classList.add('card-status-expired');
    badge.innerText = 'EXPIRED';
  }
}

// ==========================================================================
// 3. ISSUE DATE & VALIDITY
// ==========================================================================
function setIssueDate(dateStr) {
  if (!dateStr) return;
  currentCardState.issueDate = dateStr;
  const [year, month, day] = dateStr.split('-');
  const formatted = `${day}/${month}/${year}`;

  const issueEl = document.getElementById('cardIssueDate');
  if (issueEl) issueEl.innerText = `Issued: ${formatted}`;

  const expiryYear = Number(year) + 5;
  const validThruEl = document.getElementById('cardValidThru');
  if (validThruEl) validThruEl.innerText = `Valid: ${year}-${expiryYear}`;
}

// ==========================================================================
// 4. CARD TEMPLATE SELECTION
// ==========================================================================
function setCardTemplate(theme) {
  currentCardState.template = theme;
  const cardFront = document.getElementById('card');
  const cardBack = document.getElementById('cardBack');

  const themes = ['theme-emerald', 'theme-sapphire', 'theme-tricolor', 'theme-midnight'];
  themes.forEach(t => {
    cardFront?.classList.remove(t);
    cardBack?.classList.remove(t);
  });

  const activeThemeClass = `theme-${theme}`;
  cardFront?.classList.add(activeThemeClass);
  cardBack?.classList.add(activeThemeClass);

  // Update button active styles
  document.querySelectorAll('.template-btn').forEach(btn => btn.classList.remove('active'));
  const btnId = `tpl${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
  const activeBtn = document.getElementById(btnId);
  if (activeBtn) activeBtn.classList.add('active');
}

// ==========================================================================
// 5. FARMER SIGNATURE ENGINE (Canvas Draw & Font Type)
// ==========================================================================
function initSignatureCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function drawMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw(e) {
    if (isDrawing) {
      ctx.closePath();
      isDrawing = false;
    }
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', drawMove);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', drawMove, { passive: false });
  canvas.addEventListener('touchend', stopDraw);
}

function switchSigMode(mode) {
  sigMode = mode;
  const drawSec = document.getElementById('sigDrawSection');
  const typeSec = document.getElementById('sigTypeSection');
  const btnDraw = document.getElementById('btnSigDraw');
  const btnType = document.getElementById('btnSigType');

  if (mode === 'draw') {
    drawSec.style.display = 'block';
    typeSec.style.display = 'none';
    btnDraw.classList.add('active');
    btnType.classList.remove('active');
  } else {
    drawSec.style.display = 'none';
    typeSec.style.display = 'block';
    btnDraw.classList.remove('active');
    btnType.classList.add('active');
    const farmerName = document.getElementById('nameInput')?.value.trim() || 'Ramesh Patil';
    const typeInp = document.getElementById('sigTypeInput');
    if (typeInp) typeInp.value = farmerName;
    updateTypeSigPreview(farmerName);
  }
}

function updateTypeSigPreview(val) {
  const prev = document.getElementById('sigTypePreview');
  if (prev) prev.innerText = val || 'Ramesh Patil';
}

function clearSignatureCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function openSignatureModal() {
  const modal = document.getElementById('signatureModal');
  modal.classList.add('active');
  setTimeout(initSignatureCanvas, 100);
}

function closeSignatureModal() {
  const modal = document.getElementById('signatureModal');
  modal.classList.remove('active');
}

function applySignature() {
  const sigBox = document.getElementById('cardSignatureBox');
  const sigImg = document.getElementById('cardSigImg');
  const sigText = document.getElementById('cardSigText');
  const sigStatus = document.getElementById('sigStatusLabel');

  if (sigMode === 'draw') {
    const canvas = document.getElementById('signatureCanvas');
    const dataUrl = canvas.toDataURL('image/png');
    currentSignatureData = { type: 'image', data: dataUrl };
    currentCardState.signature = dataUrl;

    sigImg.src = dataUrl;
    sigImg.style.display = 'block';
    sigText.style.display = 'none';
    sigBox.style.display = 'flex';
    if (sigStatus) sigStatus.innerText = '✅ Custom drawn signature applied';
  } else {
    const textVal = document.getElementById('sigTypeInput').value.trim() || 'Ramesh Patil';
    currentSignatureData = { type: 'text', data: textVal };
    currentCardState.signature = `text:${textVal}`;

    sigText.innerText = textVal;
    sigText.style.display = 'block';
    sigImg.style.display = 'none';
    sigBox.style.display = 'flex';
    if (sigStatus) sigStatus.innerText = `✅ Typed signature ("${textVal}") applied`;
  }

  closeSignatureModal();
}

function clearSignature() {
  currentSignatureData = null;
  currentCardState.signature = '';
  const sigBox = document.getElementById('cardSignatureBox');
  const sigImg = document.getElementById('cardSigImg');
  const sigText = document.getElementById('cardSigText');
  const sigStatus = document.getElementById('sigStatusLabel');

  if (sigImg) sigImg.src = '';
  if (sigText) sigText.innerText = '';
  if (sigBox) sigBox.style.display = 'none';
  if (sigStatus) sigStatus.innerText = 'No signature added';
}

// ==========================================================================
// 6. PHOTO EDITOR (Crop, Rotate, Zoom, Pan & Reposition)
// ==========================================================================
function openPhotoEditorModal() {
  const photoEl = document.getElementById('photo');
  photoEditorState.imgSrc = photoEl.src || defaultPhotoSrc;
  photoEditorState.rotation = 0;
  photoEditorState.zoom = 1;
  photoEditorState.panX = 0;
  photoEditorState.panY = 0;

  const target = document.getElementById('editorImageTarget');
  target.src = photoEditorState.imgSrc;
  document.getElementById('photoZoomSlider').value = '1';
  updateEditorTransform();

  const modal = document.getElementById('photoEditorModal');
  modal.classList.add('active');
  initPhotoEditorDragging();
}

function closePhotoEditorModal() {
  const modal = document.getElementById('photoEditorModal');
  modal.classList.remove('active');
}

function rotateEditorPhoto(deg) {
  photoEditorState.rotation = (photoEditorState.rotation + deg) % 360;
  updateEditorTransform();
}

function handlePhotoZoom(val) {
  photoEditorState.zoom = parseFloat(val) || 1;
  updateEditorTransform();
}

function resetEditorPhoto() {
  photoEditorState.rotation = 0;
  photoEditorState.zoom = 1;
  photoEditorState.panX = 0;
  photoEditorState.panY = 0;
  document.getElementById('photoZoomSlider').value = '1';
  updateEditorTransform();
}

function updateEditorTransform() {
  const target = document.getElementById('editorImageTarget');
  if (!target) return;
  target.style.transform = `translate(${photoEditorState.panX}px, ${photoEditorState.panY}px) rotate(${photoEditorState.rotation}deg) scale(${photoEditorState.zoom})`;
}

function initPhotoEditorDragging() {
  const viewport = document.getElementById('photoCropViewport');
  if (!viewport || viewport.dataset.init === 'true') return;
  viewport.dataset.init = 'true';

  viewport.addEventListener('mousedown', e => {
    photoEditorState.isDragging = true;
    photoEditorState.dragStartX = e.clientX - photoEditorState.panX;
    photoEditorState.dragStartY = e.clientY - photoEditorState.panY;
  });

  window.addEventListener('mousemove', e => {
    if (!photoEditorState.isDragging) return;
    photoEditorState.panX = e.clientX - photoEditorState.dragStartX;
    photoEditorState.panY = e.clientY - photoEditorState.dragStartY;
    updateEditorTransform();
  });

  window.addEventListener('mouseup', () => {
    photoEditorState.isDragging = false;
  });
}

function applyPhotoCrop() {
  const target = document.getElementById('editorImageTarget');
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 + photoEditorState.panX, canvas.height / 2 + photoEditorState.panY);
  ctx.rotate((photoEditorState.rotation * Math.PI) / 180);
  ctx.scale(photoEditorState.zoom, photoEditorState.zoom);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();

    const croppedUrl = canvas.toDataURL('image/jpeg', 0.92);
    const photoEl = document.getElementById('photo');
    const thumbEl = document.getElementById('formPhotoThumb');

    photoEl.src = croppedUrl;
    photoEl.dataset.custom = 'true';
    if (thumbEl) thumbEl.src = croppedUrl;
    document.getElementById('photoName').innerText = 'Cropped & edited photo';
    closePhotoEditorModal();
  };
  img.src = target.src;
}

// ==========================================================================
// 7. PRINT PREVIEW MODAL (Front & Back Side-by-Side)
// ==========================================================================
function openPrintPreviewModal() {
  const modal = document.getElementById('printPreviewModal');
  const frontSlot = document.getElementById('previewFrontSlot');
  const backSlot = document.getElementById('previewBackSlot');

  const cardFront = document.getElementById('card');
  const cardBack = document.getElementById('cardBack');

  frontSlot.innerHTML = '';
  backSlot.innerHTML = '';

  const cloneFront = cardFront.cloneNode(true);
  const cloneBack = cardBack.cloneNode(true);

  cloneFront.style.transform = 'scale(1)';
  cloneBack.style.transform = 'scale(1)';
  cloneFront.style.margin = '0';
  cloneBack.style.margin = '0';

  frontSlot.appendChild(cloneFront);
  backSlot.appendChild(cloneBack);

  modal.classList.add('active');
}

function closePrintPreviewModal() {
  const modal = document.getElementById('printPreviewModal');
  modal.classList.remove('active');
}

function triggerPrintFromPreview() {
  closePrintPreviewModal();
  setTimeout(() => window.print(), 150);
}

// ==========================================================================
// 8. HIGH-DPI DOWNLOAD OPTIONS (PDF & PNG EXPORTS)
// ==========================================================================
async function handleDownloadCombinedPDF() {
  const btn = document.getElementById('downloadCombinedBtn');
  const origText = btn ? btn.innerText : 'Dual PDF';
  if (btn) btn.innerText = 'Generating...';

  try {
    const { jsPDF } = window.jspdf;
    const cardFront = document.getElementById('card');
    const cardBack = document.getElementById('cardBack');

    const canvasFront = await html2canvas(cardFront, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
    const canvasBack = await html2canvas(cardBack, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgDataFront = canvasFront.toDataURL('image/png');
    const imgDataBack = canvasBack.toDataURL('image/png');

    pdf.addImage(imgDataFront, 'PNG', 35, 30, 140, 88.2);
    pdf.addImage(imgDataBack, 'PNG', 35, 130, 140, 88.2);

    const cardId = document.getElementById('fid')?.innerText || 'KC-1001';
    pdf.save(`Kisan_Card_Dual_${cardId}.pdf`);
  } catch (err) {
    alert('PDF Generation failed: ' + err.message);
  } finally {
    if (btn) btn.innerText = origText;
  }
}

async function handleDownloadFrontPDF() {
  const cardFront = document.getElementById('card');
  const canvas = await html2canvas(cardFront, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('l', 'mm', [85.6, 53.98]);
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 53.98);
  const cardId = document.getElementById('fid')?.innerText || 'KC-1001';
  pdf.save(`Kisan_Card_Front_${cardId}.pdf`);
}

async function handleDownloadBackPDF() {
  const cardBack = document.getElementById('cardBack');
  const canvas = await html2canvas(cardBack, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('l', 'mm', [85.6, 53.98]);
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 53.98);
  const cardId = document.getElementById('fid')?.innerText || 'KC-1001';
  pdf.save(`Kisan_Card_Back_${cardId}.pdf`);
}

async function handleDownloadFrontPNG() {
  const cardFront = document.getElementById('card');
  const canvas = await html2canvas(cardFront, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
  const link = document.createElement('a');
  const cardId = document.getElementById('fid')?.innerText || 'KC-1001';
  link.download = `Kisan_Card_Front_${cardId}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function handleDownloadBackPNG() {
  const cardBack = document.getElementById('cardBack');
  const canvas = await html2canvas(cardBack, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
  const link = document.createElement('a');
  const cardId = document.getElementById('fid')?.innerText || 'KC-1001';
  link.download = `Kisan_Card_Back_${cardId}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function handleDownloadCombinedPNG() {
  const cardFront = document.getElementById('card');
  const cardBack = document.getElementById('cardBack');

  const canvasFront = await html2canvas(cardFront, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
  const canvasBack = await html2canvas(cardBack, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });

  const totalCanvas = document.createElement('canvas');
  const padding = 30;
  totalCanvas.width = canvasFront.width + canvasBack.width + padding * 3;
  totalCanvas.height = Math.max(canvasFront.height, canvasBack.height) + padding * 2;
  const ctx = totalCanvas.getContext('2d');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, totalCanvas.width, totalCanvas.height);

  ctx.drawImage(canvasFront, padding, padding);
  ctx.drawImage(canvasBack, canvasFront.width + padding * 2, padding);

  const link = document.createElement('a');
  const cardId = document.getElementById('fid')?.innerText || 'KC-1001';
  link.download = `Kisan_Card_Combined_${cardId}.png`;
  link.href = totalCanvas.toDataURL('image/png');
  link.click();
}

function handlePrint() {
  window.print();
}

// ==========================================================================
// AADHAAR & INPUT FORMATTERS
// ==========================================================================
function formatAadhaar(val) {
  if (!val) return '';
  const digits = val.replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

function maskAadhaar(val) {
  if (!val) return 'XXXX XXXX XXXX';
  const clean = val.replace(/\D/g, '');
  if (clean.length === 12) {
    return 'XXXX XXXX ' + clean.slice(8);
  }
  return 'XXXX XXXX XXXX';
}

function handleAadhaarInput(el) {
  const formatted = formatAadhaar(el.value);
  el.value = formatted;
  const isMasked = document.getElementById('maskAadhaarCheck').checked;
  const displayVal = isMasked ? maskAadhaar(formatted) : (formatted || 'XXXX XXXX XXXX');
  document.getElementById('aadhaar').innerText = displayVal;
}

function toggleAadhaarMask() {
  const rawInput = document.getElementById('aadhaarInput').value;
  const isMasked = document.getElementById('maskAadhaarCheck').checked;
  document.getElementById('aadhaar').innerText = isMasked ? maskAadhaar(rawInput) : (rawInput || 'XXXX XXXX XXXX');
}

function translateName(val) {
  document.getElementById('name_en').innerText = val || 'Ramesh Patil';
  const mrInput = document.getElementById('nameMrInput');
  const translated = autoTranslate(val);
  mrInput.value = translated;
  document.getElementById('name_mr').innerText = translated || 'रमेश पाटील';
}

function translateFather(val) {
  document.getElementById('father_en').innerText = val || 'Suresh Patil';
  const mrInput = document.getElementById('fatherMrInput');
  const translated = autoTranslate(val);
  mrInput.value = translated;
  document.getElementById('father_mr').innerText = translated || 'सुरेश पाटील';
}

function getVerificationUrl(cardId) {
  const base = window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : '';
  return `${base}/verify.html?id=${encodeURIComponent(cardId || 'KC-1001')}`;
}

function setID(val) {
  const cardId = val || 'KC-1001';
  document.getElementById('fid').innerText = cardId;
  const qrEl = document.getElementById('qr');
  const qrLink = document.getElementById('qrLink');
  const verifyUrl = getVerificationUrl(cardId);
  if (qrEl) {
    qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;
  }
  if (qrLink) {
    qrLink.href = verifyUrl;
  }
}

function clearError(inputEl) {
  inputEl.classList.remove('input-error');
  const errBox = document.getElementById('validationErrors');
  if (errBox) errBox.innerHTML = '';
}

// ==========================================================================
// PHOTO UPLOAD & CAMERA CAPTURE HANDLERS
// ==========================================================================
function loadPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    const photoEl = document.getElementById('photo');
    const thumbEl = document.getElementById('formPhotoThumb');
    photoEl.src = reader.result;
    photoEl.dataset.custom = 'true';
    if (thumbEl) thumbEl.src = reader.result;
    document.getElementById('photoName').innerText = file.name;
  };
  reader.readAsDataURL(file);
}

function resetPhoto() {
  const photoEl = document.getElementById('photo');
  const thumbEl = document.getElementById('formPhotoThumb');
  photoEl.src = defaultPhotoSrc;
  delete photoEl.dataset.custom;
  if (thumbEl) thumbEl.src = defaultPhotoSrc;
  document.getElementById('photoName').innerText = 'Default image selected';
  document.getElementById('photoInput').value = '';
}

async function openCameraModal() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraStream');
  modal.classList.add('active');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    cameraStreamTrack = stream.getVideoTracks()[0];
  } catch (err) {
    alert('Camera access denied or unavailable: ' + err.message);
    closeCameraModal();
  }
}

function closeCameraModal() {
  const modal = document.getElementById('cameraModal');
  modal.classList.remove('active');
  if (cameraStreamTrack) {
    cameraStreamTrack.stop();
    cameraStreamTrack = null;
  }
}

function captureCameraPhoto() {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('cameraCanvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 320;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/png');
  const photoEl = document.getElementById('photo');
  const thumbEl = document.getElementById('formPhotoThumb');
  photoEl.src = dataUrl;
  photoEl.dataset.custom = 'true';
  if (thumbEl) thumbEl.src = dataUrl;
  document.getElementById('photoName').innerText = 'Camera snapshot capture';

  closeCameraModal();
}

// ==========================================================================
// VIEW ROUTING
// ==========================================================================
function switchView(viewName) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

  if (viewName === 'dashboard') {
    document.getElementById('viewDashboard').classList.add('active');
    document.getElementById('tabDashboard').classList.add('active');
    loadDashboardStats();
  } else if (viewName === 'studio') {
    document.getElementById('viewStudio').classList.add('active');
    document.getElementById('tabStudio').classList.add('active');
  } else if (viewName === 'registry') {
    document.getElementById('viewRegistry').classList.add('active');
    document.getElementById('tabRegistry').classList.add('active');
    fetchFilteredFarmers();
  }
}

// ==========================================================================
// DASHBOARD ANALYTICS & METRICS
// ==========================================================================
async function loadDashboardStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

function renderDashboard(stats) {
  document.getElementById('statTotalFarmers').innerText = stats.totalFarmers || 0;
  document.getElementById('statActiveFarmers').innerText = stats.activeFarmers || 0;
  document.getElementById('statInactiveFarmers').innerText = stats.inactiveFarmers || 0;
  document.getElementById('statTotalVillages').innerText = stats.totalVillages || 0;
  document.getElementById('statTotalLandArea').innerText = Number(stats.totalLandArea || 0).toFixed(2);
  document.getElementById('statAvgLandArea').innerText = Number(stats.avgLandArea || 0).toFixed(2);

  const navCount = document.getElementById('navFarmerCount');
  if (navCount) navCount.innerText = stats.totalFarmers || 0;

  const villageBadge = document.getElementById('dashVillageCountBadge');
  if (villageBadge) villageBadge.innerText = `${stats.totalVillages || 0} Villages`;

  const villageContainer = document.getElementById('villageStatsContainer');
  if (stats.villageCounts && stats.villageCounts.length > 0) {
    const maxCount = Math.max(...stats.villageCounts.map(v => v.count), 1);
    villageContainer.innerHTML = stats.villageCounts.map(v => {
      const pct = Math.round((v.count / maxCount) * 100);
      return `
        <div class="village-stat-item">
          <span style="font-weight: 700; width: 110px;">${escapeHtml(v.village)}</span>
          <div class="v-bar-wrap">
            <div class="v-bar-fill" style="width: ${pct}%"></div>
          </div>
          <span style="font-weight: 700; color: #15803d;">${v.count} farmers</span>
        </div>
      `;
    }).join('');
  } else {
    villageContainer.innerHTML = `<div class="text-muted" style="padding: 1rem; text-align: center;">No village records registered yet.</div>`;
  }

  renderRecentRegistrations(stats.recentRegistrations || []);
}

function renderRecentRegistrations(recents) {
  const container = document.getElementById('recentRegistrationsContainer');
  if (!recents || recents.length === 0) {
    container.innerHTML = `<div class="text-muted" style="padding: 1rem; text-align: center;">No recent registrations found.</div>`;
    return;
  }
  container.innerHTML = recents.map(f => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px dashed #e2e8f0;">
      <div>
        <div style="font-weight: 700;">${escapeHtml(f.farmerName || 'Farmer')}</div>
        <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(f.village || '-')} • ${f.cardNumber}</div>
      </div>
      <button class="btn btn-sm btn-outline" onclick="handleProtectedRecordView('${f.id}')">View</button>
    </div>
  `).join('');
}

async function handleProtectedRecordView(id) {
  const authed = await checkAuthStatus();
  if (authed) {
    loadFarmerIntoStudio(id);
  } else {
    openLoginModal(() => loadFarmerIntoStudio(id));
  }
}

// ==========================================================================
// FARMERS REGISTRY (SEARCH, FILTER, SORT, PAGINATE)
// ==========================================================================
async function fetchFilteredFarmers() {
  const params = new URLSearchParams({
    search: registryState.search,
    village: registryState.village,
    status: registryState.status,
    sortBy: registryState.sortBy,
    page: registryState.page,
    limit: registryState.limit
  });

  try {
    const res = await fetch(`${API_BASE}?${params.toString()}`, {
      headers: getAuthHeaders()
    });

    if (res.status === 401) {
      const tbody = document.getElementById('farmerList');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2.5rem;">
              <div style="font-weight: 700; color: #166534; font-size: 1rem; margin-bottom: 0.5rem;">🔐 Administrator Access Required</div>
              <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 1rem;">Please log in as an administrator to browse and manage registered farmer records.</p>
              <button class="btn btn-sm btn-primary" onclick="openLoginModal(() => fetchFilteredFarmers())">Login as Admin</button>
            </td>
          </tr>
        `;
      }
      return;
    }

    if (!res.ok) throw new Error('Failed to fetch records');
    const data = await res.json();

    registryState.total = data.total || 0;
    registryState.totalPages = data.totalPages || 1;
    registryState.page = data.page || 1;

    renderActiveFilterChips();
    renderRegistry(data.farmers || []);
    renderPagination();

    const countEl = document.getElementById('farmerCount');
    if (countEl) countEl.innerText = `${data.total} registered farmers in directory`;
    const navCount = document.getElementById('navFarmerCount');
    if (navCount) navCount.innerText = data.total;

    updateVillageFilterDropdown(data.villages || []);
  } catch (err) {
    console.error('Error fetching registry:', err);
  }
}

function handleSearchInput(val) {
  registryState.search = val.trim();
  registryState.page = 1;
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = registryState.search ? 'block' : 'none';

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    fetchFilteredFarmers();
  }, 300);
}

function clearSearchInput() {
  const input = document.getElementById('registrySearchInput');
  if (input) input.value = '';
  handleSearchInput('');
}

function handleVillageFilter(val) {
  registryState.village = val;
  registryState.page = 1;
  fetchFilteredFarmers();
}

function handleStatusFilter(val) {
  registryState.status = val;
  registryState.page = 1;
  fetchFilteredFarmers();
}

function handleSortChange(val) {
  registryState.sortBy = val;
  registryState.page = 1;
  fetchFilteredFarmers();
}

function toggleTableSort(column) {
  const current = registryState.sortBy;
  if (column === 'farmerName') {
    registryState.sortBy = current === 'name_asc' ? 'name_desc' : 'name_asc';
  } else if (column === 'cardNumber') {
    registryState.sortBy = current === 'card_asc' ? 'date_desc' : 'card_asc';
  } else if (column === 'village') {
    registryState.sortBy = current === 'name_asc' ? 'name_desc' : 'name_asc';
  } else if (column === 'area') {
    registryState.sortBy = current === 'area_desc' ? 'date_desc' : 'area_desc';
  }
  const sortSelect = document.getElementById('sortBySelect');
  if (sortSelect) sortSelect.value = registryState.sortBy;
  fetchFilteredFarmers();
}

function setPage(p) {
  if (p < 1 || p > registryState.totalPages) return;
  registryState.page = p;
  fetchFilteredFarmers();
}

function updateVillageFilterDropdown(villages) {
  const select = document.getElementById('villageFilterSelect');
  if (!select) return;
  const currentVal = registryState.village;
  const options = ['<option value="">All Villages</option>'];
  villages.forEach(v => {
    const isSelected = v === currentVal ? 'selected' : '';
    options.push(`<option value="${escapeHtml(v)}" ${isSelected}>${escapeHtml(v)}</option>`);
  });
  select.innerHTML = options.join('');
}

function renderActiveFilterChips() {
  const container = document.getElementById('activeFilterChips');
  if (!container) return;
  const chips = [];

  if (registryState.search) {
    chips.push(`<span class="filter-chip">Search: "${escapeHtml(registryState.search)}" <button onclick="clearSearchInput()">×</button></span>`);
  }
  if (registryState.village) {
    chips.push(`<span class="filter-chip">Village: ${escapeHtml(registryState.village)} <button onclick="handleVillageFilter('')">×</button></span>`);
  }
  if (registryState.status) {
    chips.push(`<span class="filter-chip">Status: ${registryState.status} <button onclick="handleStatusFilter('')">×</button></span>`);
  }

  if (chips.length > 0) {
    container.style.display = 'flex';
    container.innerHTML = chips.join('') + `<button class="btn btn-sm btn-outline" style="font-size: 0.7rem; padding: 2px 6px;" onclick="resetAllFilters()">Reset All</button>`;
  } else {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

function resetAllFilters() {
  registryState.search = '';
  registryState.village = '';
  registryState.status = '';
  registryState.sortBy = 'date_desc';
  registryState.page = 1;

  const searchInp = document.getElementById('registrySearchInput');
  if (searchInp) searchInp.value = '';
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  const vFilter = document.getElementById('villageFilterSelect');
  if (vFilter) vFilter.value = '';
  const sFilter = document.getElementById('statusFilterSelect');
  if (sFilter) sFilter.value = '';
  const sortSel = document.getElementById('sortBySelect');
  if (sortSel) sortSel.value = 'date_desc';

  fetchFilteredFarmers();
}

function renderRegistry(farmers) {
  const tbody = document.getElementById('farmerList');
  if (!farmers || farmers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem;" class="text-muted">No farmers match the selected filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = farmers.map(f => {
    let statusPill = `<span class="status-pill status-active">Active</span>`;
    if (f.status === 'inactive' || f.status === 'pending') {
      statusPill = `<span class="status-pill status-inactive">Pending</span>`;
    } else if (f.status === 'expired') {
      statusPill = `<span class="status-pill" style="background:#fee2e2; color:#b91c1c;">Expired</span>`;
    }

    return `
      <tr>
        <td><span class="card-id-pill">${escapeHtml(f.cardNumber || 'KC-0000')}</span></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(f.farmerName || '-')}</div>
          ${f.farmerNameMr ? `<div style="font-size: 0.75rem; color: #166534; font-family: var(--font-mr);">${escapeHtml(f.farmerNameMr)}</div>` : ''}
        </td>
        <td>${escapeHtml(f.village || '-')}</td>
        <td>${escapeHtml(f.survey || '-')}${f.subSurvey ? ' / ' + escapeHtml(f.subSurvey) : ''}</td>
        <td><strong style="color: #15803d;">${f.area ? Number(f.area).toFixed(2) : '-'}</strong></td>
        <td>${statusPill}</td>
        <td style="text-align: right;">
          <div class="actions-cell" style="justify-content: flex-end;">
            <button class="btn btn-sm btn-outline" onclick="loadFarmerIntoStudio('${f.id}')" title="Edit Farmer">✏️</button>
            <a href="/verify.html?id=${encodeURIComponent(f.cardNumber)}" target="_blank" class="btn btn-sm btn-outline" title="Verify Online">🔍</a>
            <button class="btn btn-sm btn-danger-soft" onclick="deleteFarmerRecord('${f.id}')" title="Delete Farmer">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination() {
  const container = document.getElementById('paginationControls');
  const info = document.getElementById('paginationInfo');
  if (!container || !info) return;

  const start = (registryState.page - 1) * registryState.limit + 1;
  const end = Math.min(registryState.page * registryState.limit, registryState.total);
  info.innerText = registryState.total > 0
    ? `Showing ${start}-${end} of ${registryState.total} records`
    : 'Showing 0 records';

  if (registryState.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let btns = [];
  btns.push(`<button class="page-btn" onclick="setPage(${registryState.page - 1})" ${registryState.page === 1 ? 'disabled' : ''}>← Prev</button>`);

  for (let i = 1; i <= registryState.totalPages; i++) {
    if (i === 1 || i === registryState.totalPages || Math.abs(i - registryState.page) <= 1) {
      btns.push(`<button class="page-btn ${i === registryState.page ? 'active' : ''}" onclick="setPage(${i})">${i}</button>`);
    } else if (Math.abs(i - registryState.page) === 2) {
      btns.push(`<span style="padding: 0 4px; color: #94a3b8;">...</span>`);
    }
  }

  btns.push(`<button class="page-btn" onclick="setPage(${registryState.page + 1})" ${registryState.page === registryState.totalPages ? 'disabled' : ''}>Next →</button>`);
  container.innerHTML = btns.join('');
}

// ==========================================================================
// FARMER CRUD IN STUDIO
// ==========================================================================
async function loadFarmerIntoStudio(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load farmer details');
    const data = await res.json();
    populateStudioWithFarmer(data.farmer || data);
    switchView('studio');
  } catch (err) {
    alert('Error loading farmer: ' + err.message);
  }
}

function populateStudioWithFarmer(f) {
  document.getElementById('cardInput').value = f.cardNumber || '';
  document.getElementById('statusInput').value = f.status || 'active';
  document.getElementById('issueDateInput').value = f.issueDate || new Date().toISOString().slice(0, 10);
  document.getElementById('nameInput').value = f.farmerName || '';
  document.getElementById('nameMrInput').value = f.farmerNameMr || '';
  document.getElementById('fatherInput').value = f.fatherName || '';
  document.getElementById('fatherMrInput').value = f.fatherNameMr || '';
  document.getElementById('addressInput').value = f.address || '';
  document.getElementById('aadhaarInput').value = f.aadhaar ? formatAadhaar(f.aadhaar) : '';
  document.getElementById('villageInput').value = f.village || '';
  document.getElementById('surveyInput').value = f.survey || '';
  document.getElementById('subSurveyInput').value = f.subSurvey || '';
  document.getElementById('areaInput').value = f.area || '';

  // Synchronize Live Card Display
  setID(f.cardNumber);
  setCardStatus(f.status || 'active');
  setIssueDate(f.issueDate || new Date().toISOString().slice(0, 10));
  setCardTemplate(f.template || 'emerald');

  document.getElementById('name_en').innerText = f.farmerName || 'Ramesh Patil';
  document.getElementById('name_mr').innerText = f.farmerNameMr || 'रमेश पाटील';
  document.getElementById('father_en').innerText = f.fatherName || 'Suresh Patil';
  document.getElementById('father_mr').innerText = f.fatherNameMr || 'सुरेश पाटील';
  document.getElementById('address').innerText = f.address || 'Main Road';
  toggleAadhaarMask();
  document.getElementById('village').innerText = f.village || 'Takarkheda';
  document.getElementById('survey').innerText = f.survey || '213';
  document.getElementById('sub').innerText = f.subSurvey || '2';
  document.getElementById('area').innerText = f.area || '1.08';

  // Signature
  if (f.signature) {
    const sigBox = document.getElementById('cardSignatureBox');
    const sigImg = document.getElementById('cardSigImg');
    const sigText = document.getElementById('cardSigText');
    const sigStatus = document.getElementById('sigStatusLabel');

    if (f.signature.startsWith('text:')) {
      const textVal = f.signature.slice(5);
      sigText.innerText = textVal;
      sigText.style.display = 'block';
      sigImg.style.display = 'none';
      if (sigStatus) sigStatus.innerText = `✅ Typed signature: "${textVal}"`;
    } else {
      sigImg.src = f.signature;
      sigImg.style.display = 'block';
      sigText.style.display = 'none';
      if (sigStatus) sigStatus.innerText = '✅ Saved signature loaded';
    }
    sigBox.style.display = 'flex';
  } else {
    clearSignature();
  }

  // Photo
  const photoEl = document.getElementById('photo');
  const thumbEl = document.getElementById('formPhotoThumb');
  if (f.photo) {
    photoEl.src = f.photo;
    photoEl.dataset.custom = 'true';
    if (thumbEl) thumbEl.src = f.photo;
    document.getElementById('photoName').innerText = 'Custom farmer photo';
  } else {
    resetPhoto();
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.dataset.editingId = f.id;
  saveBtn.innerText = '💾 Update Farmer';
}

async function saveFarmer() {
  const saveBtn = document.getElementById('saveBtn');
  const errBox = document.getElementById('validationErrors');
  errBox.innerHTML = '';

  const farmerData = {
    cardNumber: document.getElementById('cardInput').value.trim() || undefined,
    status: document.getElementById('statusInput').value || 'active',
    issueDate: document.getElementById('issueDateInput').value || new Date().toISOString().slice(0, 10),
    template: currentCardState.template || 'emerald',
    signature: currentCardState.signature || '',
    farmerName: document.getElementById('nameInput').value.trim(),
    farmerNameMr: document.getElementById('nameMrInput').value.trim(),
    fatherName: document.getElementById('fatherInput').value.trim(),
    fatherNameMr: document.getElementById('fatherMrInput').value.trim(),
    address: document.getElementById('addressInput').value.trim(),
    aadhaar: document.getElementById('aadhaarInput').value.trim(),
    village: document.getElementById('villageInput').value.trim(),
    survey: document.getElementById('surveyInput').value.trim(),
    subSurvey: document.getElementById('subSurveyInput').value.trim(),
    area: document.getElementById('areaInput').value.trim()
  };

  const photoEl = document.getElementById('photo');
  if (photoEl && photoEl.dataset.custom === 'true') {
    farmerData.photo = photoEl.src;
  }

  const editingId = saveBtn.dataset.editingId;
  const method = editingId ? 'PUT' : 'POST';
  const url = editingId ? `${API_BASE}/${editingId}` : API_BASE;

  saveBtn.disabled = true;
  saveBtn.innerText = 'Saving...';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(farmerData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save farmer');
    }

    alert(editingId ? 'Farmer details updated successfully!' : 'Farmer registered successfully!');
    clearForm();
    switchView('registry');
  } catch (err) {
    errBox.innerHTML = `⚠️ ${err.message}`;
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = editingId ? '💾 Update Farmer' : '💾 Save Farmer';
  }
}

async function deleteFarmerRecord(id) {
  if (!confirm('Are you sure you want to permanently delete this farmer record?')) return;
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete farmer');
    fetchFilteredFarmers();
    loadDashboardStats();
  } catch (err) {
    alert('Error deleting record: ' + err.message);
  }
}

async function clearForm() {
  const nextId = await fetchNextCardNumber();
  document.getElementById('cardInput').value = nextId;
  document.getElementById('statusInput').value = 'active';
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('issueDateInput').value = today;
  document.getElementById('nameInput').value = '';
  document.getElementById('nameMrInput').value = '';
  document.getElementById('fatherInput').value = '';
  document.getElementById('fatherMrInput').value = '';
  document.getElementById('addressInput').value = '';
  document.getElementById('aadhaarInput').value = '';
  document.getElementById('villageInput').value = '';
  document.getElementById('surveyInput').value = '';
  document.getElementById('subSurveyInput').value = '';
  document.getElementById('areaInput').value = '';
  document.getElementById('validationErrors').innerHTML = '';

  setID(nextId);
  setCardStatus('active');
  setIssueDate(today);
  setCardTemplate('emerald');
  clearSignature();

  document.getElementById('name_en').innerText = 'Ramesh Patil';
  document.getElementById('name_mr').innerText = 'रमेश पाटील';
  document.getElementById('father_en').innerText = 'Suresh Patil';
  document.getElementById('father_mr').innerText = 'सुरेश पाटील';
  document.getElementById('address').innerText = 'Main Road';
  document.getElementById('aadhaar').innerText = 'XXXX XXXX XXXX';
  document.getElementById('village').innerText = 'Takarkheda';
  document.getElementById('survey').innerText = '213';
  document.getElementById('sub').innerText = '2';
  document.getElementById('area').innerText = '1.08';

  resetPhoto();

  const saveBtn = document.getElementById('saveBtn');
  delete saveBtn.dataset.editingId;
  saveBtn.innerText = '💾 Save Farmer';
}

// ==========================================================================
// EXPORT & RESTORE HANDLERS
// ==========================================================================
async function exportCSV() {
  try {
    const res = await fetch(`${API_BASE}/export/csv`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to export CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kisan_farmers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Export CSV failed: ' + err.message);
  }
}

async function exportBackup() {
  try {
    const res = await fetch('/api/backup/export', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to create backup');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kisan_card_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Backup export failed: ' + err.message);
  }
}

async function handleRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm('Warning: Restoring will overwrite current database records with backup data. Proceed?')) {
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async function () {
    try {
      const payload = JSON.parse(reader.result);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      alert(`Database successfully restored! (${data.restoredCount} records)`);
      fetchFilteredFarmers();
      loadDashboardStats();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function switchMobileCardFace(face) {
  const frontWrapper = document.getElementById('frontCardWrapper');
  const backWrapper = document.getElementById('backCardWrapper');
  const btnFront = document.getElementById('btnShowFront');
  const btnBack = document.getElementById('btnShowBack');
  const btnBoth = document.getElementById('btnShowBoth');

  [btnFront, btnBack, btnBoth].forEach(b => b.classList.remove('active'));

  if (face === 'front') {
    frontWrapper.style.display = 'flex';
    backWrapper.style.display = 'none';
    btnFront.classList.add('active');
  } else if (face === 'back') {
    frontWrapper.style.display = 'none';
    backWrapper.style.display = 'flex';
    btnBack.classList.add('active');
  } else {
    frontWrapper.style.display = 'flex';
    backWrapper.style.display = 'flex';
    btnBoth.classList.add('active');
  }
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  updateLanguageUI();
  checkAuthStatus();
  loadDashboardStats();

  const today = new Date().toISOString().slice(0, 10);
  const dateInput = document.getElementById('issueDateInput');
  if (dateInput) dateInput.value = today;
  setIssueDate(today);

  fetchNextCardNumber().then(id => {
    const cardInp = document.getElementById('cardInput');
    if (cardInp && !cardInp.value) cardInp.value = id;
    setID(id);
  });
});

// ==========================================================================
// 9. REAL-TIME DUPLICATE RECORD DETECTION
// ==========================================================================
let duplicateCheckTimer = null;
let currentDuplicateFarmer = null;

function triggerDuplicateCheck() {
  clearTimeout(duplicateCheckTimer);
  duplicateCheckTimer = setTimeout(checkDuplicateOnInput, 400);
}

async function checkDuplicateOnInput() {
  const name = document.getElementById('nameInput')?.value.trim();
  const aadhaar = document.getElementById('aadhaarInput')?.value.trim();
  const village = document.getElementById('villageInput')?.value.trim();
  const survey = document.getElementById('surveyInput')?.value.trim();
  const card = document.getElementById('cardInput')?.value.trim();
  const editingId = document.getElementById('saveBtn')?.dataset.editingId || null;

  if (!name && !aadhaar && !village) {
    dismissDuplicateWarning();
    return;
  }

  const farmerData = {
    farmerName: name,
    aadhaar,
    village,
    survey,
    cardNumber: card
  };

  try {
    const res = await fetch(`${API_BASE}/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ farmerData, excludeId: editingId })
    });

    if (!res.ok) return;
    const data = await res.json();

    if (data.isDuplicate && data.existingFarmer) {
      currentDuplicateFarmer = data.existingFarmer;
      showDuplicateWarning(data.matchReason, data.existingFarmer);
    } else {
      dismissDuplicateWarning();
    }
  } catch (err) {
    // Graceful fallback
  }
}

function showDuplicateWarning(reason, existing) {
  const banner = document.getElementById('duplicateWarningBanner');
  const textEl = document.getElementById('dupWarningText');
  if (!banner || !textEl) return;

  const isMr = currentLanguage === 'mr';
  const nameDisplay = existing.farmerName || 'Farmer';
  const cardDisplay = existing.cardNumber || 'KC-XXXX';
  const villageDisplay = existing.village || '-';

  if (isMr) {
    textEl.innerText = `यापूर्वीच ${nameDisplay} (${villageDisplay}) यांच्या नावे नोंदणी आढळली आहे (कार्ड क्र: ${cardDisplay}). ${reason}.`;
  } else {
    textEl.innerText = `A record for "${nameDisplay}" (${villageDisplay}) already exists with Card No: ${cardDisplay}. (${reason})`;
  }

  banner.style.display = 'block';
}

function dismissDuplicateWarning() {
  const banner = document.getElementById('duplicateWarningBanner');
  if (banner) banner.style.display = 'none';
  currentDuplicateFarmer = null;
}

function loadDuplicateIntoStudio() {
  if (!currentDuplicateFarmer || !currentDuplicateFarmer.id) return;
  loadFarmerIntoStudio(currentDuplicateFarmer.id);
  dismissDuplicateWarning();
}

// Global Accessibility Keyboard Listeners
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLoginModal();
    closeCameraModal();
    closePhotoEditorModal();
    closeSignatureModal();
    closePrintPreviewModal();
  }
});
