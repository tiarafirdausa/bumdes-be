const db = require("../models/db"); 
const path = require("path");
const fs = require("fs");


exports.createGaleriFoto = async (req, res) => {
  try {
    const { judul, kategori } = req.body;

    if (!judul || !kategori) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error(
              "Error menghapus file terunggah karena field hilang:",
              unlinkErr
            );
          }
        });
      }
      return res
        .status(400)
        .json({ error: "Judul dan kategori wajib diisi." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "File gambar wajib diunggah." });
    }

    const gambarPath = `/public/uploads/galeri/${req.file.filename}`;

    const now = new Date();
    const tanggal = now.toISOString().slice(0, 10);

    const [result] = await db.query(
      "INSERT INTO galeri_foto (judul, gambar, kategori, tanggal) VALUES (?, ?, ?, ?)",
      [judul, gambarPath, kategori, tanggal]
    );

    res.status(201).json({
      id: result.insertId,
      judul,
      gambar: gambarPath,
      kategori,
      tanggal,
      message: "Foto galeri berhasil ditambahkan.",
    });
  } catch (error) {
    console.error("Error membuat foto galeri:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            "Error menghapus file terunggah saat kegagalan DB:",
            unlinkErr
          );
        }
      });
    }
    res
      .status(500)
      .json({ error: "Gagal membuat foto galeri", details: error.message });
  }
};


exports.getAllGaleriFoto = async (req, res) => {
  try {
    const { kategoriId } = req.query; 
    let query = `
            SELECT
                gf.*,
                gfk.kategori AS nama_kategori
            FROM
                galeri_foto gf
            JOIN
                galeri_foto_kategori gfk ON gf.kategori = gfk.id
        `;
    const queryParams = [];

    if (kategoriId) {
      query += ` WHERE gf.kategori = ?`;
      queryParams.push(kategoriId);
    }

    query += ` ORDER BY gf.tanggal DESC`;

    const [fotos] = await db.query(query, queryParams);
    res.status(200).json(fotos);
  } catch (error) {
    console.error("Error mendapatkan daftar foto galeri:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar foto galeri",
      details: error.message,
    });
  }
};

exports.getGaleriFotoById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
            SELECT
                gf.*,
                gfk.kategori AS nama_kategori
            FROM
                galeri_foto gf
            JOIN
                galeri_foto_kategori gfk ON gf.kategori = gfk.id
            WHERE gf.id = ?
        `;

    const [foto] = await db.query(query, [id]);
    if (foto.length === 0) {
      return res.status(404).json({ error: "Foto galeri tidak ditemukan." });
    }
    res.status(200).json(foto[0]);
  } catch (error) {
    console.error("Error mendapatkan foto galeri berdasarkan ID:", error);
    res.status(500).json({
      error: "Gagal mengambil foto galeri",
      details: error.message,
    });
  }
};


exports.updateGaleriFoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, kategori, gambar: gambarFromBody } = req.body; 

    let updateFields = [];
    let updateValues = [];
    let responseBody = {}; 

    const [oldFoto] = await db.query(
      "SELECT gambar FROM galeri_foto WHERE id = ?",
      [id]
    );
    const oldGambarPath = oldFoto.length > 0 ? oldFoto[0].gambar : null;

    if (judul !== undefined) {
      updateFields.push("judul = ?");
      updateValues.push(judul);
    }
    if (kategori !== undefined) {
      updateFields.push("kategori = ?");
      updateValues.push(kategori);
    }

    if (req.file) {
      const newGambarPath = `/public/uploads/galeri/${req.file.filename}`;
      updateFields.push("gambar = ?");
      updateValues.push(newGambarPath);
      responseBody.new_gambar_path = newGambarPath;

      if (
        oldGambarPath &&
        oldGambarPath.startsWith("/public/uploads/galeri")
      ) {
        const fullOldPath = path.join(__dirname, "..", oldGambarPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Gagal menghapus gambar lama:", fullOldPath, unlinkErr);
            } else {
              console.log("Gambar lama dihapus:", fullOldPath);
            }
          });
        }
      }
    } else if (gambarFromBody !== undefined && (gambarFromBody === null || gambarFromBody === "")) {
      updateFields.push("gambar = ?");
      updateValues.push(null);
      responseBody.gambar_dikosongkan = true;

      if (
        oldGambarPath &&
        oldGambarPath.startsWith("/public/uploads/galeri")
      ) {
        const fullOldPath = path.join(__dirname, "..", oldGambarPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Gagal menghapus gambar lama:", fullOldPath, unlinkErr);
            } else {
              console.log("Gambar lama dihapus:", fullOldPath);
            }
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

    const query = `UPDATE galeri_foto SET ${updateFields.join(
      ", "
    )} WHERE id = ?`;
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error(
              "Error menghapus file terunggah setelah tidak ada perubahan DB:",
              unlinkErr
            );
          }
        });
      }
      return res.status(404).json({
        error: "Foto galeri tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({
      message: "Foto galeri berhasil diperbarui",
      ...responseBody,
    });
  } catch (error) {
    console.error("Error memperbarui foto galeri:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            "Error menghapus file terunggah saat kegagalan DB:",
            unlinkErr
          );
        }
      });
    }
    res
      .status(500)
      .json({ error: "Gagal memperbarui foto galeri", details: error.message });
  }
};


exports.deleteGaleriFoto = async (req, res) => {
  try {
    const { id } = req.params;
    const [foto] = await db.query(
      "SELECT gambar FROM galeri_foto WHERE id = ?",
      [id]
    );
    const gambarPathToDelete = foto.length > 0 ? foto[0].gambar : null;

    const [result] = await db.query("DELETE FROM galeri_foto WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Foto galeri tidak ditemukan." });
    }

    if (
      gambarPathToDelete &&
      gambarPathToDelete.startsWith("/public/uploads/galeri")
    ) {
      const fullPath = path.join(__dirname, "..", gambarPathToDelete);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (unlinkErr) => {
          if (unlinkErr) {
            console.error(
              "Gagal menghapus file gambar galeri:",
              fullPath,
              unlinkErr
            );
          } else {
            console.log("File gambar galeri dihapus:", fullPath);
          }
        });
      }
    }

    res.status(200).json({ message: "Foto galeri berhasil dihapus." });
  } catch (error) {
    console.error("Error menghapus foto galeri:", error);
    res
      .status(500)
      .json({ error: "Gagal menghapus foto galeri", details: error.message });
  }
};

