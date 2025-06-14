const db = require("../models/db");
const path = require("path");
const fs = require("fs");

exports.createHalaman = async (req, res) => {
  try {
    const { judul, isi, id_modul, meta_title, meta_desc, meta_keyw, id_user } =
      req.body;

    if (!judul || !isi || !id_user) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr)
            console.error(
              "Error deleting uploaded file due to missing fields:",
              unlinkErr
            );
        });
      }
      return res
        .status(400)
        .json({ error: "Judul, isi, dan ID pengguna wajib diisi." });
    }

    const gambarPath = req.file
      ? `/public/uploads/halaman/${req.file.filename}`
      : "";

    let judul_seo = req.body.judul_seo;
    if (!judul_seo) {
      judul_seo = judul
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    const finalMetaTitle =
      meta_title !== undefined && meta_title !== "" ? meta_title : judul;
    const finalMetaDesc =
      meta_desc !== undefined && meta_desc !== "" ? meta_desc : judul;
    const finalMetaKeyw =
      meta_keyw !== undefined && meta_keyw !== "" ? meta_keyw : judul;

    const now = new Date();
    const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
    const tanggal = now.toISOString().slice(0, 10);
    const jam = now.toTimeString().slice(0, 8);

    const hits = 0;

    const [result] = await db.query(
      "INSERT INTO halaman (judul, judul_seo, meta_title, meta_desc, meta_keyw, isi, id_modul, gambar, hari, tanggal, jam, id_user, hits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        judul,
        judul_seo,
        finalMetaTitle,
        finalMetaDesc,
        finalMetaKeyw,
        isi,
        id_modul,
        gambarPath,
        hari,
        tanggal,
        jam,
        id_user,
        hits,
      ]
    );
    res.status(201).json({
      id_halaman: result.insertId,
      judul,
      judul_seo,
      meta_title: finalMetaTitle,
      meta_desc: finalMetaDesc,
      meta_keyw: finalMetaKeyw,
      isi,
      id_modul,
      gambar: gambarPath,
      hari,
      tanggal,
      jam,
      id_user,
      hits,
    });
  } catch (error) {
    console.error("Error creating halaman:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr)
          console.error(
            "Error deleting uploaded file on DB failure:",
            unlinkErr
          );
      });
    }
    if (error.code === "ER_DUP_ENTRY") {
      res
        .status(409)
        .json({
          error:
            "Terjadi duplikasi entri. Judul halaman atau judul SEO mungkin sudah terdaftar.",
          details: error.message,
        });
    } else {
      res
        .status(500)
        .json({ error: "Gagal membuat halaman", details: error.message });
    }
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
      gambar: gambarFromBody,
      id_user,
    } = req.body;

    const newGambarPath = req.file
      ? `/public/uploads/halaman/${req.file.filename}`
      : undefined;

    let updateFields = [];
    let updateValues = [];
    let responseBody = {};

    const [oldHalaman] = await db.query(
      "SELECT gambar FROM halaman WHERE id_halaman = ?",
      [id]
    );
    const oldGambarPath = oldHalaman.length > 0 ? oldHalaman[0].gambar : null;

    if (judul !== undefined) {
      const [existingJudul] = await db.query(
        "SELECT id_halaman FROM halaman WHERE judul = ? AND id_halaman != ?",
        [judul, id]
      );
      if (existingJudul.length > 0) {
        if (req.file) {
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr)
              console.error(
                "Error deleting uploaded file due to duplicate title:",
                unlinkErr
              );
          });
        }
        return res
          .status(409)
          .json({ error: "Halaman dengan judul ini sudah ada." });
      }
      updateFields.push("judul = ?");
      updateValues.push(judul);
    }

    if (judul !== undefined && !("judul_seo" in req.body)) {
      const newJudulSeo = judul
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      updateFields.push("judul_seo = ?");
      updateValues.push(newJudulSeo);
    } else if ("judul_seo" in req.body) {
      const [existingJudulSeo] = await db.query(
        "SELECT id_halaman FROM halaman WHERE judul_seo = ? AND id_halaman != ?",
        [judul_seo, id]
      );
      if (existingJudulSeo.length > 0) {
        if (req.file) {
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr)
              console.error(
                "Error deleting uploaded file due to duplicate SEO title:",
                unlinkErr
              );
          });
        }
        return res
          .status(409)
          .json({ error: "Halaman dengan judul SEO ini sudah ada." });
      }
      updateFields.push("judul_seo = ?");
      updateValues.push(judul_seo || null);
    }

    if (meta_title !== undefined) {
      updateFields.push("meta_title = ?");
      updateValues.push(meta_title || null);
    }
    if (meta_desc !== undefined) {
      updateFields.push("meta_desc = ?");
      updateValues.push(meta_desc || null);
    }
    if (meta_keyw !== undefined) {
      updateFields.push("meta_keyw = ?");
      updateValues.push(meta_keyw || null);
    }
    if (isi !== undefined) {
      updateFields.push("isi = ?");
      updateValues.push(isi);
    }
    if (id_modul !== undefined) {
      updateFields.push("id_modul = ?");
      updateValues.push(id_modul || null);
    }
    if (id_user !== undefined) {
      updateFields.push("id_user = ?");
      updateValues.push(id_user);
    }

    if (req.file) {
      updateFields.push("gambar = ?");
      updateValues.push(newGambarPath);
      if (
        oldGambarPath &&
        oldGambarPath.startsWith("/public/uploads/halaman")
      ) {
        const fullOldPath = path.join(__dirname, "..", oldGambarPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr)
              console.error(
                "Gagal menghapus gambar lama:",
                fullOldPath,
                unlinkErr
              );
            else console.log("Gambar lama dihapus:", fullOldPath);
          });
        }
      }
    } else if (
      gambarFromBody !== undefined &&
      (gambarFromBody === null || gambarFromBody === "")
    ) {
      updateFields.push("gambar = ?");
      updateValues.push(null);
      responseBody.image_cleared = true;
      if (
        oldGambarPath &&
        oldGambarPath.startsWith("/public/uploads/halaman")
      ) {
        const fullOldPath = path.join(__dirname, "..", oldGambarPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr)
              console.error(
                "Gagal menghapus gambar lama:",
                fullOldPath,
                unlinkErr
              );
            else console.log("Gambar lama dihapus:", fullOldPath);
          });
        }
      }
    }

    if (updateFields.length === 0) {
      return res
        .status(400)
        .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE halaman SET ${updateFields.join(
      ", "
    )} WHERE id_halaman = ?`;
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr)
            console.error(
              "Error deleting uploaded file after no DB change:",
              unlinkErr
            );
        });
      }
      return res
        .status(404)
        .json({
          error:
            "Halaman tidak ditemukan atau tidak ada perubahan yang dilakukan.",
        });
    }

    res
      .status(200)
      .json({
        message: "Halaman berhasil diperbarui",
        new_image_path: newGambarPath,
        ...responseBody,
      });
  } catch (error) {
    console.error("Error updating halaman:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr)
          console.error(
            "Error deleting uploaded file on DB failure:",
            unlinkErr
          );
      });
    }
    if (error.code === "ER_DUP_ENTRY") {
      res
        .status(409)
        .json({
          error:
            "Terjadi duplikasi entri. Judul halaman atau judul SEO mungkin sudah terdaftar.",
          details: error.message,
        });
    } else {
      res
        .status(500)
        .json({ error: "Gagal memperbarui halaman", details: error.message });
    }
  }
};

// Fungsi untuk mendapatkan semua halaman
exports.getHalamans = async (req, res) => {
  try {
    const [halamans] = await db.query(
      `SELECT
                h.*,   
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
    console.error("Error fetching halamans:", error);
    res
      .status(500)
      .json({
        error: "Gagal mengambil daftar halaman",
        details: error.message,
      });
  }
};

// Fungsi untuk mendapatkan halaman berdasarkan ID
exports.getHalamanById = async (req, res) => {
  try {
    const { id } = req.params;

    const [halaman] = await db.query(
      "SELECT * FROM halaman WHERE id_halaman = ?",
      [id]
    );

    if (halaman.length === 0) {
      return res.status(404).json({ error: "Halaman tidak ditemukan" });
    }

    await db.query("UPDATE halaman SET hits = hits + 1 WHERE id_halaman = ?", [
      id,
    ]);

    res.status(200).json(halaman[0]);
  } catch (error) {
    console.error("Error fetching halaman by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil halaman", details: error.message });
  }
};

// Fungsi untuk menghapus halaman
exports.deleteHalaman = async (req, res) => {
  try {
    const { id } = req.params;
    const [halaman] = await db.query(
      "SELECT gambar FROM halaman WHERE id_halaman = ?",
      [id]
    );
    const gambarPathToDelete = halaman.length > 0 ? halaman[0].gambar : null;
    const [result] = await db.query(
      "DELETE FROM halaman WHERE id_halaman = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Halaman tidak ditemukan" });
    }

    if (
      gambarPathToDelete &&
      gambarPathToDelete.startsWith("/public/uploads/halaman")
    ) {
      const fullPath = path.join(__dirname, "..", gambarPathToDelete);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => {
          if (err)
            console.error(
              "Gagal menghapus file gambar halaman:",
              fullPath,
              err
            );
          else console.log("File gambar halaman dihapus:", fullPath);
        });
      }
    }

    res.status(200).json({ message: "Halaman berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting halaman:", error);
    res
      .status(500)
      .json({ error: "Gagal menghapus halaman", details: error.message });
  }
};
