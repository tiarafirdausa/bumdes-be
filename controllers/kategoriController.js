const db = require("../models/db");

// Fungsi untuk membuat kategori baru
exports.createKategori = async (req, res) => {
  try {
    const { kategori } = req.body;
    if (!kategori) {
      return res
        .status(400)
        .json({ error: "Nama kategori tidak boleh kosong." });
    }

    const [existingKategori] = await db.query(
      "SELECT id_kategori FROM kategori WHERE kategori = ?",
      [kategori]
    );
    if (existingKategori.length > 0) {
      return res
        .status(409)
        .json({ error: "Kategori dengan nama ini sudah ada." });
    }

    let kategori_seo = req.body.kategori_seo;
    if (!kategori_seo) {
      kategori_seo = kategori
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }
    const [result] = await db.query(
      "INSERT INTO kategori (kategori, kategori_seo) VALUES (?, ?)",
      [kategori, kategori_seo]
    );

    res.status(201).json({
      id_kategori: result.insertId,
      kategori,
      kategori_seo,
    });
  } catch (error) {
    console.error("Error creating kategori:", error);
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

// Fungsi untuk mendapatkan semua kategori
exports.getKategoris = async (req, res) => {
  try {
    const [kategoris] = await db.query(
      "SELECT id_kategori, kategori, kategori_seo FROM kategori ORDER BY kategori ASC"
    );
    res.status(200).json(kategoris);
  } catch (error) {
    console.error("Error fetching kategoris:", error);
    res
      .status(500)
      .json({
        error: "Gagal mengambil daftar kategori",
        details: error.message,
      });
  }
};

// Fungsi untuk mendapatkan kategori berdasarkan ID
exports.getKategoriById = async (req, res) => {
  try {
    const { id } = req.params;
    const [kategori] = await db.query(
      "SELECT id_kategori, kategori, kategori_seo FROM kategori WHERE id_kategori = ?",
      [id]
    );

    if (kategori.length === 0) {
      return res.status(404).json({ error: "Kategori tidak ditemukan" });
    }

    res.status(200).json(kategori[0]);
  } catch (error) {
    console.error("Error fetching kategori by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil kategori", details: error.message });
  }
};

// Fungsi untuk memperbarui kategori
exports.updateKategori = async (req, res) => {
  try {
    const { id } = req.params;
    const { kategori, kategori_seo } = req.body;

    let updateFields = [];
    let updateValues = [];

    if (kategori) {
      const [existingKategori] = await db.query(
        "SELECT id_kategori FROM kategori WHERE kategori = ? AND id_kategori != ?",
        [kategori, id]
      );
      if (existingKategori.length > 0) {
        return res
          .status(409)
          .json({ error: "Kategori dengan nama ini sudah ada." });
      }
      updateFields.push("kategori = ?");
      updateValues.push(kategori);
    }
    if (kategori_seo) {
      updateFields.push("kategori_seo = ?");
      updateValues.push(kategori_seo);
    }

    if (updateFields.length === 0) {
      return res
        .status(400)
        .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE kategori SET ${updateFields.join(
      ", "
    )} WHERE id_kategori = ?`;
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
    console.error("Error updating kategori:", error);
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

// Fungsi untuk menghapus kategori
exports.deleteKategori = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "DELETE FROM kategori WHERE id_kategori = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Kategori tidak ditemukan" });
    }

    res.status(200).json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting kategori:", error);
    res
      .status(500)
      .json({ error: "Gagal menghapus kategori", details: error.message });
  }
};
