const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createApp,
  normalizeFarmerData,
  validateFarmerData,
  formatAadhaar,
  generateCardNumber
} = require('../api');

// ---------------------------------------------------------------------------
// Utility function tests
// ---------------------------------------------------------------------------

test('formatAadhaar formats 12 digits with spaces', () => {
  assert.equal(formatAadhaar('123456789012'), '1234 5678 9012');
});

test('formatAadhaar handles short input', () => {
  assert.equal(formatAadhaar('1234'), '1234');
});

test('formatAadhaar strips non-digit characters', () => {
  assert.equal(formatAadhaar('1234-5678-9012'), '1234 5678 9012');
});

test('formatAadhaar returns empty string for empty input', () => {
  assert.equal(formatAadhaar(''), '');
  assert.equal(formatAadhaar(null), '');
  assert.equal(formatAadhaar(undefined), '');
});

test('generateCardNumber returns KC-1001 for empty list', () => {
  assert.equal(generateCardNumber([]), 'KC-1001');
});

test('generateCardNumber increments from highest existing number', () => {
  const existing = [
    { cardNumber: 'KC-1001' },
    { cardNumber: 'KC-1005' }
  ];
  assert.equal(generateCardNumber(existing), 'KC-1006');
});

// ---------------------------------------------------------------------------
// normalizeFarmerData tests
// ---------------------------------------------------------------------------

test('normalizeFarmerData fills defaults and formats values', () => {
  const data = normalizeFarmerData({
    farmerName: 'Ramesh',
    fatherName: 'Suresh',
    village: 'Takarkheda',
    aadhaar: '123456789012'
  });

  assert.equal(data.farmerName, 'Ramesh');
  assert.equal(data.fatherName, 'Suresh');
  assert.equal(data.village, 'Takarkheda');
  assert.equal(data.aadhaar, '1234 5678 9012');
  assert.equal(data.cardNumber, 'KC-1001');
  assert.equal(data.status, 'active');
});

test('normalizeFarmerData trims whitespace', () => {
  const data = normalizeFarmerData({
    farmerName: '  Ramesh  ',
    fatherName: '  Suresh  ',
    address: '  Main Road  '
  });

  assert.equal(data.farmerName, 'Ramesh');
  assert.equal(data.fatherName, 'Suresh');
  assert.equal(data.address, 'Main Road');
});

test('normalizeFarmerData accepts aadhaarNumber alias', () => {
  const data = normalizeFarmerData({ aadhaarNumber: '111122223333' });
  assert.equal(data.aadhaar, '1111 2222 3333');
});

// ---------------------------------------------------------------------------
// validateFarmerData tests
// ---------------------------------------------------------------------------

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
  assert.ok(result.errors.some((err) => err.includes('address')));
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

// ---------------------------------------------------------------------------
// API endpoint tests
// ---------------------------------------------------------------------------

test('GET /health returns ok', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.status, 'ok');
    assert.equal(json.app, 'kisan-card-api');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/farmers returns a list', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/farmers`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(Array.isArray(json.farmers));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('POST /api/farmers creates a farmer', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const res = await fetch(`${base}/api/farmers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmerName: 'Ramesh',
        fatherName: 'Suresh',
        village: 'Takarkheda',
        address: 'Main Road'
      })
    });

    assert.equal(res.status, 201);

    const json = await res.json();
    assert.equal(json.farmer.farmerName, 'Ramesh');
    assert.ok(json.farmer.id);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('POST /api/farmers rejects missing required fields', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/farmers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmerName: '' })
    });

    assert.equal(res.status, 400);

    const json = await res.json();
    assert.ok(json.errors.length > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/farmers/:id returns 404 for non-existent farmer', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/farmers/999999`);
    assert.equal(res.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('PUT /api/farmers/:id returns 404 for non-existent farmer', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/farmers/999999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmerName: 'Updated' })
    });

    assert.equal(res.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('DELETE /api/farmers/:id returns 404 for non-existent farmer', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/farmers/999999`, {
      method: 'DELETE'
    });

    assert.equal(res.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Full CRUD lifecycle: create, read, update, delete', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    // Create
    const createRes = await fetch(`${base}/api/farmers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    // Read
    const readRes = await fetch(`${base}/api/farmers/${id}`);
    assert.equal(readRes.status, 200);
    const readJson = await readRes.json();
    assert.equal(readJson.farmer.farmerName, 'Ganesh');

    // Update
    const updateRes = await fetch(`${base}/api/farmers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmerName: 'Ganesh Patil' })
    });
    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.farmer.farmerName, 'Ganesh Patil');

    // Delete
    const deleteRes = await fetch(`${base}/api/farmers/${id}`, {
      method: 'DELETE'
    });
    assert.equal(deleteRes.status, 200);
    const deleteJson = await deleteRes.json();
    assert.equal(deleteJson.success, true);

    // Verify deleted
    const verifyRes = await fetch(`${base}/api/farmers/${id}`);
    assert.equal(verifyRes.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
