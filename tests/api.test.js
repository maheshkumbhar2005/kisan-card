const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp, normalizeFarmerData, validateFarmerData } = require('../api');

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

test('validateFarmerData rejects missing required fields', () => {
  const result = validateFarmerData({
    farmerName: '',
    fatherName: 'Suresh'
  });

  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.some((err) => err.includes('farmerName')));
});

test('createApp exposes an API endpoint and health route', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);

    const json = await healthResponse.json();
    assert.equal(json.status, 'ok');

    const listResponse = await fetch(`${baseUrl}/api/farmers`);
    assert.equal(listResponse.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
