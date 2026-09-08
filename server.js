const { createApp } = require('./api');

const app = createApp();
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Kisan Card API running on http://localhost:${port}`);
});
