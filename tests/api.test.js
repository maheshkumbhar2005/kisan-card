const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createApp,
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

test('formatAadhaar formats 12 digits with spaces', () => {
  assert.equal(formatAadhaar('123456789012'), '1234 5678 9012');
});

test('formatAadhaar handles short input', () => {
  assert.equal(formatAadhaar('12345'), '1234 5');
});

test('formatAadhaar strips non-digit characters', () => {
  assert.equal(formatAadhaar('12a34-56b78 9012'), '1234 5678 9012');
});

test('formatAadhaar returns empty string for empty input', () => {
  assert.equal(formatAadhaar(''), '');
  assert.equal(formatAadhaar(null), '');
});

test('maskAadhaar masks first 8 digits', () => {
  assert.equal(maskAadhaar('123456789012'), 'XXXX XXXX 9012');
  assert.equal(maskAadhaar('1234 5678 9012'), 'XXXX XXXX 9012');
});

test('generateCardNumber returns KC-1001 for empty list', () => {
  assert.equal(generateCardNumber([]), 'KC-1001');
});

test('generateCardNumber increments from highest existing number', () => {
  const farmers = [{ cardNumber: 'KC-1001' }, { cardNumber: 'KC-1045' }];
  assert.equal(generateCardNumber(farmers), 'KC-1046');
});

test('normalizeFarmerData fills defaults and formats values', () => {
  const normalized = normalizeFarmerData({
    farmerName: '  Ramesh  ',
    fatherName: ' Suresh ',
    village: 'Takarkheda',
    address: 'Main Road',
    aadhaar: '123456789012'
  });

  assert.equal(normalized.farmerName, 'Ramesh');
  assert.equal(normalized.fatherName, 'Suresh');
  assert.equal(normalized.aadhaar, '1234 5678 9012');
  assert.equal(normalized.status, 'active');
  assert.equal(normalized.cardNumber, 'KC-1001');
});

test('normalizeFarmerData trims whitespace', () => {
  const data = normalizeFarmerData({ farmerName: '  John  ', fatherName: '  Doe  ' });
  assert.equal(data.farmerName, 'John');
  assert.equal(data.fatherName, 'Doe');
});

test('normalizeFarmerData accepts aadhaarNumber alias', () => {
  const data = normalizeFarmerData({ aadhaarNumber: '111122223333' });
  assert.equal(data.aadhaar, '1111 2222 3333');
});

test('validateFarmerData rejects missing required fields', () => {
  const result = validateFarmerData({
    farmerName: '',
    fatherName: 'Suresh'
  });

  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.some((err) => err.includes('farmerName')));
});

test('validateFarmerData rejects missing village and address', () => {
  const result = validateFarmerData({
    farmerName: 'Ramesh',
    fatherName: 'Suresh'
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes('village')));
  assert.equal(result.errors.some((err) => err.includes('address')), true);
});

test('validateFarmerData passes with all required fields', () => {
  const result = validateFarmerData({
    farmerName: 'Ramesh',
    fatherName: 'Suresh',
    village: 'Takarkheda',
    address: 'Main Road'
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
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

// Advanced Query, Search, Filter & Pagination Unit Tests
test('queryFarmers filters by search name, village, or card number', () => {
  const sample = [
    { id: 1, cardNumber: 'KC-1001', farmerName: 'Ramesh Patil', village: 'Takarkheda', status: 'active' },
    { id: 2, cardNumber: 'KC-1002', farmerName: 'Suresh Deshmukh', village: 'Wadgaon', status: 'active' },
    { id: 3, cardNumber: 'KC-1003', farmerName: 'Ganesh Jadhav', village: 'Takarkheda', status: 'inactive' }
  ];

  const byName = queryFarmers(sample, { search: 'ramesh' });
  assert.equal(byName.farmers.length, 1);
  assert.equal(byName.farmers[0].cardNumber, 'KC-1001');

  const byCard = queryFarmers(sample, { search: 'KC-1002' });
  assert.equal(byCard.farmers.length, 1);
  assert.equal(byCard.farmers[0].farmerName, 'Suresh Deshmukh');

  const byVillageSearch = queryFarmers(sample, { search: 'Takarkheda' });
  assert.equal(byVillageSearch.farmers.length, 2);
});

test('queryFarmers filters by village and status dropdown', () => {
  const sample = [
    { id: 1, cardNumber: 'KC-1001', farmerName: 'Ramesh', village: 'Takarkheda', status: 'active' },
    { id: 2, cardNumber: 'KC-1002', farmerName: 'Suresh', village: 'Wadgaon', status: 'active' },
    { id: 3, cardNumber: 'KC-1003', farmerName: 'Ganesh', village: 'Takarkheda', status: 'inactive' }
  ];

  const villageFilter = queryFarmers(sample, { village: 'Takarkheda' });
  assert.equal(villageFilter.farmers.length, 2);

  const statusFilter = queryFarmers(sample, { status: 'inactive' });
  assert.equal(statusFilter.farmers.length, 1);
  assert.equal(statusFilter.farmers[0].farmerName, 'Ganesh');
});

test('queryFarmers sorts by name and area ascending/descending', () => {
  const sample = [
    { id: 1, cardNumber: 'KC-1001', farmerName: 'Balu', area: '3.5', createdAt: '2026-01-01' },
    { id: 2, cardNumber: 'KC-1002', farmerName: 'Anil', area: '1.2', createdAt: '2026-01-02' },
    { id: 3, cardNumber: 'KC-1003', farmerName: 'Chetan', area: '5.0', createdAt: '2026-01-03' }
  ];

  const sortNameAsc = queryFarmers(sample, { sortBy: 'farmerName', sortOrder: 'asc' });
  assert.equal(sortNameAsc.farmers[0].farmerName, 'Anil');
  assert.equal(sortNameAsc.farmers[2].farmerName, 'Chetan');

  const sortAreaDesc = queryFarmers(sample, { sortBy: 'area', sortOrder: 'desc' });
  assert.equal(sortAreaDesc.farmers[0].farmerName, 'Chetan');
  assert.equal(sortAreaDesc.farmers[2].farmerName, 'Anil');
});

test('queryFarmers handles pagination correctly', () => {
  const sample = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    cardNumber: `KC-${1000 + i}`,
    farmerName: `Farmer ${i + 1}`,
    village: 'Takarkheda',
    status: 'active'
  }));

  const page1 = queryFarmers(sample, { page: 1, limit: 10 });
  assert.equal(page1.farmers.length, 10);
  assert.equal(page1.total, 25);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.page, 1);

  const page3 = queryFarmers(sample, { page: 3, limit: 10 });
  assert.equal(page3.farmers.length, 5);
  assert.equal(page3.page, 3);
});

// API HTTP Route Tests
test('GET /health returns ok', async () => {
  const app = createApp({ serveStatic: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;

    const res = await fetch(base + '/health');
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.status, 'ok');
    assert.equal(json.app, 'kisan-card-api');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('POST /api/auth/login authenticates admin and rejects invalid password', async () => {
  const app = createApp({ serveStatic: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;

    // Successful login
    const res = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.token);
    assert.equal(json.user.username, ADMIN_USER);

    // Failed login
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

test('GET /api/stats returns system statistics without token', async () => {
  const app = createApp({ serveStatic: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const res = await fetch('http://127.0.0.1:' + port + '/api/stats');
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(typeof json.stats.totalFarmers === 'number');
    assert.ok(typeof json.stats.totalVillages === 'number');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/verify/:cardNumber returns verified sanitized profile publicly', async () => {
  const app = createApp({ serveStatic: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;
    const token = generateToken({ username: 'admin' });

    // Create a farmer with unique card number to verify
    const createRes = await fetch(base + '/api/farmers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        cardNumber: 'KC-8899',
        farmerName: 'Kailash Patil',
        fatherName: 'Pandurang Patil',
        village: 'Amravati',
        address: 'Farm House #4',
        aadhaar: '987654321098'
      })
    });
    assert.equal(createRes.status, 201);
    const { farmer } = await createRes.json();

    // Verify by Card Number (no auth token required)
    const verifyRes = await fetch(base + '/api/verify/' + farmer.cardNumber);
    assert.equal(verifyRes.status, 200);

    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.valid, true);
    assert.equal(verifyJson.farmer.farmerName, 'Kailash Patil');
    assert.equal(verifyJson.farmer.maskedAadhaar, 'XXXX XXXX 1098');
    assert.equal(verifyJson.farmer.aadhaar, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Protected routes reject unauthenticated requests (401)', async () => {
  const app = createApp({ serveStatic: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;

    const listRes = await fetch(base + '/api/farmers');
    assert.equal(listRes.status, 401);

    const postRes = await fetch(base + '/api/farmers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmerName: 'Test' })
    });
    assert.equal(postRes.status, 401);

    const csvRes = await fetch(base + '/api/farmers/export/csv');
    assert.equal(csvRes.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Protected routes allow authenticated requests with Bearer token', async () => {
  const app = createApp({ serveStatic: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;
    const token = generateToken({ username: 'admin' });

    const listRes = await fetch(base + '/api/farmers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(Array.isArray(listJson.farmers));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Full CRUD lifecycle: create, read, update, delete with Admin Auth', async () => {
  const app = createApp({ serveStatic: false });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;
    const token = generateToken({ username: 'admin' });
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const createRes = await fetch(base + '/api/farmers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        farmerName: 'Ganesh',
        fatherName: 'Mahesh',
        village: 'Wadgaon',
        address: 'Near Temple'
      })
    });
    assert.equal(createRes.status, 201);
    const { farmer } = await createRes.json();
    const id = farmer.id;

    const readRes = await fetch(base + '/api/farmers/' + id, { headers: authHeaders });
    assert.equal(readRes.status, 200);
    const readJson = await readRes.json();
    assert.equal(readJson.farmer.farmerName, 'Ganesh');

    const updateRes = await fetch(base + '/api/farmers/' + id, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ farmerName: 'Ganesh Patil' })
    });
    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.farmer.farmerName, 'Ganesh Patil');

    const deleteRes = await fetch(base + '/api/farmers/' + id, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert.equal(deleteRes.status, 200);
    const deleteJson = await deleteRes.json();
    assert.equal(deleteJson.success, true);

    const verifyRes = await fetch(base + '/api/farmers/' + id, { headers: authHeaders });
    assert.equal(verifyRes.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
