const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

exports.createGaleriEntry = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Tidak ada file media yang diunggah.' });
    }

    const { judul, deskripsi, id_user } = req.body;

    if (!judul || judul.trim() === '') {
        req.files.forEach(file => {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`Error menghapus file ${file.path}:`, unlinkErr);
                }
            });
        });
        return res.status(400).json({ error: 'Judul galeri wajib diisi.' });
    }

    const slug = generateSlug(judul);
    let finalSlug = slug;

    try {
        const now = new Date();
        const tanggal = now.toISOString().slice(0, 10);

        const [existingSlugs] = await db.query("SELECT id FROM galeri WHERE slug = ?", [slug]);
        if (existingSlugs.length > 0) {
            finalSlug = `${slug}-${Date.now()}`; 
            console.warn(`Generated slug '${slug}' already exists. Using unique slug: '${finalSlug}'`);
        }

        const [resultGaleri] = await db.query(
            "INSERT INTO galeri (judul, tanggal, user_id, deskripsi, slug) VALUES (?, ?, ?, ?, ?)",
            [judul, tanggal, id_user, deskripsi || null, finalSlug]
        );
        const galeri_id_baru = resultGaleri.insertId;

        const mediaPromises = req.files.map(async (file, index) => {
            const media_path = `/uploads/galeri/${file.filename}`;
            let media_type;

            if (file.mimetype.startsWith('image/')) {
                media_type = 'image';
            } else if (file.mimetype.startsWith('video/')) {
                media_type = 'video';
            } else {
                media_type = 'unknown'; 
            }

            await db.query(
                "INSERT INTO galeri_media (galeri_id, media_path, media_type, order_index) VALUES (?, ?, ?, ?)",
                [galeri_id_baru, media_path, media_type, index]
            );

            return {
                media_id: galeri_id_baru, 
                media_path: media_path,
                media_type: media_type,
                order_index: index
            };
        });

        const mediaUntukDatabase = await Promise.all(mediaPromises);

        res.status(201).json({
            message: "Entri galeri dan media berhasil ditambahkan.",
            id_galeri: galeri_id_baru,
            judul: judul,
            tanggal: tanggal,
            deskripsi: deskripsi || null,
            slug: finalSlug,
            media: mediaUntukDatabase,
        });

    } catch (error) {
        console.error("Error membuat entri galeri:", error);

        req.files.forEach(file => {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`Error menghapus file ${file.path} saat kegagalan DB:`, unlinkErr);
                }
            });
        });

        res.status(500).json({
            error: "Gagal membuat entri galeri",
            details: error.message
        });
    }
};


exports.getAllGaleriEntries = async (req, res) => {
    try {
        const [galeriEntries] = await db.query("SELECT id, judul, tanggal, user_id, deskripsi, slug FROM galeri ORDER BY tanggal DESC");
        if (galeriEntries.length === 0) {
            return res.status(200).json([]);
        }

        const [allMedia] = await db.query("SELECT id, galeri_id, media_path, media_type, order_index FROM galeri_media ORDER BY galeri_id, order_index");

        const mediaMap = new Map();
        allMedia.forEach(media => {
            if (!mediaMap.has(media.galeri_id)) {
                mediaMap.set(media.galeri_id, []);
            }
            mediaMap.get(media.galeri_id).push({
                id: media.id,
                media_path: media.media_path,
                media_type: media.media_type,
                order_index: media.order_index
            });
        });

        const responseData = galeriEntries.map(entry => ({
            ...entry,
            media: mediaMap.get(entry.id) || []
        }));

        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error mendapatkan daftar entri galeri:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar entri galeri",
            details: error.message,
        });
    }
};


exports.getGaleriEntryById = async (req, res) => {
    try {
        const { id } = req.params;

        const [galeriEntry] = await db.query("SELECT id, judul, tanggal, user_id, deskripsi, slug FROM galeri WHERE id = ?", [id]);

        if (galeriEntry.length === 0) {
            return res.status(404).json({ error: "Entri galeri tidak ditemukan." });
        }

        const [mediaFiles] = await db.query(
            "SELECT id, media_path, media_type, order_index FROM galeri_media WHERE galeri_id = ? ORDER BY order_index",
            [id]
        );

        const responseData = {
            ...galeriEntry[0],
            media: mediaFiles
        };

        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error mendapatkan entri galeri berdasarkan ID:", error);
        res.status(500).json({
            error: "Gagal mengambil entri galeri",
            details: error.message,
        });
    }
};

exports.getGaleriEntryBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const [galeriEntry] = await db.query("SELECT id, judul, tanggal, user_id, deskripsi, slug FROM galeri WHERE slug = ?", [slug]);

        if (galeriEntry.length === 0) {
            return res.status(404).json({ error: "Entri galeri tidak ditemukan berdasarkan slug." });
        }

        const galeriId = galeriEntry[0].id;
        const [mediaFiles] = await db.query(
            "SELECT id, media_path, media_type, order_index FROM galeri_media WHERE galeri_id = ? ORDER BY order_index",
            [galeriId]
        );

        const responseData = {
            ...galeriEntry[0],
            media: mediaFiles
        };

        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error mendapatkan entri galeri berdasarkan slug:", error);
        res.status(500).json({
            error: "Gagal mengambil entri galeri berdasarkan slug",
            details: error.message,
        });
    }
};


exports.updateGaleriEntry = async (req, res) => {
    const { id } = req.params;
    const { judul, deskripsi, id_user } = req.body;

    const newFiles = req.files || [];

    if (judul === undefined || judul.trim() === '') {
        newFiles.forEach(file => {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`Error menghapus file ${file.path}:`, unlinkErr);
                }
            });
        });
        return res.status(400).json({ error: "Judul tidak boleh kosong." });
    }

    try {
        const newSlug = generateSlug(judul);
        let finalSlug = newSlug;

        const [existingSlugs] = await db.query("SELECT id FROM galeri WHERE slug = ? AND id != ?", [newSlug, id]);
        if (existingSlugs.length > 0) {
            finalSlug = `${newSlug}-${Date.now()}`;
            console.warn(`Generated slug '${newSlug}' already exists for another entry. Using unique slug: '${finalSlug}'`);
        }

        const updates = { judul: judul, slug: finalSlug };
        const params = [judul, finalSlug];

        if (deskripsi !== undefined) {
            updates.deskripsi = deskripsi;
            params.push(deskripsi);
        }

        if (id_user !== undefined) {
            updates.user_id = id_user;
            params.push(id_user);
        }

        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        params.push(id); 

        const [result] = await db.query(
            `UPDATE galeri SET ${setClauses} WHERE id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            newFiles.forEach(file => {
                fs.unlink(file.path, (unlinkErr) => {
                    if (unlinkErr) console.error(`Error menghapus file ${file.path}:`, unlinkErr);
                });
            });
            return res.status(404).json({
                error: "Entri galeri tidak ditemukan atau tidak ada perubahan yang dilakukan.",
            });
        }

        if (newFiles.length > 0) {
            const [currentMediaCount] = await db.query("SELECT COUNT(*) AS count FROM galeri_media WHERE galeri_id = ?", [id]);
            const initialOrderIndex = currentMediaCount[0].count;

            const newMediaPromises = newFiles.map(async (file, index) => {
                const media_path = `/uploads/galeri/${file.filename}`; 
                let media_type;

                if (file.mimetype.startsWith('image/')) {
                    media_type = 'image';
                } else if (file.mimetype.startsWith('video/')) {
                    media_type = 'video';
                } else {
                    media_type = 'unknown';
                }

                await db.query(
                    "INSERT INTO galeri_media (galeri_id, media_path, media_type, order_index) VALUES (?, ?, ?, ?)",
                    [id, media_path, media_type, initialOrderIndex + index]
                );
                return { media_path, media_type };
            });
            await Promise.all(newMediaPromises);
        }

        res.status(200).json({
            message: "Entri galeri berhasil diperbarui.",
            id: id,
            new_judul: judul,
            new_deskripsi: deskripsi,
            new_slug: finalSlug,
            new_user_id: id_user
        });
    } catch (error) {
        console.error("Error memperbarui entri galeri:", error);

        newFiles.forEach(file => {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`Error menghapus file ${file.path} saat kegagalan DB:`, unlinkErr);
                }
            });
        });

        res.status(500).json({
            error: "Gagal memperbarui entri galeri",
            details: error.message
        });
    }
};


exports.deleteGaleriEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const [mediaFilesToDelete] = await db.query(
            "SELECT media_path FROM galeri_media WHERE galeri_id = ?",
            [id]
        );

        const [result] = await db.query("DELETE FROM galeri WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Entri galeri tidak ditemukan." });
        }

        mediaFilesToDelete.forEach(media => {
            const fullPath = path.join(__dirname, "..", "public", media.media_path);
            if (fs.existsSync(fullPath)) {
                fs.unlink(fullPath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error(`Gagal menghapus file media fisik: ${fullPath}`, unlinkErr);
                    } else {
                        console.log(`File media fisik dihapus: ${fullPath}`);
                    }
                });
            } else {
                console.warn(`File media fisik tidak ditemukan di path: ${fullPath}`);
            }
        });

        res.status(200).json({ message: "Entri galeri dan media terkait berhasil dihapus." });
    } catch (error) {
        console.error("Error menghapus entri galeri:", error);
        res.status(500).json({
            error: "Gagal menghapus entri galeri",
            details: error.message
        });
    }
};

exports.deleteGaleriMedia = async (req, res) => {
    try {
        const { mediaId } = req.params;

        const [mediaEntry] = await db.query("SELECT media_path FROM galeri_media WHERE id = ?", [mediaId]);

        if (mediaEntry.length === 0) {
            return res.status(404).json({ error: "Media tidak ditemukan." });
        }

        const mediaPath = mediaEntry[0].media_path;

        const [result] = await db.query("DELETE FROM galeri_media WHERE id = ?", [mediaId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Media tidak ditemukan atau sudah dihapus." });
        }

        const fullPath = path.join(__dirname, "..", "public", mediaPath); 
        if (fs.existsSync(fullPath)) {
            fs.unlink(fullPath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`Gagal menghapus file media fisik: ${fullPath}`, unlinkErr);
                } else {
                    console.log(`File media fisik dihapus: ${fullPath}`);
                }
            });
        } else {
            console.warn(`File media fisik tidak ditemukan di path: ${fullPath}`);
        }

        res.status(200).json({ message: "Media galeri berhasil dihapus." });
    } catch (error) {
        console.error("Error menghapus media galeri:", error);
        res.status(500).json({
            error: "Gagal menghapus media galeri",
            details: error.message
        });
    }
};