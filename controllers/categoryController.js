// controllers/categoryController.js
const db = require("../models/db");

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res
        .status(400)
        .json({ error: "Nama kategori tidak boleh kosong." });
    }

    const [existingCategory] = await db.query(
      "SELECT id FROM categories WHERE name = ?",
      [name]
    );
    if (existingCategory.length > 0) {
      return res
        .status(409)
        .json({ error: "Kategori dengan nama ini sudah ada." });
    }

    let slug = req.body.slug;
    if (!slug) {
      slug = name
        .toLowerCase()
        .replace(/\s+/g, "-") 
        .replace(/[^a-z0-9-]/g, "") 
        .replace(/-+/g, "-");
    }

    const [existingCategoryBySlug] = await db.query(
        "SELECT id FROM categories WHERE slug = ?",
        [slug]
    );
    if (existingCategoryBySlug.length > 0) {
        let suffix = 1;
        let uniqueSlug = slug;
        while (existingCategoryBySlug.length > 0) {
            uniqueSlug = `${slug}-${suffix}`;
            [existingCategoryBySlug] = await db.query(
                "SELECT id FROM categories WHERE slug = ?",
                [uniqueSlug]
            );
            suffix++;
        }
        slug = uniqueSlug;
    }


    const [result] = await db.query(
      "INSERT INTO categories (name, slug) VALUES (?, ?)",
      [name, slug]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      slug,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res
        .status(409)
        .json({
          error: "Terjadi duplikasi entri. Kategori mungkin sudah terdaftar.",
          details: error.message,
        });
    } else {
      res
        .status(500)
        .json({ error: "Gagal membuat kategori", details: error.message });
    }
  }
};

exports.getCategories = async (req, res) => {
    try {
        const { query, pageIndex = 1, pageSize = 10 } = req.query;

        const sortKey = req.query['sort[key]'];
        const sortOrder = req.query['sort[order]'];

        let sql = "SELECT id, name, slug, created_at, updated_at FROM categories"; 
        let countSql = "SELECT COUNT(id) AS total FROM categories";

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

        const [categories] = await db.query(sql, params);
        const [totalResult] = await db.query(countSql, countParams);
        const total = totalResult[0].total;

        res.status(200).json({ categories, total });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar kategori",
            details: error.message,
        });
    }
};

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const [category] = await db.query(
      "SELECT id, name, slug, created_at, updated_at FROM categories WHERE id = ?", 
      [id]
    );

    if (category.length === 0) {
      return res.status(404).json({ error: "Kategori tidak ditemukan" });
    }

    res.status(200).json(category[0]);
  } catch (error) {
    console.error("Error fetching category by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil kategori", details: error.message });
  }
};

exports.getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [category] = await db.query(
      "SELECT id, name, slug, created_at, updated_at FROM categories WHERE slug = ?", 
      [slug]
    );

    if (category.length === 0) {
      return res.status(404).json({ error: "Kategori tidak ditemukan" });
    }

    res.status(200).json(category[0]);
  } catch (error) {
    console.error("Error fetching category by slug:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil kategori", details: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;

    let updateFields = [];
    let updateValues = [];

    if (name) {
      const [existingCategory] = await db.query(
        "SELECT id FROM categories WHERE name = ? AND id != ?",
        [name, id]
      );
      if (existingCategory.length > 0) {
        return res
          .status(409)
          .json({ error: "Kategori dengan nama ini sudah ada." });
      }
      updateFields.push("name = ?");
      updateValues.push(name);
    }
    if (slug) {
        const [existingCategoryBySlug] = await db.query(
            "SELECT id FROM categories WHERE slug = ? AND id != ?",
            [slug, id]
        );
        if (existingCategoryBySlug.length > 0) {
            return res.status(409).json({ error: "Kategori dengan slug ini sudah ada." });
        }
      updateFields.push("slug = ?");
      updateValues.push(slug);
    }

    if (updateFields.length === 0) {
      return res
        .status(400)
        .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE categories SET ${updateFields.join(
      ", "
    )}, updated_at = NOW() WHERE id = ?`; 
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({
          error:
            "Kategori tidak ditemukan atau tidak ada perubahan yang dilakukan.",
        });
    }

    res.status(200).json({ message: "Kategori berhasil diperbarui" });
  } catch (error) {
    console.error("Error updating category:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res
        .status(409)
        .json({
          error: "Terjadi duplikasi entri. Kategori mungkin sudah terdaftar.",
          details: error.message,
        });
    } else {
      res
        .status(500)
        .json({ error: "Gagal memperbarui kategori", details: error.message });
    }
  }
};


exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "DELETE FROM categories WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Kategori tidak ditemukan" });
    }

    res.status(200).json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting category:", error); 
    res
      .status(500)
      .json({ error: "Gagal menghapus kategori", details: error.message });
  }
};