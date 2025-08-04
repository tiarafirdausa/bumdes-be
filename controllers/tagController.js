// controllers/tagController.js
const db = require("../models/db");

exports.createTag = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Nama tag tidak boleh kosong." });
        }

        const [existingTagByName] = await db.query(
            "SELECT id FROM tags WHERE name = ?",
            [name]
        );
        if (existingTagByName.length > 0) {
            return res.status(409).json({ error: "Tag dengan nama ini sudah ada." });
        }

        let slug = req.body.slug;
        if (!slug) {
            slug = name
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "");
        }

        const [existingTagBySlug] = await db.query(
            "SELECT id FROM tags WHERE slug = ?",
            [slug]
        );
        if (existingTagBySlug.length > 0) {
            let suffix = 1;
            let uniqueSlug = slug;
            while (existingTagBySlug.length > 0) {
                uniqueSlug = `${slug}-${suffix}`;
                [existingTagBySlug] = await db.query(
                    "SELECT id FROM tags WHERE slug = ?",
                    [uniqueSlug]
                );
                suffix++;
            }
            slug = uniqueSlug;
        }


        const [result] = await db.query(
            "INSERT INTO tags (name, slug) VALUES (?, ?)",
            [name, slug]
        );

        res.status(201).json({
            id: result.insertId,
            name,
            slug,
            message: "Tag berhasil ditambahkan.",
        });
    } catch (error) {
        console.error("Error creating tag:", error);
        if (error.code === "ER_DUP_ENTRY") {
            res.status(409).json({
                error: "Terjadi duplikasi entri. Tag mungkin sudah terdaftar (nama atau slug).",
                details: error.message,
            });
        } else {
            res.status(500).json({ error: "Gagal membuat tag", details: error.message });
        }
    }
};

exports.getAllTags = async (req, res) => {
    try {
        const { query, pageIndex = 1, pageSize = 10} = req.query;
        const sortKey = req.query['sort[key]'];
        const sortOrder = req.query['sort[order]'];

        let sql = "SELECT id, name, slug, created_at, updated_at FROM tags";
        let countSql = "SELECT COUNT(id) AS total FROM tags";

        const params = []; 
        const countParams = []; 
        
        if (query) { 
            const searchQuery = `%${query}%`; 
            sql += " WHERE name LIKE ? OR slug LIKE ?"; 
            countSql += " WHERE name LIKE ? OR slug LIKE ?"; 
            params.push(searchQuery, searchQuery); 
            countParams.push(searchQuery, searchQuery); 
        }

        if (sortKey && sortOrder) {
            const validSortKeys = ['name', 'created_at', 'updated_at', 'slug'];
            if (validSortKeys.includes(sortKey)) {
                const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                sql += ` ORDER BY ${sortKey} ${order}`;
            } else {
                sql += " ORDER BY name ASC";
            }
        } else {
            sql += " ORDER BY name ASC";
        }

        const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
        sql += " LIMIT ? OFFSET ?";
        params.push(parseInt(pageSize), offset);

        const [tags] = await db.query(sql, params);
        const [totalResult] = await db.query(countSql, countParams);
        const total = totalResult[0].total;

        res.status(200).json({ tags, total });
    } catch (error) {
        console.error("Error fetching tags:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar tag",
            details: error.message,
        });
    }
};

exports.getTagById = async (req, res) => {
    try {
        const { id } = req.params;
        const [tag] = await db.query(
            "SELECT id, name, slug, created_at, updated_at FROM tags WHERE id = ?",
            [id]
        );

        if (tag.length === 0) {
            return res.status(404).json({ error: "Tag tidak ditemukan" });
        }

        res.status(200).json(tag[0]);
    } catch (error) {
        console.error("Error fetching tag by ID:", error);
        res.status(500).json({ error: "Gagal mengambil tag", details: error.message });
    }
};

exports.getTagBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const [tag] = await db.query(
            "SELECT id, name, slug, created_at, updated_at FROM tags WHERE slug = ?",
            [slug]
        );

        if (tag.length === 0) {
            return res.status(404).json({ error: "Tag tidak ditemukan" });
        }

        res.status(200).json(tag[0]);
    } catch (error) {
        console.error("Error fetching tag by slug:", error);
        res.status(500).json({ error: "Gagal mengambil tag", details: error.message });
    }
};


exports.updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug } = req.body;

        let updateFields = [];
        let updateValues = [];

        if (name) {
            const [existingTagByName] = await db.query(
                "SELECT id FROM tags WHERE name = ? AND id != ?",
                [name, id]
            );
            if (existingTagByName.length > 0) {
                return res.status(409).json({ error: "Tag dengan nama ini sudah ada." });
            }
            updateFields.push("name = ?");
            updateValues.push(name);
        }

        if (slug) {
            const [existingTagBySlug] = await db.query(
                "SELECT id FROM tags WHERE slug = ? AND id != ?",
                [slug, id]
            );
            if (existingTagBySlug.length > 0) {
                return res.status(409).json({ error: "Tag dengan slug ini sudah ada." });
            }
            updateFields.push("slug = ?");
            updateValues.push(slug);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
        }

        const query = `UPDATE tags SET ${updateFields.join(", ")} WHERE id = ?`;
        updateValues.push(id);
        const [result] = await db.query(query, updateValues);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Tag tidak ditemukan atau tidak ada perubahan yang dilakukan.",
            });
        }

        res.status(200).json({ message: "Tag berhasil diperbarui." });
    } catch (error) {
        console.error("Error updating tag:", error);
        if (error.code === "ER_DUP_ENTRY") {
            res.status(409).json({
                error: "Terjadi duplikasi entri (nama atau slug). Tag mungkin sudah terdaftar.",
                details: error.message,
            });
        } else {
            res.status(500).json({ error: "Gagal memperbarui tag", details: error.message });
        }
    }
};

exports.deleteTag = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            "DELETE FROM tags WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Tag tidak ditemukan" });
        }

        res.status(200).json({ message: "Tag berhasil dihapus." });
    } catch (error) {
        console.error("Error deleting tag:", error);
        res.status(500).json({ error: "Gagal menghapus tag", details: error.message });
    }
};