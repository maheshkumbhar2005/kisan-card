const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {
  createApp,
  getDB,
  generateToken,
  verifyToken,
  ADMIN_USER,
  ADMIN_PASS,
  normalizeFarmerData,
  validateFarmerData,
  sanitizeForVerification,
  formatAadhaar,
  maskAadhaar,
  generateCardNumber,
  queryFarmers,
  exportToCSV
} = require('../api');

// In-Memory SQLite DB instance for tests
const testDbPath = ':memory:';

test('formatAadhaar formats 12 digits with spaces', () => {
  assert.equal(formatAadhaar('123456789012'), '1234 5678 9012');
});

test('formatAadhaar handles short input', () => {
  assert.equal(formatAadhaar('12345'), '1234 5');
});

test('formatAadhaar strips non-digit characters', () => {
  assert.equal(formatAadhaar('12a34-56b78 9012'), '1234 5678 9012');
});

test('maskAadhaar masks first 8 digits', () => {
  assert.equal(maskAadhaar('123456789012'), 'XXXX XXXX 9012');
  assert.equal(maskAadhaar('1234 5678 9012'), 'XXXX XXXX 9012');
});

test('generateCardNumber increments from highest existing number', () => {
  const farmers = [{ cardNumber: 'KC-1001' }, { cardNumber: 'KC-1045' }];
  assert.equal(generateCardNumber(farmers), 'KC-1046');
});

test('strong validation rejects short farmerName or invalid characters', () => {
  const shortName = validateFarmerData({ farmerName: 'A', fatherName: 'Suresh', village: 'Takarkheda', address: 'Main Road' });
  assert.equal(shortName.ok, false);
  assert.ok(shortName.errors.some((e) => e.includes('between 2 and 100 characters')));
});

test('strong validation rejects invalid 10-digit aadhaar', () => {
  const badAadhaar = validateFarmerData({
    farmerName: 'Ramesh',
    fatherName: 'Suresh',
    village: 'Takarkheda',
    address: 'Main Road',
    aadhaar: '1234567890' // only 10 digits
  });
  assert.equal(badAadhaar.ok, false);
  assert.ok(badAadhaar.errors.some((e) => e.includes('exactly 12 digits')));
});

test('strong validation accepts valid 12-digit aadhaar and positive area', () => {
  const valid = validateFarmerData({
    farmerName: 'Ramesh',
    fatherName: 'Suresh',
    village: 'Takarkheda',
    address: 'Main Road',
    aadhaar: '123456789012',
    area: '2.45'
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.errors.length, 0);
});

test('sanitizeForVerification safely masks aadhaar and retains non-sensitive fields', () => {
  const sanitized = sanitizeForVerification({
    cardNumber: 'KC-1001',
    farmerName: 'Ramesh Patil',
    fatherName: 'Suresh Patil',
    village: 'Takarkheda',
    address: 'Main Road',
    aadhaar: '123456789012',
    area: '2.5',
    status: 'active'
  });

  assert.equal(sanitized.cardNumber, 'KC-1001');
  assert.equal(sanitized.farmerName, 'Ramesh Patil');
  assert.equal(sanitized.maskedAadhaar, 'XXXX XXXX 9012');
  assert.equal(sanitized.aadhaar, undefined);
  assert.equal(sanitized.isVerified, true);
});

test('generateToken and verifyToken generate and validate secure auth tokens', () => {
  const token = generateToken({ username: 'admin', role: 'admin' });
  assert.ok(typeof token === 'string');
  assert.equal(token.split('.').length, 3);

  const payload = verifyToken(token);
  assert.ok(payload);
  assert.equal(payload.username, 'admin');
  assert.equal(payload.role, 'admin');

  assert.equal(verifyToken('invalid.token.payload'), null);
});

test('exportToCSV generates valid CSV string', () => {
  const farmers = [
    { id: 1, cardNumber: 'KC-1001', farmerName: 'Ramesh', fatherName: 'Suresh', village: 'Takarkheda', area: '1.5' }
  ];
  const csv = exportToCSV(farmers);
  assert.ok(csv.includes('Farmer Name (EN)'));
  assert.ok(csv.includes('Ramesh'));
  assert.ok(csv.includes('KC-1001'));
});

// API HTTP Route Tests with SQLite Backend
test('GET /health returns SQLite database status', async () => {
  const app = createApp({ serveStatic: false, dbPath: ':memory:', rateLimit: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;

    const res = await fetch(base + '/health');
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.status, 'ok');
    assert.equal(json.database, 'sqlite3');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('POST /api/auth/login authenticates admin and rejects invalid password', async () => {
  const app = createApp({ serveStatic: false, dbPath: ':memory:', rateLimit: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;

    const res = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.token);

    const badRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: 'wrongpassword' })
    });
    assert.equal(badRes.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('SQLite CRUD operations with atomic transactions & validation', async () => {
  const app = createApp({ serveStatic: false, dbPath: ':memory:', rateLimit: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;
    const token = generateToken({ username: 'admin' });
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 1. Create Farmer
    const createRes = await fetch(base + '/api/farmers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        farmerName: 'Balasaheb Patil',
        fatherName: 'Ramchandra Patil',
        village: 'Takarkheda',
        address: 'Plot 10',
        aadhaar: '123456789012',
        area: '3.50'
      })
    });
    assert.equal(createRes.status, 201);
    const { farmer } = await createRes.json();
    assert.equal(farmer.farmerName, 'Balasaheb Patil');
    assert.ok(farmer.id);

    // 2. Read by ID
    const readRes = await fetch(base + '/api/farmers/' + farmer.id, { headers: authHeaders });
    assert.equal(readRes.status, 200);
    const readJson = await readRes.json();
    assert.equal(readJson.farmer.farmerName, 'Balasaheb Patil');

    // 3. Public Verification
    const verifyRes = await fetch(base + '/api/verify/' + farmer.cardNumber);
    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.valid, true);
    assert.equal(verifyJson.farmer.maskedAadhaar, 'XXXX XXXX 9012');

    // 4. Update
    const updateRes = await fetch(base + '/api/farmers/' + farmer.id, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ farmerName: 'Balasaheb R. Patil' })
    });
    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.farmer.farmerName, 'Balasaheb R. Patil');

    // 5. Delete
    const deleteRes = await fetch(base + '/api/farmers/' + farmer.id, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert.equal(deleteRes.status, 200);

    // Verify deleted
    const verifyDeleted = await fetch(base + '/api/farmers/' + farmer.id, { headers: authHeaders });
    assert.equal(verifyDeleted.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Backup export and restore API endpoints', async () => {
  const app = createApp({ serveStatic: false, dbPath: ':memory:', rateLimit: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;
    const token = generateToken({ username: 'admin' });
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Restore dataset
    const backupPayload = {
      farmers: [
        { id: 101, cardNumber: 'KC-2001', farmerName: 'Farmer One', fatherName: 'Father One', village: 'Village A', address: 'Addr 1' },
        { id: 102, cardNumber: 'KC-2002', farmerName: 'Farmer Two', fatherName: 'Father Two', village: 'Village B', address: 'Addr 2' }
      ]
    };

    const restoreRes = await fetch(base + '/api/backup/restore', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(backupPayload)
    });
    assert.equal(restoreRes.status, 200);
    const restoreJson = await restoreRes.json();
    assert.equal(restoreJson.success, true);
    assert.equal(restoreJson.restoredCount, 2);

    // Export dataset
    const exportRes = await fetch(base + '/api/backup/export', { headers: authHeaders });
    assert.equal(exportRes.status, 200);
    const exportJson = await exportRes.json();
    assert.equal(exportJson.totalRecords, 2);
    assert.equal(exportJson.farmers[0].farmerName, 'Farmer Two'); // Ordered by id DESC
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
