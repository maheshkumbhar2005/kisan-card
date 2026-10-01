const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'kisan_cards.db');
const JSON_FILE = path.join(DATA_DIR, 'farmers.json');
const SECRET_KEY = process.env.JWT_SECRET || 'kisan-card-super-secret-admin-key-2026';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

// Ensure data directory
fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize SQLite Database
let dbInstance = null;

function getDB(customPath) {
  if (customPath) {
    const db = new DatabaseSync(customPath);
    initSchema(db);
    return db;
  }
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_FILE);
    initSchema(dbInstance);
    migrateJsonIfEmpty(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS farmers (
      id INTEGER PRIMARY KEY,
      cardNumber TEXT UNIQUE NOT NULL,
      farmerName TEXT NOT NULL,
      farmerNameMr TEXT DEFAULT '',
      fatherName TEXT NOT NULL,
      fatherNameMr TEXT DEFAULT '',
      village TEXT NOT NULL,
      address TEXT NOT NULL,
      survey TEXT DEFAULT '',
      subSurvey TEXT DEFAULT '',
      area TEXT DEFAULT '0',
      aadhaar TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      photo TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_farmers_cardNumber ON farmers(cardNumber);
    CREATE INDEX IF NOT EXISTS idx_farmers_village ON farmers(village);
    CREATE INDEX IF NOT EXISTS idx_farmers_status ON farmers(status);
  `);
}

function migrateJsonIfEmpty(db) {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM farmers').get();
    if (countRow.count === 0 && fs.existsSync(JSON_FILE)) {
      const raw = fs.readFileSync(JSON_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const insert = db.prepare(`
          INSERT INTO farmers (id, cardNumber, farmerName, farmerNameMr, fatherName, fatherNameMr, village, address, survey, subSurvey, area, aadhaar, status, photo, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const f of parsed) {
          const norm = normalizeFarmerData(f);
          insert.run(
            Number(f.id) || Date.now(),
            norm.cardNumber,
            norm.farmerName,
            norm.farmerNameMr,
            norm.fatherName,
            norm.fatherNameMr,
            norm.village,
            norm.address,
            norm.survey,
            norm.subSurvey,
            norm.area,
            norm.aadhaar,
            norm.status,
            norm.photo,
            norm.createdAt
          );
        }
      }
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// ----------------------------------------------------
// DATABASE ACCESS HELPERS
// ----------------------------------------------------

function readAllFarmers(db = getDB()) {
  const rows = db.prepare('SELECT * FROM farmers ORDER BY id DESC').all();
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

function getFarmerById(id, db = getDB()) {
  const row = db.prepare('SELECT * FROM farmers WHERE id = ?').get(id);
  return row ? { ...row, id: Number(row.id) } : null;
}

function getFarmerByCardNumber(cardNumber, db = getDB()) {
  const cardId = String(cardNumber || '').trim().toUpperCase();
  const row = db.prepare('SELECT * FROM farmers WHERE UPPER(cardNumber) = ? OR CAST(id AS TEXT) = ?').get(cardId, cardId);
  return row ? { ...row, id: Number(row.id) } : null;
}

function insertFarmer(farmer, db = getDB()) {
  const insert = db.prepare(`
    INSERT INTO farmers (id, cardNumber, farmerName, farmerNameMr, fatherName, fatherNameMr, village, address, survey, subSurvey, area, aadhaar, status, photo, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    farmer.id,
    farmer.cardNumber,
    farmer.farmerName,
    farmer.farmerNameMr,
    farmer.fatherName,
    farmer.fatherNameMr,
    farmer.village,
    farmer.address,
    farmer.survey,
    farmer.subSurvey,
    farmer.area,
    farmer.aadhaar,
    farmer.status,
    farmer.photo,
    farmer.createdAt
  );
  return farmer;
}

function updateFarmerInDB(id, farmer, db = getDB()) {
  const update = db.prepare(`
    UPDATE farmers SET
      farmerName = ?,
      farmerNameMr = ?,
      fatherName = ?,
      fatherNameMr = ?,
      village = ?,
      address = ?,
      survey = ?,
      subSurvey = ?,
      area = ?,
      aadhaar = ?,
      status = ?,
      photo = ?
    WHERE id = ?
  `);
  const result = update.run(
    farmer.farmerName,
    farmer.farmerNameMr,
    farmer.fatherName,
    farmer.fatherNameMr,
    farmer.village,
    farmer.address,
    farmer.survey,
    farmer.subSurvey,
    farmer.area,
    farmer.aadhaar,
    farmer.status,
    farmer.photo,
    id
  );
  return result.changes > 0 ? farmer : null;
}

function deleteFarmerFromDB(id, db = getDB()) {
  const del = db.prepare('DELETE FROM farmers WHERE id = ?');
  const result = del.run(id);
  return result.changes > 0;
}

// ----------------------------------------------------
// RATE LIMITING MIDDLEWARE
// ----------------------------------------------------

const rateLimitStore = new Map();

function rateLimit(options = {}) {
  const windowMs = options.windowMs || 5 * 60 * 1000; // 5 minutes
  const max = options.max || 200; // max requests
  const message = options.message || 'Too many requests from this client. Please try again later.';

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count += 1;
    rateLimitStore.set(key, record);

    if (record.count > max) {
      return res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    next();
  };
}

// ----------------------------------------------------
// TOKEN & AUTH UTILITIES (Node crypto based HMAC)
// ----------------------------------------------------

function generateToken(payload = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim();
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized. Administrator credentials required.',
      code: 'AUTH_REQUIRED'
    });
  }

  req.user = user;
  next();
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
    status: String(input.status || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active',
    photo: String(input.photo || '').trim(),
    createdAt: input.createdAt || new Date().toISOString()
  };

  if (!normalized.cardNumber) {
    normalized.cardNumber = 'KC-1001';
  }

  return normalized;
}

// ----------------------------------------------------
// ROBUST VALIDATION ENGINE
// ----------------------------------------------------

function validateFarmerData(input = {}) {
  const errors = [];
  const data = normalizeFarmerData(input);

  // 1. Farmer Name
  if (!data.farmerName) {
    errors.push('Farmer Name is required.');
  } else if (data.farmerName.length < 2 || data.farmerName.length > 100) {
    errors.push('Farmer Name must be between 2 and 100 characters.');
  }

  // 2. Father Name
  if (!data.fatherName) {
    errors.push("Father's Name is required.");
  } else if (data.fatherName.length < 2 || data.fatherName.length > 100) {
    errors.push("Father's Name must be between 2 and 100 characters.");
  }

  // 3. Village
  if (!data.village) {
    errors.push('Village name is required.');
  } else if (data.village.length < 2 || data.village.length > 100) {
    errors.push('Village name must be between 2 and 100 characters.');
  }

  // 4. Address
  if (!data.address) {
    errors.push('Address is required.');
  } else if (data.address.length < 3 || data.address.length > 255) {
    errors.push('Address must be between 3 and 255 characters.');
  }

  // 5. Land Area
  if (data.area) {
    const areaNum = parseFloat(data.area);
    if (isNaN(areaNum) || areaNum < 0 || areaNum > 10000) {
      errors.push('Land area must be a valid positive number up to 10,000 Hectares.');
    }
  }

  // 6. Aadhaar (if provided, must have 12 digits)
  if (data.aadhaar) {
    const digits = data.aadhaar.replace(/\s/g, '');
    if (!/^\d{12}$/.test(digits)) {
      errors.push('Aadhaar number must contain exactly 12 digits.');
    }
  }

  return { ok: errors.length === 0, errors, data };
}

// Sanitize farmer data for public verification - strictly mask sensitive fields
function sanitizeForVerification(farmer) {
  if (!farmer) return null;
  return {
    cardNumber: farmer.cardNumber || '',
    farmerName: farmer.farmerName || '',
    farmerNameMr: farmer.farmerNameMr || '',
    fatherName: farmer.fatherName || '',
    fatherNameMr: farmer.fatherNameMr || '',
    village: farmer.village || '',
    address: farmer.address || '',
    survey: farmer.survey || '',
    subSurvey: farmer.subSurvey || '',
    area: farmer.area || '',
    status: farmer.status || 'active',
    maskedAadhaar: maskAadhaar(farmer.aadhaar || ''),
    photo: farmer.photo || '',
    createdAt: farmer.createdAt || '',
    isVerified: true
  };
}

function queryFarmers(allFarmers, query = {}) {
  let result = [...allFarmers];

  // 1. Search Query
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

function getStats(db = getDB()) {
  const farmers = readAllFarmers(db);
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
    .slice(0, 8)
    .map((f) => sanitizeForVerification(f));

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
  const db = options.db || (options.dbPath ? getDB(options.dbPath) : getDB());

  // Input Size & Parsing Protection
  app.use(express.json({ limit: '5mb' }));

  // Global Rate Limiting (300 requests per 5 minutes)
  if (options.rateLimit !== false) {
    app.use('/api', rateLimit({ windowMs: 5 * 60 * 1000, max: 300 }));
  }

  if (options.serveStatic !== false) {
    app.use(express.static(__dirname));
  }

  // 1. PUBLIC ROUTES
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', app: 'kisan-card-api', database: 'sqlite3' });
  });

  app.get('/api/stats', (_req, res) => {
    res.json({ stats: getStats(db) });
  });

  // Authentication with Login Rate Limiting (15 attempts / 5 mins)
  app.post('/api/auth/login', rateLimit({ windowMs: 5 * 60 * 1000, max: 15, message: 'Too many login attempts. Please wait 5 minutes.' }), (req, res) => {
    const { username, password } = req.body || {};
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = generateToken({ username, role: 'admin' });
      return res.json({
        success: true,
        token,
        user: { username, role: 'admin' }
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid administrator username or password.',
      code: 'AUTH_FAILED'
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const user = verifyToken(token);
    if (!user) {
      return res.json({ authenticated: false });
    }
    return res.json({ authenticated: true, user });
  });

  // Public Verification Endpoint
  app.get('/api/verify/:cardNumber', (req, res) => {
    const farmer = getFarmerByCardNumber(req.params.cardNumber, db);

    if (!farmer) {
      return res.status(404).json({
        valid: false,
        error: 'Kisan Card not found. Please verify the ID number.',
        code: 'NOT_FOUND',
        verifiedAt: new Date().toISOString()
      });
    }

    return res.json({
      valid: true,
      verifiedAt: new Date().toISOString(),
      farmer: sanitizeForVerification(farmer)
    });
  });

  // 2. PROTECTED ROUTES (Admin Authentication Required)
  app.get('/api/farmers/export/csv', authMiddleware, (req, res) => {
    const allFarmers = readAllFarmers(db);
    const queryResult = queryFarmers(allFarmers, req.query);
    const csv = exportToCSV(queryResult.farmers);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kisan_card_farmers.csv"');
    res.send(csv);
  });

  // Backup & Restore Endpoints
  app.get('/api/backup/export', authMiddleware, (_req, res) => {
    const allFarmers = readAllFarmers(db);
    const backupData = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      totalRecords: allFarmers.length,
      farmers: allFarmers
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kisan_card_backup_${Date.now()}.json"`);
    res.json(backupData);
  });

  app.post('/api/backup/restore', authMiddleware, (req, res) => {
    const { farmers: incomingFarmers, mode = 'merge' } = req.body || {};
    if (!Array.isArray(incomingFarmers)) {
      return res.status(400).json({
        error: 'Invalid backup format. Expected "farmers" array.',
        code: 'INVALID_BACKUP'
      });
    }

    try {
      db.exec('BEGIN TRANSACTION');
      if (mode === 'replace') {
        db.exec('DELETE FROM farmers');
      }

      let restoredCount = 0;
      const insertOrReplace = db.prepare(`
        INSERT OR REPLACE INTO farmers (id, cardNumber, farmerName, farmerNameMr, fatherName, fatherNameMr, village, address, survey, subSurvey, area, aadhaar, status, photo, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of incomingFarmers) {
        const val = validateFarmerData(item);
        if (val.ok) {
          const norm = val.data;
          const id = Number(item.id) || Date.now() + restoredCount;
          insertOrReplace.run(
            id,
            norm.cardNumber,
            norm.farmerName,
            norm.farmerNameMr,
            norm.fatherName,
            norm.fatherNameMr,
            norm.village,
            norm.address,
            norm.survey,
            norm.subSurvey,
            norm.area,
            norm.aadhaar,
            norm.status,
            norm.photo,
            norm.createdAt
          );
          restoredCount++;
        }
      }

      db.exec('COMMIT');
      return res.json({
        success: true,
        restoredCount,
        message: `Successfully restored ${restoredCount} farmer records.`
      });
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(500).json({
        error: 'Failed to restore database: ' + err.message,
        code: 'RESTORE_FAILED'
      });
    }
  });

  app.get('/api/farmers', authMiddleware, (req, res) => {
    const allFarmers = readAllFarmers(db);
    const result = queryFarmers(allFarmers, req.query);
    res.json(result);
  });

  app.get('/api/farmers/:id', authMiddleware, (req, res) => {
    const farmer = getFarmerById(req.params.id, db);
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found', code: 'NOT_FOUND' });
    }
    return res.json({ farmer });
  });

  app.post('/api/farmers', authMiddleware, (req, res) => {
    const allFarmers = readAllFarmers(db);
    const validation = validateFarmerData(req.body || {});

    if (!validation.ok) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
    }

    const farmer = normalizeFarmerData({
      ...validation.data,
      id: Date.now(),
      cardNumber: validation.data.cardNumber || generateCardNumber(allFarmers)
    });

    insertFarmer(farmer, db);
    return res.status(201).json({ farmer });
  });

  app.put('/api/farmers/:id', authMiddleware, (req, res) => {
    const existing = getFarmerById(req.params.id, db);
    if (!existing) {
      return res.status(404).json({ error: 'Farmer not found', code: 'NOT_FOUND' });
    }

    const validation = validateFarmerData({ ...existing, ...req.body });
    if (!validation.ok) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
    }

    const updated = normalizeFarmerData({
      ...existing,
      ...validation.data,
      id: existing.id,
      createdAt: existing.createdAt || new Date().toISOString()
    });

    updateFarmerInDB(existing.id, updated, db);
    return res.json({ farmer: updated });
  });

  app.delete('/api/farmers/:id', authMiddleware, (req, res) => {
    const deleted = deleteFarmerFromDB(req.params.id, db);
    if (!deleted) {
      return res.status(404).json({ error: 'Farmer not found', code: 'NOT_FOUND' });
    }
    return res.json({ success: true, deletedId: req.params.id });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path, code: 'NOT_FOUND' });
  });

  return app;
}

module.exports = {
  createApp,
  getDB,
  readAllFarmers,
  getFarmerById,
  getFarmerByCardNumber,
  insertFarmer,
  updateFarmerInDB,
  deleteFarmerFromDB,
  generateToken,
  verifyToken,
  authMiddleware,
  ADMIN_USER,
  ADMIN_PASS,
  normalizeFarmerData,
  validateFarmerData,
  sanitizeForVerification,
  formatAadhaar,
  maskAadhaar,
  generateCardNumber,
  queryFarmers,
  getStats,
  exportToCSV
};
