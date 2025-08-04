// controllers/menuController.js
const db = require("../models/db");

exports.createMenu = async (req, res) => {
  try {
    const { name, slug } = req.body; 

    if (!name) {
      return res.status(400).json({ error: "Nama menu tidak boleh kosong." });
    }

    let finalSlug = slug;
    if (!finalSlug) {
      finalSlug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    const [existingMenuBySlug] = await db.query(
      "SELECT id FROM menus WHERE slug = ?",
      [finalSlug]
    );
    if (existingMenuBySlug.length > 0) {
      return res.status(409).json({ error: "Menu dengan slug ini sudah ada." });
    }

    const [result] = await db.query(
      "INSERT INTO menus (name, slug) VALUES (?, ?)",
      [name, finalSlug]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      slug: finalSlug,
      message: "Definisi menu berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating menu definition:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error: "Terjadi duplikasi entri. Nama atau slug menu mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal membuat definisi menu", details: error.message });
    }
  }
};

exports.getAllMenus = async (req, res) => {
    try {
        const {
            pageIndex = 1,
            pageSize = 10,
            query, 
            sort = {},
        } = req.query;

        const sortKey = req.query['sort[key]'];
        const sortOrder = req.query['sort[order]'];


        let sql = "SELECT id, name, slug, created_at, updated_at FROM menus";
        let countSql = "SELECT COUNT(id) AS total FROM menus";
        
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
            const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const allowedSortKeys = ['name', 'slug', 'created_at', 'updated_at'];
            if (allowedSortKeys.includes(sortKey)) {
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

        const [menus] = await db.query(sql, params);
        const [totalResult] = await db.query(countSql, countParams);
        const total = totalResult[0].total;

        res.status(200).json({
            data: menus,
            total,
            pageIndex: parseInt(pageIndex),
            pageSize: parseInt(pageSize),
        });
    } catch (error) {
        console.error("Error fetching menu definitions:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar definisi menu",
            details: error.message,
        });
    }
};

exports.getMenuById = async (req, res) => {
  try {
    const { id } = req.params;
    const [menu] = await db.query(
      "SELECT id, name, slug, created_at, updated_at FROM menus WHERE id = ?",
      [id]
    );

    if (menu.length === 0) {
      return res.status(404).json({ error: "Definisi menu tidak ditemukan" });
    }

    res.status(200).json(menu[0]);
  } catch (error) {
    console.error("Error fetching menu definition by ID:", error);
    res.status(500).json({ error: "Gagal mengambil definisi menu", details: error.message });
  }
};

exports.getMenuBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [menu] = await db.query(
      "SELECT id, name, slug, created_at, updated_at FROM menus WHERE slug = ?",
      [slug]
    );

    if (menu.length === 0) {
      return res.status(404).json({ error: "Definisi menu tidak ditemukan" });
    }

    res.status(200).json(menu[0]);
  } catch (error) {
    console.error("Error fetching menu definition by slug:", error);
    res.status(500).json({ error: "Gagal mengambil definisi menu", details: error.message });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;

    let updateFields = [];
    let updateValues = [];

    if (name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }
    if (slug) {
      const [existingMenuBySlug] = await db.query(
        "SELECT id FROM menus WHERE slug = ? AND id != ?",
        [slug, id]
      );
      if (existingMenuBySlug.length > 0) {
        return res.status(409).json({ error: "Menu dengan slug ini sudah ada." });
      }
      updateFields.push("slug = ?");
      updateValues.push(slug);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE menus SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Definisi menu tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({ message: "Definisi menu berhasil diperbarui." });
  } catch (error) {
    console.error("Error updating menu definition:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error: "Terjadi duplikasi entri. Nama atau slug menu mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal memperbarui definisi menu", details: error.message });
    }
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM menus WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Definisi menu tidak ditemukan" });
    }

    res.status(200).json({ message: "Definisi menu berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting menu definition:", error);
    res.status(500).json({ error: "Gagal menghapus definisi menu", details: error.message });
  }
};