const { initializeDatabase } = require('./_db.js');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    try {
      await initializeDatabase();
      initialized = true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      return res.status(500).json({ status: 'error', message: 'Database initialization failed' });
    }
  }
  res.json({ status: 'ok', service: 'HEF Portal API' });
};