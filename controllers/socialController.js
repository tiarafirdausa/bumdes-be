const db = require("../models/db"); // Adjust path if necessary

// Fungsi untuk membuat entri media sosial baru
exports.createSocial = async (req, res) => {
  try {
    const { judul, website, link } = req.body;
    if (!judul || !website) {
      return res.status(400).json({ error: "Judul dan Website tidak boleh kosong." });
    }

    const [existingSocialByJudul] = await db.query(
      "SELECT id_social FROM md_social WHERE judul = ?",
      [judul]
    );
    if (existingSocialByJudul.length > 0) {
      return res.status(409).json({ error: "Entri sosial dengan judul ini sudah ada." });
    }
    const [existingSocialByWebsite] = await db.query(
      "SELECT id_social FROM md_social WHERE website = ?",
      [website]
    );
    if (existingSocialByWebsite.length > 0) {
      return res.status(409).json({ error: "Entri sosial dengan website ini sudah ada." });
    }


    const [result] = await db.query(
      "INSERT INTO md_social (judul, website, link) VALUES (?, ?, ?)",
      [judul, website, link]
    );

    res.status(201).json({
      id_social: result.insertId,
      judul,
      website,
      link,
      message: "Entri sosial berhasil ditambahkan.",
    });
  } catch (error) {
    console.error("Error creating social entry:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error: "Terjadi duplikasi entri. Judul atau Website mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal membuat entri sosial", details: error.message });
    }
  }
};

// Fungsi untuk mendapatkan semua entri media sosial
exports.getAllSocial = async (req, res) => {
  try {
    const [socialEntries] = await db.query(
      "SELECT id_social, judul, website, link FROM md_social ORDER BY id_social ASC"
    );
    res.status(200).json(socialEntries);
  } catch (error) {
    console.error("Error fetching social entries:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar entri sosial",
      details: error.message,
    });
  }
};

// Fungsi untuk mendapatkan entri media sosial berdasarkan ID
exports.getSocialById = async (req, res) => {
  try {
    const { id } = req.params;
    const [socialEntry] = await db.query(
      "SELECT id_social, judul, website, link FROM md_social WHERE id_social = ?",
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


// Fungsi untuk memperbarui entri media sosial
exports.updateSocial = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, website, link } = req.body;

    let updateFields = [];
    let updateValues = [];

    if (judul) {
      const [existingSocialByJudul] = await db.query(
        "SELECT id_social FROM md_social WHERE judul = ? AND id_social != ?",
        [judul, id]
      );
      if (existingSocialByJudul.length > 0) {
        return res.status(409).json({ error: "Entri sosial dengan judul ini sudah ada." });
      }
      updateFields.push("judul = ?");
      updateValues.push(judul);
    }

    // Jika website disediakan, periksa duplikasi dan tambahkan ke update
    if (website) {
        const [existingSocialByWebsite] = await db.query(
            "SELECT id_social FROM md_social WHERE website = ? AND id_social != ?",
            [website, id]
        );
        if (existingSocialByWebsite.length > 0) {
            return res.status(409).json({ error: "Entri sosial dengan website ini sudah ada." });
        }
        updateFields.push("website = ?");
        updateValues.push(website);
    }

    if (link !== undefined) { 
      updateFields.push("link = ?");
      updateValues.push(link);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE md_social SET ${updateFields.join(", ")} WHERE id_social = ?`;
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
        error: "Terjadi duplikasi entri. Judul atau Website mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal memperbarui entri sosial", details: error.message });
    }
  }
};

// Fungsi untuk menghapus entri media sosial
exports.deleteSocial = async (req, res) => {
  try {
    const { id } = req.params; 
    const [result] = await db.query(
      "DELETE FROM md_social WHERE id_social = ?",
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