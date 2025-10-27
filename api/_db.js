const { Pool } = require('pg');

let _pool;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return _pool;
}

module.exports = { getPool };