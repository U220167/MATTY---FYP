require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { runMigrations } = require('./runMigrations');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json());

app.use('/api/v1', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
});

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log('Server listening on port', PORT);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
