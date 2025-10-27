const { getPool } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT id, nombre FROM public.tutores ORDER BY nombre ASC;');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/tutores:', err);
    res.status(500).json({ error: 'DB error', detail: String(err.message || err) });
  }
};
