const db = require("../models/db");

exports.createSocial = async (req, res) => {
    try {
        const { platform, url, icon_class, is_active } = req.body;

        if (!platform) {
            return res.status(400).json({ error: "Nama platform tidak boleh kosong." });
        }

        const [existingSocialByPlatform] = await db.query(
            "SELECT id FROM social_links WHERE platform = ?",
            [platform]
        );
        if (existingSocialByPlatform.length > 0) {
            return res.status(409).json({ error: "Entri sosial dengan platform ini sudah ada." });
        }

        const values = [
            platform,
            url || null,
            icon_class || null,
            is_active !== undefined ? is_active : 1,
        ];

        const [result] = await db.query(
            "INSERT INTO social_links (platform, url, icon_class, is_active) VALUES (?, ?, ?, ?)",
            values
        );

        res.status(201).json({
            id: result.insertId,
            platform,
            url: url || null,
            icon_class: icon_class || null,
            is_active: is_active !== undefined ? is_active : 1,
            message: "Entri sosial berhasil ditambahkan.",
        });
    } catch (error) {
        console.error("Error creating social entry:", error);
        if (error.code === "ER_DUP_ENTRY") {
            res.status(409).json({
                error: "Terjadi duplikasi entri. Platform mungkin sudah terdaftar.",
                details: error.message,
            });
        } else {
            res.status(500).json({ error: "Gagal membuat entri sosial", details: error.message });
        }
    }
};

exports.getAllSocial = async (req, res) => {
    try {
        const { pageIndex = 1, pageSize = 10, query = '', sort = {} } = req.query;
        const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
        let whereClause = '';
        let queryParams = [];

        if (query) {
            whereClause += ' WHERE platform LIKE ?';
            queryParams.push(`%${query}%`);
        }

        let orderByClause = ' ORDER BY platform ASC';
        if (sort.order && sort.key) {
            const sortOrder = sort.order === 'desc' ? 'DESC' : 'ASC';
            const allowedSortKeys = ['platform', 'created_at', 'updated_at'];
            if (allowedSortKeys.includes(sort.key)) {
                orderByClause = ` ORDER BY ${sort.key} ${sortOrder}`;
            }
        }

        const [totalResult] = await db.query(
            `SELECT COUNT(id) AS total FROM social_links${whereClause}`,
            queryParams
        );
        const total = totalResult[0].total;

        const [socialEntries] = await db.query(
            `SELECT id, platform, url, icon_class, is_active, created_at, updated_at FROM social_links${whereClause}${orderByClause} LIMIT ?, ?`,
            [...queryParams, offset, parseInt(pageSize)]
        );

        res.status(200).json({
            data: socialEntries,
            total,
            pageIndex: parseInt(pageIndex),
            pageSize: parseInt(pageSize),
        });
    } catch (error) {
        console.error("Error fetching social entries:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar entri sosial",
            details: error.message,
        });
    }
};

exports.getSocialById = async (req, res) => {
    try {
        const { id } = req.params;
        const [socialEntry] = await db.query(
            "SELECT id, platform, url, icon_class, is_active, created_at, updated_at FROM social_links WHERE id = ?",
            [id]
        );

        if (socialEntry.length === 0) {
            return res.status(404).json({ error: "Entri sosial tidak ditemukan" });
        }

        res.status(200).json(socialEntry[0]);
    } catch (error) {
        console.error("Error fetching social entry by ID:", error);
        res.status(500).json({ error: "Gagal mengambil entri sosial", details: error.message });
    }
};

exports.updateSocial = async (req, res) => {
    try {
        const { id } = req.params;
        const { platform, url, icon_class, is_active } = req.body;

        let updateFields = [];
        let updateValues = [];

        if (platform) {
            const [existingSocialByPlatform] = await db.query(
                "SELECT id FROM social_links WHERE platform = ? AND id != ?",
                [platform, id]
            );
            if (existingSocialByPlatform.length > 0) {
                return res.status(409).json({ error: "Entri sosial dengan platform ini sudah ada." });
            }
            updateFields.push("platform = ?");
            updateValues.push(platform);
        }

        if (url !== undefined) {
            updateFields.push("url = ?");
            updateValues.push(url);
        }
        if (icon_class !== undefined) {
            updateFields.push("icon_class = ?");
            updateValues.push(icon_class);
        }
        if (is_active !== undefined) {
            updateFields.push("is_active = ?");
            updateValues.push(is_active);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
        }

        const query = `UPDATE social_links SET ${updateFields.join(", ")} WHERE id = ?`;
        updateValues.push(id);
        const [result] = await db.query(query, updateValues);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Entri sosial tidak ditemukan atau tidak ada perubahan yang dilakukan.",
            });
        }

        res.status(200).json({ message: "Entri sosial berhasil diperbarui." });
    } catch (error) {
        console.error("Error updating social entry:", error);
        if (error.code === "ER_DUP_ENTRY") {
            res.status(409).json({
                error: "Terjadi duplikasi entri. Platform mungkin sudah terdaftar.",
                details: error.message,
            });
        } else {
            res.status(500).json({ error: "Gagal memperbarui entri sosial", details: error.message });
        }
    }
};

exports.deleteSocial = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            "DELETE FROM social_links WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Entri sosial tidak ditemukan" });
        }

        res.status(200).json({ message: "Entri sosial berhasil dihapus." });
    } catch (error) {
        console.error("Error deleting social entry:", error);
        res.status(500).json({ error: "Gagal menghapus entri sosial", details: error.message });
    }
};