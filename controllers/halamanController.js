const db = require('../models/db'); // Pastikan path ke koneksi database Anda benar
const path = require('path');
const fs = require('fs'); // Import modul fs untuk operasi file system

// Fungsi untuk membuat halaman baru
exports.createHalaman = async (req, res) => {
    try {
        const {
            judul,
            isi,
            id_modul, // Konten Modul
            meta_title,
            meta_desc,
            meta_keyw,
            id_user // ID pengguna yang membuat halaman
        } = req.body;

        // Path gambar dari req.file jika ada file diunggah
        const gambarPath = req.file ? `/public/uploads/halaman/${req.file.filename}` : null;

        // Validasi input wajib
        if (!judul || !isi || !id_user) {
            // Jika ada file diunggah, hapus karena ada error validasi
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file due to missing fields:', unlinkErr);
                });
            }
            return res.status(400).json({ error: 'Judul, isi, dan ID pengguna wajib diisi.' });
        }

        // Auto-generate judul_seo jika tidak disediakan
        let judul_seo = req.body.judul_seo;
        if (!judul_seo) {
            judul_seo = judul.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        }

        // Auto-generate hari, tanggal, jam
        const now = new Date();
        const hari = now.toLocaleDateString('id-ID', { weekday: 'long' }); // Nama hari (misal: "Senin")
        const tanggal = now.toISOString().slice(0, 10); // Format YYYY-MM-DD
        const jam = now.toTimeString().slice(0, 8); // Format HH:MM:SS

        // Default hits ke 0
        const hits = 0;

        // Masukkan halaman baru ke database
        const [result] = await db.query(
            'INSERT INTO halaman (judul, judul_seo, meta_title, meta_desc, meta_keyw, isi, id_modul, gambar, hari, tanggal, jam, id_user, hits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                judul,
                judul_seo,
                meta_title || null, // Gunakan null jika tidak disediakan
                meta_desc || null,
                meta_keyw || null,
                isi,
                id_modul || null, // Gunakan null jika tidak ada modul terkait
                gambarPath, // Menggunakan gambarPath dari req.file
                hari,
                tanggal,
                jam,
                id_user,
                hits
            ]
        );

        res.status(201).json({
            id_halaman: result.insertId,
            judul,
            judul_seo,
            meta_title,
            meta_desc,
            meta_keyw,
            isi,
            id_modul,
            gambar: gambarPath, // Kembalikan path gambar yang disimpan
            hari,
            tanggal,
            jam,
            id_user,
            hits
        });
    } catch (error) {
        console.error('Error creating halaman:', error);
        // Jika ada file diunggah, hapus jika terjadi kesalahan database
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file on DB failure:', unlinkErr);
            });
        }
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Terjadi duplikasi entri. Judul halaman atau judul SEO mungkin sudah terdaftar.', details: error.message });
        } else {
            res.status(500).json({ error: 'Gagal membuat halaman', details: error.message });
        }
    }
};

// Fungsi untuk mendapatkan semua halaman
exports.getHalamans = async (req, res) => {
    try {
        const [halamans] = await db.query(
            `SELECT
                h.id_halaman,
                h.judul,
                h.judul_seo,
                h.isi,
                h.id_modul,
                h.gambar,
                h.hari,
                h.tanggal,
                h.jam,
                h.id_user,
                h.hits,
                u.nama_lengkap AS nama_penulis
            FROM
                halaman h
            LEFT JOIN
                user u ON h.id_user = u.id_user
            ORDER BY
                h.tanggal DESC, h.jam DESC`
        );
        res.status(200).json(halamans);
    } catch (error) {
        console.error('Error fetching halamans:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar halaman', details: error.message });
    }
};

// Fungsi untuk mendapatkan halaman berdasarkan ID
exports.getHalamanById = async (req, res) => {
    try {
        const { id } = req.params;

        const [halaman] = await db.query('SELECT * FROM halaman WHERE id_halaman = ?', [id]);

        if (halaman.length === 0) {
            return res.status(404).json({ error: 'Halaman tidak ditemukan' });
        }

        // Opsional: Tingkatkan hit count setiap kali halaman dilihat
        await db.query('UPDATE halaman SET hits = hits + 1 WHERE id_halaman = ?', [id]);

        res.status(200).json(halaman[0]);
    } catch (error) {
        console.error('Error fetching halaman by ID:', error);
        res.status(500).json({ error: 'Gagal mengambil halaman', details: error.message });
    }
};

// Fungsi untuk memperbarui halaman
exports.updateHalaman = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            judul,
            judul_seo,
            meta_title,
            meta_desc,
            meta_keyw,
            isi,
            id_modul,
            // 'gambar' di body sekarang digunakan untuk sinyal frontend ingin menghapus gambar lama,
            // bukan untuk path gambar baru. Path gambar baru ada di req.file
            gambar: gambarFromBody, // Rename to avoid conflict with req.file.filename
            id_user
        } = req.body;

        const newGambarPath = req.file ? `/public/uploads/halaman/${req.file.filename}` : undefined; // Path gambar baru jika diunggah

        let updateFields = [];
        let updateValues = [];
        let responseBody = {}; // Untuk menambahkan info ke respons

        // Ambil path gambar lama dari database
        const [oldHalaman] = await db.query('SELECT gambar FROM halaman WHERE id_halaman = ?', [id]);
        const oldGambarPath = oldHalaman.length > 0 ? oldHalaman[0].gambar : null;

        // Logika untuk judul dan judul_seo (sama seperti sebelumnya)
        if (judul !== undefined) {
            const [existingJudul] = await db.query('SELECT id_halaman FROM halaman WHERE judul = ? AND id_halaman != ?', [judul, id]);
            if (existingJudul.length > 0) {
                if (req.file) { // Hapus file yang baru diunggah jika judul duplikat
                    fs.unlink(req.file.path, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting uploaded file due to duplicate title:', unlinkErr);
                    });
                }
                return res.status(409).json({ error: 'Halaman dengan judul ini sudah ada.' });
            }
            updateFields.push('judul = ?');
            updateValues.push(judul);
        }

        if (judul !== undefined && !req.body.hasOwnProperty('judul_seo')) {
            const newJudulSeo = judul.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            updateFields.push('judul_seo = ?');
            updateValues.push(newJudulSeo);
        } else if (req.body.hasOwnProperty('judul_seo')) {
            const [existingJudulSeo] = await db.query('SELECT id_halaman FROM halaman WHERE judul_seo = ? AND id_halaman != ?', [judul_seo, id]);
            if (existingJudulSeo.length > 0) {
                if (req.file) { // Hapus file yang baru diunggah jika judul_seo duplikat
                    fs.unlink(req.file.path, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting uploaded file due to duplicate SEO title:', unlinkErr);
                    });
                }
                return res.status(409).json({ error: 'Halaman dengan judul SEO ini sudah ada.' });
            }
            updateFields.push('judul_seo = ?');
            updateValues.push(judul_seo || null);
        }

        if (meta_title !== undefined) { updateFields.push('meta_title = ?'); updateValues.push(meta_title || null); }
        if (meta_desc !== undefined) { updateFields.push('meta_desc = ?'); updateValues.push(meta_desc || null); }
        if (meta_keyw !== undefined) { updateFields.push('meta_keyw = ?'); updateValues.push(meta_keyw || null); }
        if (isi !== undefined) { updateFields.push('isi = ?'); updateValues.push(isi); } // Pastikan ini tidak kosong juga
        if (id_modul !== undefined) { updateFields.push('id_modul = ?'); updateValues.push(id_modul || null); }
        if (id_user !== undefined) { updateFields.push('id_user = ?'); updateValues.push(id_user); }

        // Logika untuk gambar:
        if (req.file) { // Ada file gambar baru diunggah
            updateFields.push('gambar = ?');
            updateValues.push(newGambarPath);
            // Hapus gambar lama jika ada dan merupakan gambar yang diupload
            if (oldGambarPath && oldGambarPath.startsWith('/public/uploads/halaman')) {
                const fullOldPath = path.join(__dirname, '..', oldGambarPath);
                if (fs.existsSync(fullOldPath)) {
                    fs.unlink(fullOldPath, (unlinkErr) => {
                        if (unlinkErr) console.error('Gagal menghapus gambar lama:', fullOldPath, unlinkErr);
                        else console.log('Gambar lama dihapus:', fullOldPath);
                    });
                }
            }
        } else if (gambarFromBody !== undefined && (gambarFromBody === null || gambarFromBody === '')) { // Frontend secara eksplisit ingin menghapus gambar
            updateFields.push('gambar = ?');
            updateValues.push(null);
            responseBody.image_cleared = true; // Tambahkan info ke respons
            // Hapus gambar lama dari sistem file
            if (oldGambarPath && oldGambarPath.startsWith('/public/uploads/halaman')) {
                const fullOldPath = path.join(__dirname, '..', oldGambarPath);
                if (fs.existsSync(fullOldPath)) {
                    fs.unlink(fullOldPath, (unlinkErr) => {
                        if (unlinkErr) console.error('Gagal menghapus gambar lama:', fullOldPath, unlinkErr);
                        else console.log('Gambar lama dihapus:', fullOldPath);
                    });
                }
            }
        }
        // Jika req.file tidak ada dan gambarFromBody juga tidak ada/undefined, berarti gambar tidak diubah.

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang disediakan untuk diperbarui.' });
        }

        const query = `UPDATE halaman SET ${updateFields.join(', ')} WHERE id_halaman = ?`;
        updateValues.push(id);

        const [result] = await db.query(query, updateValues);

        if (result.affectedRows === 0) {
            // Jika tidak ada perubahan, hapus file yang baru diunggah (jika ada)
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file after no DB change:', unlinkErr);
                });
            }
            return res.status(404).json({ error: 'Halaman tidak ditemukan atau tidak ada perubahan yang dilakukan.' });
        }

        res.status(200).json({ message: 'Halaman berhasil diperbarui', new_image_path: newGambarPath, ...responseBody });
    } catch (error) {
        console.error('Error updating halaman:', error);
        // Jika ada file diunggah, hapus jika terjadi kesalahan database
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file on DB failure:', unlinkErr);
            });
        }
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Terjadi duplikasi entri. Judul halaman atau judul SEO mungkin sudah terdaftar.', details: error.message });
        } else {
            res.status(500).json({ error: 'Gagal memperbarui halaman', details: error.message });
        }
    }
};

// Fungsi untuk menghapus halaman
exports.deleteHalaman = async (req, res) => {
    try {
        const { id } = req.params;

        // Ambil path gambar sebelum menghapus record dari database
        const [halaman] = await db.query('SELECT gambar FROM halaman WHERE id_halaman = ?', [id]);
        const gambarPathToDelete = halaman.length > 0 ? halaman[0].gambar : null;

        const [result] = await db.query('DELETE FROM halaman WHERE id_halaman = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Halaman tidak ditemukan' });
        }

        // Jika ada gambar yang terkait dan itu adalah gambar yang diunggah
        if (gambarPathToDelete && gambarPathToDelete.startsWith('/public/uploads/halaman')) {
            const fullPath = path.join(__dirname, '..', gambarPathToDelete);
            if (fs.existsSync(fullPath)) {
                fs.unlink(fullPath, (err) => {
                    if (err) console.error('Gagal menghapus file gambar halaman:', fullPath, err);
                    else console.log('File gambar halaman dihapus:', fullPath);
                });
            }
        }

        res.status(200).json({ message: 'Halaman berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting halaman:', error);
        res.status(500).json({ error: 'Gagal menghapus halaman', details: error.message });
    }
};