const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, 'data', 'farmers.json');

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
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
  fs.writeFileSync(DATA_FILE, JSON.stringify(farmers, null, 2), 'utf8');
}

function formatAadhaar(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function maskAadhaar(value) {
  const formatted = formatAadhaar(value);
  const parts = formatted.split(' ');
  if (parts.length === 3 && parts[2].length === 4) {
    return 'XXXX XXXX ' + parts[2];
  }
  return formatted ? 'XXXX XXXX ' + formatted.slice(-4).trim() : 'XXXX XXXX XXXX';
}

function generateCardNumber(existing = []) {
  const maxNumber = existing.reduce((highest, farmer) => {
    const candidate = Number(String(farmer.cardNumber || '').replace(/\D/g, '')) || 0;
    return Math.max(highest, candidate);
  }, 1000);

  return 'KC-' + (maxNumber + 1);
}

function normalizeFarmerData(input = {}) {
  const base = {
    farmerName: '',
    farmerNameMr: '',
    fatherName: '',
    fatherNameMr: '',
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
    farmerNameMr: String(input.farmerNameMr || '').trim(),
    fatherName: String(input.fatherName || '').trim(),
    fatherNameMr: String(input.fatherNameMr || '').trim(),
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

function queryFarmers(allFarmers, query = {}) {
  let result = [...allFarmers];

  // 1. Search Query (Name in EN/MR, Father in EN/MR, Village, Card Number, Survey, Aadhaar)
  const searchTerm = String(query.search || query.q || '').trim().toLowerCase();
  if (searchTerm) {
    result = result.filter((f) => {
      const nameEn = String(f.farmerName || '').toLowerCase();
      const nameMr = String(f.farmerNameMr || '').toLowerCase();
      const fatherEn = String(f.fatherName || '').toLowerCase();
      const fatherMr = String(f.fatherNameMr || '').toLowerCase();
      const village = String(f.village || '').toLowerCase();
      const card = String(f.cardNumber || '').toLowerCase();
      const survey = String(f.survey || '').toLowerCase();
      const aadhaar = String(f.aadhaar || '').replace(/\s/g, '');
      const rawSearch = searchTerm.replace(/\s/g, '');

      return (
        nameEn.includes(searchTerm) ||
        nameMr.includes(searchTerm) ||
        fatherEn.includes(searchTerm) ||
        fatherMr.includes(searchTerm) ||
        village.includes(searchTerm) ||
        card.includes(searchTerm) ||
        survey.includes(searchTerm) ||
        aadhaar.includes(rawSearch)
      );
    });
  }

  // 2. Village Filter
  const villageFilter = String(query.village || '').trim().toLowerCase();
  if (villageFilter && villageFilter !== 'all') {
    result = result.filter((f) => String(f.village || '').trim().toLowerCase() === villageFilter);
  }

  // 3. Status Filter (active / inactive / all)
  const statusFilter = String(query.status || '').trim().toLowerCase();
  if (statusFilter && statusFilter !== 'all') {
    result = result.filter((f) => String(f.status || 'active').trim().toLowerCase() === statusFilter);
  }

  // Extract unique villages from allFarmers
  const uniqueVillages = Array.from(
    new Set(allFarmers.map((f) => String(f.village || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // 4. Sorting
  const sortBy = String(query.sortBy || 'createdAt');
  const sortOrder = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

  result.sort((a, b) => {
    let valA;
    let valB;

    switch (sortBy) {
      case 'farmerName':
      case 'name':
        valA = String(a.farmerName || '').toLowerCase();
        valB = String(b.farmerName || '').toLowerCase();
        return valA.localeCompare(valB) * sortOrder;
      case 'village':
        valA = String(a.village || '').toLowerCase();
        valB = String(b.village || '').toLowerCase();
        return valA.localeCompare(valB) * sortOrder;
      case 'cardNumber':
      case 'card': {
        const numA = Number(String(a.cardNumber || '').replace(/\D/g, '')) || 0;
        const numB = Number(String(b.cardNumber || '').replace(/\D/g, '')) || 0;
        return (numA - numB) * sortOrder;
      }
      case 'area': {
        const areaA = parseFloat(a.area) || 0;
        const areaB = parseFloat(b.area) || 0;
        return (areaA - areaB) * sortOrder;
      }
      case 'createdAt':
      default: {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return (dateA - dateB) * sortOrder;
      }
    }
  });

  const total = result.length;
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) page = 1;

  if (!isNaN(limit) && limit > 0) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginatedFarmers = result.slice(offset, offset + limit);
    return {
      farmers: paginatedFarmers,
      total,
      page,
      limit,
      totalPages,
      villages: uniqueVillages
    };
  }

  return {
    farmers: result,
    total,
    page: 1,
    limit: total,
    totalPages: 1,
    villages: uniqueVillages
  };
}

function getStats() {
  const farmers = readFarmers();
  const totalFarmers = farmers.length;
  const activeFarmers = farmers.filter((f) => f.status === 'active').length;
  const inactiveFarmers = totalFarmers - activeFarmers;

  const villageMap = {};
  let totalArea = 0;

  const landDistribution = {
    marginal: 0,
    small: 0,
    semiMedium: 0,
    large: 0
  };

  farmers.forEach((f) => {
    const vName = (f.village || 'Unassigned').trim();
    const areaVal = parseFloat(f.area) || 0;
    totalArea += areaVal;

    if (!villageMap[vName]) {
      villageMap[vName] = { village: vName, count: 0, totalArea: 0 };
    }
    villageMap[vName].count += 1;
    villageMap[vName].totalArea = Number((villageMap[vName].totalArea + areaVal).toFixed(2));

    if (areaVal < 1.0) {
      landDistribution.marginal += 1;
    } else if (areaVal <= 2.0) {
      landDistribution.small += 1;
    } else if (areaVal <= 4.0) {
      landDistribution.semiMedium += 1;
    } else {
      landDistribution.large += 1;
    }
  });

  const villageWise = Object.values(villageMap)
    .map((v) => ({
      ...v,
      percentage: totalFarmers > 0 ? Number(((v.count / totalFarmers) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count);

  const avgAreaHectare = totalFarmers > 0 ? Number((totalArea / totalFarmers).toFixed(2)) : 0;

  const recentFarmers = [...farmers]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8);

  return {
    totalFarmers,
    activeFarmers,
    inactiveFarmers,
    totalVillages: Object.keys(villageMap).length,
    totalAreaHectare: Number(totalArea.toFixed(2)),
    avgAreaHectare,
    villageWise,
    landDistribution,
    recentFarmers
  };
}

function exportToCSV(farmers) {
  const headers = ['ID', 'Card Number', 'Farmer Name (EN)', 'Farmer Name (MR)', 'Father Name (EN)', 'Father Name (MR)', 'Village', 'Address', 'Aadhaar', 'Survey', 'Sub Survey', 'Area (Ha)', 'Status', 'Created At'];
  const rows = farmers.map((f) => [
    '"' + (f.id || '') + '"',
    '"' + (f.cardNumber || '') + '"',
    '"' + (f.farmerName || '').replace(/"/g, '""') + '"',
    '"' + (f.farmerNameMr || '').replace(/"/g, '""') + '"',
    '"' + (f.fatherName || '').replace(/"/g, '""') + '"',
    '"' + (f.fatherNameMr || '').replace(/"/g, '""') + '"',
    '"' + (f.village || '').replace(/"/g, '""') + '"',
    '"' + (f.address || '').replace(/"/g, '""') + '"',
    '"' + (f.aadhaar || '') + '"',
    '"' + (f.survey || '') + '"',
    '"' + (f.subSurvey || '') + '"',
    '"' + (f.area || '0') + '"',
    '"' + (f.status || 'active') + '"',
    '"' + (f.createdAt || '') + '"'
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function createApp(options = {}) {
  const express = require('express');
  const app = express();

  app.use(express.json({ limit: '5mb' }));

  if (options.serveStatic !== false) {
    app.use(express.static(__dirname));
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', app: 'kisan-card-api' });
  });

  app.get('/api/stats', (_req, res) => {
    res.json({ stats: getStats() });
  });

  app.get('/api/farmers/export/csv', (req, res) => {
    const allFarmers = readFarmers();
    const queryResult = queryFarmers(allFarmers, req.query);
    const csv = exportToCSV(queryResult.farmers);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kisan_card_farmers.csv"');
    res.send(csv);
  });

  app.get('/api/farmers', (req, res) => {
    const allFarmers = readFarmers();
    const result = queryFarmers(allFarmers, req.query);
    res.json(result);
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
  maskAadhaar,
  generateCardNumber,
  queryFarmers,
  readFarmers,
  writeFarmers,
  getStats,
  exportToCSV
};
