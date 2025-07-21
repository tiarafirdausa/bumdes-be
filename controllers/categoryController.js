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
        .replace(/[^a-z0-9-]/g, "");
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
    const [categories] = await db.query( 
      "SELECT id, name, slug FROM categories ORDER BY name ASC"
    );
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error); 
    res
      .status(500)
      .json({
        error: "Gagal mengambil daftar kategori",
        details: error.message,
      });
  }
};

exports.getCategoryById = async (req, res) => { 
  try {
    const { id } = req.params;
    const [category] = await db.query( 
      "SELECT id, name, slug FROM categories WHERE id = ?",
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
      "SELECT id, name, slug FROM categories WHERE slug = ?",
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
    )} WHERE id = ?`;
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
    console.error("Error deleting category:", error); // Updated console error
    res
      .status(500)
      .json({ error: "Gagal menghapus kategori", details: error.message });
  }
};
