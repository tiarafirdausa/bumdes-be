// routes/dashboard.js (contoh baru)
const express = require('express');
const router = express.Router();
const db = require('../models/db'); // Sesuaikan dengan path koneksi DB Anda

router.get('/counts', async (req, res) => {
    try {
        const [artikelResult] = await db.query('SELECT COUNT(*) AS count FROM artikel');
        const [halamanResult] = await db.query('SELECT COUNT(*) AS count FROM halaman'); // Asumsi ada tabel 'halaman'
        const [kategoriResult] = await db.query('SELECT COUNT(*) AS count FROM kategori'); // Asumsi ada tabel 'kategori'
        const [menuResult] = await db.query('SELECT COUNT(*) AS count FROM menu');     // Asumsi ada tabel 'menu'
        const [userResult] = await db.query('SELECT COUNT(*) AS count FROM user'); // Asumsi ada tabel 'users'

        const counts = {
            artikel: artikelResult[0].count,
            halaman: halamanResult[0].count,
            kategori: kategoriResult[0].count,
            menu: menuResult[0].count,
            users: userResult[0].count
        };

        res.status(200).json(counts);
    } catch (error) {
        console.error('Error fetching dashboard counts:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard counts', details: error.message });
    }
});

module.exports = router;