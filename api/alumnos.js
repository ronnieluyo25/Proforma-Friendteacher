const { getPool } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT id, nombre FROM alumnos ORDER BY nombre ASC;');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/alumnos error:', err);
    res.status(500).json({ error: 'DB error' });
  }
};
