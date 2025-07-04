const db = require("../models/db");
const path = require("path");
const fs = require("fs");

exports.createArtikel = async (req, res) => {
  try {
    const {
      judul,
      isi,
      kategori,
      tag,
      display,
      meta_title,
      meta_desc,
      meta_keyw,
      id_user,
    } = req.body;

    if (!judul || !isi || !kategori || !id_user) {
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
        .json({ error: "Judul, isi, kategori, dan ID pengguna wajib diisi." });
    }

    const gambarPath = req.file
      ? `/public/uploads/artikel/${req.file.filename}`
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
      "INSERT INTO artikel (judul, judul_seo, meta_title, meta_desc, meta_keyw, isi, gambar, hari, tanggal, jam, display, id_user, kategori, tag, hits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        judul,
        judul_seo,
        finalMetaTitle,
        finalMetaDesc,
        finalMetaKeyw,
        isi,
        gambarPath,
        hari,
        tanggal,
        jam,
        display || "Y",
        id_user,
        kategori,
        tag || null,
        hits,
      ]
    );

    res.status(201).json({
      id_artikel: result.insertId,
      judul,
      judul_seo,
      meta_title: finalMetaTitle,
      meta_desc: finalMetaDesc,
      meta_keyw: finalMetaKeyw,
      isi,
      gambar: gambarPath,
      hari,
      tanggal,
      jam,
      display,
      id_user,
      kategori,
      tag,
      hits,
    });
  } catch (error) {
    console.error("Error creating artikel:", error);
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
      res.status(409).json({
        error:
          "Terjadi duplikasi entri. Judul artikel atau judul SEO mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res
        .status(500)
        .json({ error: "Gagal membuat artikel", details: error.message });
    }
  }
};

exports.updateArtikel = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      judul,
      judul_seo,
      meta_title,
      meta_desc,
      meta_keyw,
      isi,
      kategori,
      tag,
      display,
      gambar: gambarFromBody,
      id_user,
    } = req.body;

    const newGambarPath = req.file
      ? `/uploads/artikel/${req.file.filename}`
      : undefined;

    let updateFields = [];
    let updateValues = [];
    let responseBody = {};

    const [oldArtikel] = await db.query(
      "SELECT gambar FROM artikel WHERE id_artikel = ?",
      [id]
    );
    const oldGambarPath = oldArtikel.length > 0 ? oldArtikel[0].gambar : null;

    if (judul !== undefined) {
      const [existingJudul] = await db.query(
        "SELECT id_artikel FROM artikel WHERE judul = ? AND id_artikel != ?",
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
          .json({ error: "Artikel dengan judul ini sudah ada." });
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
    } else if (req.body.hasOwnProperty("judul_seo")) {
      const [existingJudulSeo] = await db.query(
        "SELECT id_artikel FROM artikel WHERE judul_seo = ? AND id_artikel != ?",
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
          .json({ error: "Artikel dengan judul SEO ini sudah ada." });
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
    if (kategori !== undefined) {
      updateFields.push("kategori = ?");
      updateValues.push(kategori);
    }
    if (tag !== undefined) {
      updateFields.push("tag = ?");
      updateValues.push(tag || null);
    }
    if (display !== undefined) {
      updateFields.push("display = ?");
      updateValues.push(display);
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
        oldGambarPath.startsWith("/public/uploads/artikel")
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
        oldGambarPath.startsWith("/public/uploads/artikel")
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
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
      }
    }

    const query = `UPDATE artikel SET ${updateFields.join(
      ", "
    )} WHERE id_artikel = ?`;
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
      return res.status(404).json({
        error:
          "Artikel tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({
      message: "Artikel berhasil diperbarui",
      new_image_path: newGambarPath,
      ...responseBody,
    });
  } catch (error) {
    console.error("Error updating artikel:", error);
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
      res.status(409).json({
        error:
          "Terjadi duplikasi entri. Judul artikel atau judul SEO mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res
        .status(500)
        .json({ error: "Gagal memperbarui artikel", details: error.message });
    }
  }
};

// --- Fungsi untuk mendapatkan semua artikel ---
exports.getArtikels = async (req, res) => {
  try {
    const { kategori, limit } = req.query;
    let query = `
            SELECT
                a.*,
                u.nama_lengkap AS nama_penulis,
                u.foto AS foto_penulis,
                k.kategori AS kategori_nama,
                k.kategori_seo AS kategori_seo,
                k.id_kategori as id_kategori
            FROM
                artikel a
            JOIN
                user u ON a.id_user = u.id_user
            JOIN
                kategori k ON a.kategori = k.id_kategori
        `;
    const queryParams = [];

    if (kategori) {
      query += ` WHERE a.kategori = ?`;
      queryParams.push(kategori);
    }

    query += ` ORDER BY a.tanggal DESC, a.jam DESC`;
    if (limit) {
      query += ` LIMIT ?`;
      queryParams.push(parseInt(limit));
    }

    const [artikels] = await db.query(query, queryParams);
    res.status(200).json(artikels);
  } catch (error) {
    console.error("Error fetching artikels:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar artikel",
      details: error.message,
    });
  }
};

exports.getArtikelById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
            SELECT
                a.*,
                u.nama_lengkap AS nama_penulis,
                k.kategori AS kategori_nama,
                k.kategori_seo AS kategori_seo
            FROM
                artikel a
            JOIN
                user u ON a.id_user = u.id_user
            JOIN
                kategori k ON a.kategori = k.id_kategori
            WHERE a.id_artikel = ?
        `;

    const [artikel] = await db.query(query, [id]);
    if (artikel.length === 0) {
      return res.status(404).json({ error: "Artikel tidak ditemukan" });
    }
    await db.query("UPDATE artikel SET hits = hits + 1 WHERE id_artikel = ?", [
      id,
    ]);
    res.status(200).json(artikel[0]);
  } catch (error) {
    console.error("Error fetching artikel by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil artikel", details: error.message });
  }
};

exports.getArtikelByJudulSeo = async (req, res) => {
  try {
    const { judul_seo } = req.params;

    const [artikel] = await db.query(
      `SELECT
        a.*,
        u.nama_lengkap AS nama_penulis,
        k.kategori AS kategori_nama,
        k.kategori_seo AS kategori_seo
       FROM artikel a 
       JOIN
                user u ON a.id_user = u.id_user
       JOIN kategori k ON a.kategori = k.id_kategori 
       WHERE a.judul_seo = ?`,
      [judul_seo]
    );

    if (artikel.length === 0) {
      return res.status(404).json({ error: "Artikel tidak ditemukan" });
    }

    await db.query("UPDATE artikel SET hits = hits + 1 WHERE judul_seo = ?", [
      judul_seo,
    ]);

    res.status(200).json(artikel[0]);
  } catch (error) {
    console.error("Error fetching artikel by judul_seo:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil artikel", details: error.message });
  }
};

// --- Fungsi untuk menghapus artikel ---
exports.deleteArtikel = async (req, res) => {
  try {
    const { id } = req.params;
    const [artikel] = await db.query(
      "SELECT gambar FROM artikel WHERE id_artikel = ?",
      [id]
    );
    const gambarPathToDelete = artikel.length > 0 ? artikel[0].gambar : null;
    const [result] = await db.query(
      "DELETE FROM artikel WHERE id_artikel = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Artikel tidak ditemukan" });
    }

    if (
      gambarPathToDelete &&
      gambarPathToDelete.startsWith("/public/uploads/artikel")
    ) {
      const fullPath = path.join(__dirname, "..", gambarPathToDelete);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => {
          if (err) console.error("Gagal menghapus file gambar:", fullPath, err);
          else console.log("File gambar dihapus:", fullPath);
        });
      }
    }

    res.status(200).json({ message: "Artikel berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting artikel:", error);
    res
      .status(500)
      .json({ error: "Gagal menghapus artikel", details: error.message });
  }
};
