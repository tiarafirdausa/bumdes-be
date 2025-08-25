const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const deleteFile = (filePath, context) => {
  if (
    !filePath ||
    typeof filePath !== "string" ||
    !filePath.startsWith("/uploads/banners/")
  ) {
    console.error(
      `Invalid or suspicious file path for deletion (${context}):`,
      filePath
    );
    return;
  }

  const fullPath = path.join(__dirname, "..", "..", "public", filePath);

  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr)
        console.error(`Error deleting file (${context}):`, fullPath, unlinkErr);
      else console.log(`File deleted (${context}):`, fullPath);
    });
  } else {
    console.log(`File not found for deletion (${context}):`, fullPath);
  }
};

exports.createBanner = async (req, res) => {
  let connection;
  try {
    const { judul, keterangan, link } = req.body;
    const uploadedFile = req.file;

    if (!judul || !uploadedFile) {
      if (uploadedFile) {
        deleteFile(`/uploads/banners/${uploadedFile.filename}`, "createBanner: missing fields");
      }
      return res
        .status(400)
        .json({ error: "Judul dan gambar wajib diisi." });
    }

    const gambar_path = `/uploads/banners/${uploadedFile.filename}`;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      "INSERT INTO banner (judul, gambar, keterangan, link) VALUES (?, ?, ?, ?)",
      [judul, gambar_path, keterangan, link]
    );

    await connection.commit();

    res.status(201).json({
      id: result.insertId,
      judul,
      gambar: gambar_path,
      keterangan,
      link,
      message: "Banner berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    if (connection) await connection.rollback();
    if (req.file) {
      deleteFile(`/uploads/banners/${req.file.filename}`, "createBanner: DB error");
    }

    res
      .status(500)
      .json({ error: "Gagal membuat banner", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.getBanners = async (req, res) => {
  try {
    const {
      pageIndex = 1,
      pageSize = 10,
      query = '',
      sort = {}
    } = req.query;

    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(pageIndex, 10) - 1) * limit;

    let whereClause = "";
    let queryParams = [];

    if (query) {
      whereClause = "WHERE judul LIKE ? OR keterangan LIKE ?";
      const searchTerm = `%${query}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    let orderBy = "ORDER BY id DESC";
    if (sort && sort.key) {
      const sortOrder = sort.order === 'asc' ? 'ASC' : 'DESC';
      orderBy = `ORDER BY ?? ${sortOrder}`;
      queryParams.push(sort.key);
    } else {
      orderBy = 'ORDER BY id DESC';
    }

    const [totalItemsResult] = await db.query(
      `SELECT COUNT(*) as count FROM banner ${whereClause}`,
      queryParams.slice(0, queryParams.length - (sort.key ? 1 : 0))
    );
    const totalItems = totalItemsResult[0].count;

    const [banners] = await db.query(
      `SELECT * FROM banner ${whereClause} ${orderBy} LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    res.status(200).json({
      data: banners,
      pagination: {
        totalItems,
        pageIndex: parseInt(pageIndex, 10),
        pageSize: parseInt(pageSize, 10),
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar banner",
      details: error.message,
    });
  }
};

exports.getBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const [banner] = await db.query("SELECT * FROM banner WHERE id = ?", [id]);

    if (banner.length === 0) {
      return res.status(404).json({ error: "Banner tidak ditemukan" });
    }

    res.status(200).json(banner[0]);
  } catch (error) {
    console.error("Error fetching banner by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil banner", details: error.message });
  }
};

exports.updateBanner = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { judul, keterangan, link } = req.body;
    const uploadedFile = req.file;

    let updateFields = [];
    let updateValues = [];

    const [oldBannerData] = await db.query("SELECT gambar FROM banner WHERE id = ?", [id]);
    if (oldBannerData.length === 0) {
      if (uploadedFile) {
        deleteFile(`/uploads/banners/${uploadedFile.filename}`, "updateBanner: not found");
      }
      return res.status(404).json({ error: "Banner tidak ditemukan." });
    }
    const oldGambarPath = oldBannerData[0].gambar;

    if (judul !== undefined) {
      updateFields.push("judul = ?");
      updateValues.push(judul);
    }
    if (keterangan !== undefined) {
      updateFields.push("keterangan = ?");
      updateValues.push(keterangan);
    }
    if (link !== undefined) {
      updateFields.push("link = ?");
      updateValues.push(link);
    }

    if (uploadedFile) {
      const newGambarPath = `/uploads/banners/${uploadedFile.filename}`;
      updateFields.push("gambar = ?");
      updateValues.push(newGambarPath);
      if (oldGambarPath && oldGambarPath.startsWith("/uploads/banners/")) {
        deleteFile(oldGambarPath, "updateBanner: old image replaced");
      }
    }

    if (updateFields.length === 0) {
      if (uploadedFile) {
        deleteFile(`/uploads/banners/${uploadedFile.filename}`, "updateBanner: no data");
      }
      return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const query = `UPDATE banner SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);
    const [result] = await connection.query(query, updateValues);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Banner tidak ditemukan." });
    }

    res.status(200).json({
      message: "Banner berhasil diperbarui",
      new_image_path: uploadedFile ? `/uploads/banners/${uploadedFile.filename}` : undefined,
    });
  } catch (error) {
    console.error("Error updating banner:", error);
    if (connection) await connection.rollback();
    if (req.file) {
      deleteFile(`/uploads/banners/${req.file.filename}`, "updateBanner: DB error");
    }
    res
      .status(500)
      .json({ error: "Gagal memperbarui banner", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.deleteBanner = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [banner] = await connection.query("SELECT gambar FROM banner WHERE id = ?", [id]);
    const gambarPathToDelete = banner.length > 0 ? banner[0].gambar : null;

    const [result] = await connection.query("DELETE FROM banner WHERE id = ?", [id]);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Banner tidak ditemukan" });
    }

    if (gambarPathToDelete && gambarPathToDelete.startsWith("/uploads/banners/")) {
      deleteFile(gambarPathToDelete, "deleteBanner: image");
    }

    res.status(200).json({ message: "Banner berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting banner:", error);
    if (connection) await connection.rollback();
    res
      .status(500)
      .json({ error: "Gagal menghapus banner", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};