const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, 'data', 'farmers.json');

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function readFarmers() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeFarmers(farmers) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(farmers, null, 2));
}

function formatAadhaar(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function generateCardNumber(existing = []) {
  const maxNumber = existing.reduce((highest, farmer) => {
    const candidate = Number(String(farmer.cardNumber || '').replace(/\D/g, '')) || 0;
    return Math.max(highest, candidate);
  }, 1000);

  return `KC-${maxNumber + 1}`;
}

function normalizeFarmerData(input = {}) {
  const base = {
    farmerName: '',
    fatherName: '',
    address: '',
    village: '',
    survey: '',
    subSurvey: '',
    area: '',
    aadhaar: '',
    cardNumber: '',
    status: 'active',
    photo: '',
    createdAt: new Date().toISOString()
  };

  const normalized = {
    ...base,
    ...input,
    farmerName: String(input.farmerName || '').trim(),
    fatherName: String(input.fatherName || '').trim(),
    address: String(input.address || '').trim(),
    village: String(input.village || '').trim(),
    survey: String(input.survey || '').trim(),
    subSurvey: String(input.subSurvey || '').trim(),
    area: String(input.area || '').trim(),
    aadhaar: formatAadhaar(input.aadhaar || input.aadhaarNumber || ''),
    cardNumber: String(input.cardNumber || '').trim() || '',
    status: String(input.status || 'active').trim() || 'active',
    photo: String(input.photo || '').trim(),
    createdAt: input.createdAt || new Date().toISOString()
  };

  if (!normalized.cardNumber) {
    normalized.cardNumber = 'KC-1001';
  }

  return normalized;
}

function validateFarmerData(input = {}) {
  const errors = [];
  const data = normalizeFarmerData(input);

  if (!data.farmerName) errors.push('farmerName is required');
  if (!data.fatherName) errors.push('fatherName is required');
  if (!data.village) errors.push('village is required');
  if (!data.address) errors.push('address is required');

  return { ok: errors.length === 0, errors, data };
}

function createApp() {
  const express = require('express');
  const app = express();

  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', app: 'kisan-card-api' });
  });

  app.get('/api/farmers', (_req, res) => {
    const farmers = readFarmers();
    res.json({ farmers });
  });

  app.get('/api/farmers/:id', (req, res) => {
    const farmers = readFarmers();
    const farmer = farmers.find((entry) => String(entry.id) === String(req.params.id));

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    return res.json({ farmer });
  });

  app.post('/api/farmers', (req, res) => {
    const farmers = readFarmers();
    const validation = validateFarmerData(req.body || {});

    if (!validation.ok) {
      return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
    }

    const farmer = normalizeFarmerData({
      ...validation.data,
      id: Date.now(),
      cardNumber: validation.data.cardNumber || generateCardNumber(farmers)
    });

    farmers.push(farmer);
    writeFarmers(farmers);
    return res.status(201).json({ farmer });
  });

  app.put('/api/farmers/:id', (req, res) => {
    const farmers = readFarmers();
    const index = farmers.findIndex((entry) => String(entry.id) === String(req.params.id));

    if (index === -1) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const validation = validateFarmerData({ ...farmers[index], ...req.body });
    if (!validation.ok) {
      return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
    }

    const updated = normalizeFarmerData({
      ...farmers[index],
      ...validation.data,
      id: farmers[index].id,
      createdAt: farmers[index].createdAt || new Date().toISOString()
    });

    farmers[index] = updated;
    writeFarmers(farmers);
    return res.json({ farmer: updated });
  });

  app.delete('/api/farmers/:id', (req, res) => {
    const farmers = readFarmers();
    const next = farmers.filter((entry) => String(entry.id) !== String(req.params.id));

    if (next.length === farmers.length) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    writeFarmers(next);
    return res.json({ success: true, deletedId: req.params.id });
  });

  // 404 handler for unknown routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  return app;
}

module.exports = {
  createApp,
  normalizeFarmerData,
  validateFarmerData,
  formatAadhaar,
  generateCardNumber,
  readFarmers,
  writeFarmers
};

if (require.main === module) {
  const express = require('express');
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Kisan Card API running on http://localhost:${port}`);
  });
}
