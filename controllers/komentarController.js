// controllers/komentarController.js
const db = require('../models/db');

exports.addComment = async (req, res) => {
    const { nama, email, komentar, id_artikel } = req.body; // Ambil data dari body request

    // Validasi sederhana
    if (!nama || !email || !komentar || !id_artikel) {
        return res.status(400).json({ error: 'Nama, email, komentar, dan ID artikel wajib diisi.' });
    }

    try {
        const query = `
            INSERT INTO komentar (nama, email, komentar, tanggal,id_artikel, dibaca)
            VALUES (?, ?, ?, CURDATE(), ?, 'N')
        `;
        const values = [nama, email, komentar, id_artikel];

        const [result] = await db.query(query, values);

        if (result.affectedRows === 1) {
            // Mengembalikan komentar yang baru ditambahkan (atau sebagian datanya)
            res.status(201).json({
                message: 'Komentar berhasil ditambahkan',
                id_komentar: result.insertId,
                nama,
                email,
                komentar,
                tanggal: new Date().toISOString().split('T')[0], // Contoh tanggal hari ini
                jam: new Date().toTimeString().split(' ')[0], // Contoh jam saat ini
                id_artikel,
                dibaca: 'N'
            });
        } else {
            res.status(500).json({ error: 'Gagal menambahkan komentar' });
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server saat menambahkan komentar', details: error.message });
    }
};

exports.getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT *
            FROM komentar WHERE id_artikel = ? 
            ORDER BY tanggal
        `;

        const [comments] = await db.query(query, [id]);
        res.status(200).json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar komentar', details: error.message });
    }
};

exports.getAllComments = async (req, res) => {
    try {
        const [komentar] = await db.query(`
            SELECT 
                k.*,
                a.judul as judul
            FROM 
                komentar  k
            LEFT JOIN
                artikel a ON k.id_artikel = a.id_artikel
            ORDER BY 
                k.tanggal DESC
            `);
        res.status(200).json(komentar);
    } catch (error) {
        console.error('Error fetching komentar:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar komentar', details: error.message });
    }
};

exports.deleteComment = async (req, res) => {
    const { id } = req.params; 

    try {
        const query = `
            DELETE FROM komentar
            WHERE id_komentar = ?
        `;
        const [result] = await db.query(query, [id]);

        if (result.affectedRows === 1) {
            res.status(200).json({ message: 'Komentar berhasil dihapus.' });
        } else {
            res.status(404).json({ error: 'Komentar tidak ditemukan atau gagal dihapus.' });
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server saat menghapus komentar', details: error.message });
    }
};