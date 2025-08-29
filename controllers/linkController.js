const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const deleteFile = (filePath, context) => {
  if (
    !filePath ||
    typeof filePath !== "string" ||
    !filePath.startsWith("/uploads/links/")
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

exports.createLink = async (req, res) => {
  let connection;
  try {
    const { judul, link, kategori, keterangan } = req.body;
    const uploadedFile = req.file;

    if (!judul || !link) {
      if (uploadedFile) {
        deleteFile(`/uploads/links/${uploadedFile.filename}`, "createLink: missing fields");
      }
      return res
        .status(400)
        .json({ error: "Judul dan link wajib diisi." });
    }

    const gambar_path = uploadedFile ? `/uploads/links/${uploadedFile.filename}` : null;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      "INSERT INTO links (judul, link, gambar, kategori, keterangan) VALUES (?, ?, ?, ?, ?)",
      [judul, link, gambar_path, kategori, keterangan]
    );

    await connection.commit();

    res.status(201).json({
      id: result.insertId,
      judul,
      link,
      gambar: gambar_path,
      kategori,
      keterangan,
      message: "Link berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating link:", error);
    if (connection) await connection.rollback();
    if (req.file) {
      deleteFile(`/uploads/links/${req.file.filename}`, "createLink: DB error");
    }
    res
      .status(500)
      .json({ error: "Gagal membuat link", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.getLinks = async (req, res) => {
  try {
    const {
      pageIndex = 1,
      pageSize = 10,
      query = '',
      kategori = '',
      sort = {}
    } = req.query;

    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(pageIndex, 10) - 1) * limit;

    let whereClauses = [];
    let queryParams = [];

    if (query) {
      whereClauses.push("(judul LIKE ? OR keterangan LIKE ?)");
      const searchTerm = `%${query}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    if (kategori) {
      whereClauses.push("kategori = ?");
      queryParams.push(kategori);
    }
    
    let whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let orderBy = "ORDER BY created_at DESC";
    if (sort && sort.key) {
      const sortOrder = sort.order === 'asc' ? 'ASC' : 'DESC';
      orderBy = `ORDER BY ?? ${sortOrder}`;
      queryParams.push(sort.key);
    }

    const [totalItemsResult] = await db.query(
      `SELECT COUNT(*) as count FROM links ${whereClause}`,
      queryParams.slice(0, queryParams.length - (sort.key ? 1 : 0))
    );
    const totalItems = totalItemsResult[0].count;

    const [links] = await db.query(
      `SELECT * FROM links ${whereClause} ${orderBy} LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    res.status(200).json({
      data: links,
      pagination: {
        totalItems,
        pageIndex: parseInt(pageIndex, 10),
        pageSize: parseInt(pageSize, 10),
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching links:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar link",
      details: error.message,
    });
  }
};

exports.getLinkById = async (req, res) => {
  try {
    const { id } = req.params;
    const [link] = await db.query("SELECT * FROM links WHERE id = ?", [id]);

    if (link.length === 0) {
      return res.status(404).json({ error: "Link tidak ditemukan" });
    }

    res.status(200).json(link[0]);
  } catch (error) {
    console.error("Error fetching link by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil link", details: error.message });
  }
};

exports.updateLink = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { judul, link, kategori, keterangan } = req.body;
    const uploadedFile = req.file;

    let updateFields = [];
    let updateValues = [];

    const [oldLinkData] = await db.query("SELECT gambar FROM links WHERE id = ?", [id]);
    if (oldLinkData.length === 0) {
      if (uploadedFile) {
        deleteFile(`/uploads/links/${uploadedFile.filename}`, "updateLink: not found");
      }
      return res.status(404).json({ error: "Link tidak ditemukan." });
    }
    const oldGambarPath = oldLinkData[0].gambar;

    if (judul !== undefined) {
      updateFields.push("judul = ?");
      updateValues.push(judul);
    }
    if (link !== undefined) {
      updateFields.push("link = ?");
      updateValues.push(link);
    }
    if (kategori !== undefined) {
      updateFields.push("kategori = ?");
      updateValues.push(kategori);
    }
    if (keterangan !== undefined) {
      updateFields.push("keterangan = ?");
      updateValues.push(keterangan);
    }

    if (uploadedFile) {
      const newGambarPath = `/uploads/links/${uploadedFile.filename}`;
      updateFields.push("gambar = ?");
      updateValues.push(newGambarPath);
      if (oldGambarPath && oldGambarPath.startsWith("/uploads/links/")) {
        deleteFile(oldGambarPath, "updateLink: old image replaced");
      }
    }

    if (updateFields.length === 0) {
      if (uploadedFile) {
        deleteFile(`/uploads/links/${uploadedFile.filename}`, "updateLink: no data");
      }
      return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const query = `UPDATE links SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);
    const [result] = await connection.query(query, updateValues);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Link tidak ditemukan." });
    }

    res.status(200).json({
      message: "Link berhasil diperbarui",
      new_image_path: uploadedFile ? `/uploads/links/${uploadedFile.filename}` : undefined,
    });
  } catch (error) {
    console.error("Error updating link:", error);
    if (connection) await connection.rollback();
    if (req.file) {
      deleteFile(`/uploads/links/${req.file.filename}`, "updateLink: DB error");
    }
    res
      .status(500)
      .json({ error: "Gagal memperbarui link", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.deleteLink = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [linkData] = await connection.query("SELECT gambar FROM links WHERE id = ?", [id]);
    const gambarPathToDelete = linkData.length > 0 ? linkData[0].gambar : null;

    const [result] = await connection.query("DELETE FROM links WHERE id = ?", [id]);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Link tidak ditemukan" });
    }

    if (gambarPathToDelete && gambarPathToDelete.startsWith("/uploads/links/")) {
      deleteFile(gambarPathToDelete, "deleteLink: image");
    }

    res.status(200).json({ message: "Link berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting link:", error);
    if (connection) await connection.rollback();
    res
      .status(500)
      .json({ error: "Gagal menghapus link", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};