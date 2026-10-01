const { createApp } = require('./api');

const app = createApp({ serveStatic: true });
const port = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
  console.error('Server Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Server Unhandled Rejection:', reason);
});

const server = app.listen(port, () => {
  console.log(`Kisan Card running on http://localhost:${port}`);
});


