// controllers/mediaController.js 
const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const deleteFile = (filePath, context) => {
    const fullPath = path.join(__dirname, "..", "public", filePath);
    if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (unlinkErr) => {
            if (unlinkErr) console.error(`Error deleting file (${context}): ${fullPath}`, unlinkErr);
            else console.log(`File deleted (${context}): ${fullPath}`);
        });
    } else {
        console.warn(`File not found for deletion (${context}): ${fullPath}`);
    }
};

exports.createMediaEntry = async (req, res) => {
    const newFiles = req.files || [];  
    let connection;

    if (newFiles.length === 0) {
        return res.status(400).json({ message: 'Tidak ada file media yang diunggah.' });
    }

    const { label, category_id, uploaded_by } = req.body;

    if (!label || label.trim() === '') {
        newFiles.forEach(file => deleteFile(file.path, "missing label"));
        return res.status(400).json({ error: 'Label media wajib diisi.' });
    }
    if (!category_id) { 
        newFiles.forEach(file => deleteFile(file.path, "missing category_id"));
        return res.status(400).json({ error: 'ID kategori media wajib diisi.' });
    }

    try {
        const [categoryExists] = await db.query("SELECT id FROM media_categories WHERE id = ?", [category_id]);
        if (categoryExists.length === 0) {
            newFiles.forEach(file => deleteFile(file.path, "invalid category_id"));
            return res.status(404).json({ error: "Kategori media tidak ditemukan." });
        }

        const [userExists] = await db.query("SELECT id FROM users WHERE id = ?", [uploaded_by]);
        if (userExists.length === 0) {
            newFiles.forEach(file => deleteFile(file.path, "invalid uploaded_by"));
            return res.status(404).json({ error: "Pengguna (uploaded_by) tidak ditemukan." });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const insertedMedia = [];
        for (const file of newFiles) {
            const media_url = `/uploads/media/${file.filename}`; 
            let media_type;

            if (file.mimetype.startsWith('image/')) {
                media_type = 'image';
            } else if (file.mimetype.startsWith('video/')) {
                media_type = 'video';
            } else {
                media_type = 'unknown';
            }

            const [resultMedia] = await connection.query(
                "INSERT INTO media (file_name, url, type, label, category_id, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
                [file.originalname, media_url, media_type, label, category_id, uploaded_by]
            );

            insertedMedia.push({
                id: resultMedia.insertId,
                file_name: file.originalname,
                url: media_url,
                type: media_type,
                label: label,
                category_id: category_id,
                uploaded_by: uploaded_by,
            });
        }

        await connection.commit();

        res.status(201).json({
            message: "Entri media berhasil ditambahkan.",
            media_entries: insertedMedia,
        });

    } catch (error) {
        console.error("Error creating media entry:", error);
        if (connection) await connection.rollback();
        newFiles.forEach(file => deleteFile(file.path, "DB failure during create"));
        res.status(500).json({
            error: "Gagal membuat entri media",
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

exports.getAllMediaEntries = async (req, res) => {
    try {
        const { categoryId, type, uploadedBy, search, limit, offset } = req.query;
        let query = `
            SELECT
                m.id, m.file_name, m.url, m.type, m.label, m.category_id, m.uploaded_by, m.created_at,
                mc.name AS category_name, mc.slug AS category_slug,
                u.name AS uploader_name, u.foto AS uploader_photo
            FROM
                media m
            LEFT JOIN
                media_categories mc ON m.category_id = mc.id
            LEFT JOIN
                users u ON m.uploaded_by = u.id
        `;
        const queryParams = [];
        const conditions = [];

        if (categoryId) {
            conditions.push(`m.category_id = ?`);
            queryParams.push(categoryId);
        }
        if (type && ['image', 'pdf', 'youtube', 'audio', 'video'].includes(type)) {
            conditions.push(`m.type = ?`);
            queryParams.push(type);
        }
        if (uploadedBy) {
            conditions.push(`m.uploaded_by = ?`);
            queryParams.push(uploadedBy);
        }
        if (search) {
            conditions.push(`(m.label LIKE ? OR m.file_name LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(` AND `);
        }

        query += ` ORDER BY m.created_at DESC`;

        if (limit) {
            query += ` LIMIT ?`;
            queryParams.push(parseInt(limit));
        }
        if (offset) {
            query += ` OFFSET ?`;
            queryParams.push(parseInt(offset));
        }

        const [mediaEntries] = await db.query(query, queryParams);
        res.status(200).json(mediaEntries);
    } catch (error) {
        console.error("Error getting all media entries:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar entri media",
            details: error.message,
        });
    }
};

exports.getMediaEntryById = async (req, res) => {
    try {
        const { id } = req.params;

        const [mediaEntry] = await db.query(
            `SELECT
                m.id, m.file_name, m.url, m.type, m.label, m.category_id, m.uploaded_by, m.created_at,
                mc.name AS category_name, mc.slug AS category_slug,
                u.name AS uploader_name, u.foto AS uploader_photo
            FROM
                media m
            LEFT JOIN
                media_categories mc ON m.category_id = mc.id
            LEFT JOIN
                users u ON m.uploaded_by = u.id
            WHERE m.id = ?`,
            [id]
        );

        if (mediaEntry.length === 0) {
            return res.status(404).json({ error: "Entri media tidak ditemukan." });
        }

        res.status(200).json(mediaEntry[0]);
    } catch (error) {
        console.error("Error getting media entry by ID:", error);
        res.status(500).json({
            error: "Gagal mengambil entri media",
            details: error.message,
        });
    }
};

exports.getMediaByCategorySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const [category] = await db.query("SELECT id, name FROM media_categories WHERE slug = ?", [slug]);
        if (category.length === 0) {
            return res.status(404).json({ error: "Kategori media tidak ditemukan." });
        }
        const categoryId = category[0].id;
        const categoryName = category[0].name;

        const [mediaFiles] = await db.query(
            `SELECT
                m.id, m.file_name, m.url, m.type, m.label, m.uploaded_by, m.created_at,
                u.name AS uploader_name, u.foto AS uploader_photo
            FROM
                media m
            LEFT JOIN
                users u ON m.uploaded_by = u.id
            WHERE m.category_id = ?
            ORDER BY m.created_at DESC`,
            [categoryId]
        );

        res.status(200).json({
            category_id: categoryId,
            category_name: categoryName,
            category_slug: slug,
            media: mediaFiles
        });
    } catch (error) {
        console.error("Error getting media by category slug:", error);
        res.status(500).json({
            error: "Gagal mengambil media berdasarkan kategori",
            details: error.message,
        });
    }
};

exports.updateMediaEntry = async (req, res) => {
    const { id } = req.params;
    const newFile = req.files && req.files.length > 0 ? req.files[0] : null; 
    let connection;

    const { label, type, category_id, uploaded_by } = req.body;

    const [oldMediaEntry] = await db.query("SELECT file_name, url FROM media WHERE id = ?", [id]);
    if (oldMediaEntry.length === 0) {
        if (newFile) deleteFile(newFile.path, "media not found for update");
        return res.status(404).json({ error: "Entri media tidak ditemukan." });
    }
    const oldMediaUrl = oldMediaEntry[0].url;

    let updateFields = [];
    let updateValues = [];

    if (label !== undefined) {
        updateFields.push("label = ?");
        updateValues.push(label || null);
    }
    if (type !== undefined && ['image', 'pdf', 'youtube', 'audio', 'video'].includes(type)) {
        updateFields.push("type = ?");
        updateValues.push(type);
    }
    if (category_id !== undefined) {
        const [categoryExists] = await db.query("SELECT id FROM media_categories WHERE id = ?", [category_id]);
        if (categoryExists.length === 0) {
            if (newFile) deleteFile(newFile.path, "invalid category_id on update");
            return res.status(404).json({ error: "Kategori media tidak ditemukan." });
        }
        updateFields.push("category_id = ?");
        updateValues.push(category_id || null);
    }
    if (uploaded_by !== undefined) {
        const [userExists] = await db.query("SELECT id FROM users WHERE id = ?", [uploaded_by]);
        if (userExists.length === 0) {
            if (newFile) deleteFile(newFile.path, "invalid uploaded_by on update");
            return res.status(404).json({ error: "Pengguna (uploaded_by) tidak ditemukan." });
        }
        updateFields.push("uploaded_by = ?");
        updateValues.push(uploaded_by || null);
    }

    let newMediaUrl = oldMediaUrl;
    let newFileName = oldMediaEntry[0].file_name;

    if (newFile) {
        newMediaUrl = `/uploads/media/${newFile.filename}`;
        newFileName = newFile.originalname;
        updateFields.push("file_name = ?", "url = ?");
        updateValues.push(newFileName, newMediaUrl);

        deleteFile(oldMediaUrl, "replacing old media file");
    } else if (req.body.clear_file === 'true') { 
        updateFields.push("file_name = ?", "url = ?");
        updateValues.push(null, null);
        deleteFile(oldMediaUrl, "clearing media file");
    }

    if (updateFields.length === 0) {
        if (newFile) deleteFile(newFile.path, "no data to update");
        return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    updateFields.push("updated_at = NOW()"); 

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const query = `UPDATE media SET ${updateFields.join(", ")} WHERE id = ?`;
        updateValues.push(id);

        const [result] = await connection.query(query, updateValues);

        if (result.affectedRows === 0) {
            if (newFile) deleteFile(newFile.path, "no DB change after update");
            return res.status(404).json({
                error: "Entri media tidak ditemukan atau tidak ada perubahan yang dilakukan.",
            });
        }

        await connection.commit();

        res.status(200).json({
            message: "Entri media berhasil diperbarui.",
            id: id,
            updated_url: newMediaUrl,
            updated_file_name: newFileName,
        });
    } catch (error) {
        console.error("Error updating media entry:", error);
        if (connection) await connection.rollback();
        if (newFile) deleteFile(newFile.path, "DB failure during update");
        res.status(500).json({
            error: "Gagal memperbarui entri media",
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteMediaEntry = async (req, res) => {
    const { id } = req.params;
    let connection;

    try {
        const [mediaEntry] = await db.query("SELECT url FROM media WHERE id = ?", [id]);

        if (mediaEntry.length === 0) {
            return res.status(404).json({ error: "Entri media tidak ditemukan." });
        }
        const mediaUrlToDelete = mediaEntry[0].url;

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query("DELETE FROM media WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Entri media tidak ditemukan atau sudah dihapus." });
        }

        await connection.commit();

        deleteFile(mediaUrlToDelete, "media entry deletion");

        res.status(200).json({ message: "Entri media berhasil dihapus." });
    } catch (error) {
        console.error("Error deleting media entry:", error);
        if (connection) await connection.rollback();
        res.status(500).json({
            error: "Gagal menghapus entri media",
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};