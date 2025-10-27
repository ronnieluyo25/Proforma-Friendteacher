const { Pool } = require('pg');

let _pool;
function getPool() {
  if (!_pool) {
    const cs = process.env.NEON_DATABASE_URL2;
    if (!cs) throw new Error('NEON_DATABASE_URL2 not set');

    _pool = new Pool({
      connectionString: cs,
      // Recomendado para Neon desde Vercel
      ssl: { rejectUnauthorized: false }
    });
  }
  return _pool;
}

module.exports = { getPool };
