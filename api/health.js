const { getPool } = require('./_db');

module.exports = async (_req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT 1 AS ok');
    res.status(200).json({ ok: true, envHasUrl: !!process.env.NEON_DATABASE_URL2, ping: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, envHasUrl: !!process.env.NEON_DATABASE_URL2, error: String(e.message || e) });
  }

};
