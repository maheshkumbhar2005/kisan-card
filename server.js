const path = require('node:path');
const { createApp } = require('./api');

const app = createApp();
const port = process.env.PORT || 3000;

// Serve frontend static files
app.use(require('express').static(path.join(__dirname)));

app.listen(port, () => {
  console.log(`Kisan Card running on http://localhost:${port}`);
});
