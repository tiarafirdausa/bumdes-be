// controllers/commentController.js 
const db = require("../models/db");

exports.addComment = async (req, res) => {
  const { author_name, content, post_id } = req.body; 

  if (!author_name || !content || !post_id) {
    return res
      .status(400)
      .json({ error: "Nama penulis, konten komentar, dan ID postingan wajib diisi." });
  }

  try {
    const [postExists] = await db.query("SELECT id FROM posts WHERE id = ?", [post_id]);
    if (postExists.length === 0) {
      return res.status(404).json({ error: "Postingan tidak ditemukan." });
    }

    const query = `
      INSERT INTO comments (post_id, author_name, content, status, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    const values = [post_id, author_name, content, 'pending']; 
    const [result] = await db.query(query, values);

    if (result.affectedRows === 1) {
      res.status(201).json({
        message: "Komentar berhasil ditambahkan. Menunggu moderasi.",
        id: result.insertId,
        post_id,
        author_name,
        content,
        status: 'pending',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '), 
      });
    } else {
      res.status(500).json({ error: "Gagal menambahkan komentar" });
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    res
      .status(500)
      .json({
        error: "Terjadi kesalahan server saat menambahkan komentar",
        details: error.message,
      });
  }
};

exports.getCommentsByPostId = async (req, res) => {
  try {
    const { postId } = req.params; 
    const { status } = req.query;

    let query = `
      SELECT
          c.id, c.post_id, c.author_name, c.content, c.status, c.created_at,
          p.title AS post_title, p.slug AS post_slug
      FROM
          comments c
      JOIN
          posts p ON c.post_id = p.id
      WHERE c.post_id = ?
    `;
    const queryParams = [postId];

    if (status && ['pending', 'approved', 'spam'].includes(status)) {
        query += ` AND c.status = ?`;
        queryParams.push(status);
    } else {
        query += ` AND c.status = 'approved'`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const [comments] = await db.query(query, queryParams);
    res.status(200).json(comments);
  } catch (error) {
    console.error("Error fetching comments by post ID:", error);
    res
      .status(500)
      .json({
        error: "Gagal mengambil daftar komentar",
        details: error.message,
      });
  }
};

exports.getAllComments = async (req, res) => {
    try {
        const {
            pageIndex = 1,
            pageSize = 10,
            query: search = "",
            status,
            postId,
        } = req.query;

        const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
        const parsedPageSize = parseInt(pageSize);

        const sortKey = req.query['sort[key]'] || 'created_at';
        const sortOrder = req.query['sort[order]'] || 'desc';

        let whereClauses = [];
        let queryParams = [];

        if (search) {
            whereClauses.push("(c.author_name LIKE ? OR c.content LIKE ?)");
            queryParams.push(`%${search}%`, `%${search}%`);
        }
        if (status && ['pending', 'approved', 'spam'].includes(status)) {
            whereClauses.push(`c.status = ?`);
            queryParams.push(status);
        }
        if (postId) {
            whereClauses.push(`c.post_id = ?`);
            queryParams.push(postId);
        }

        const whereSql =
            whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const [comments] = await db.query(
            `SELECT
                c.id, c.post_id, c.author_name, c.content, c.status, c.created_at,
                p.title AS post_title, p.slug AS post_slug
            FROM
                comments c
            LEFT JOIN
                posts p ON c.post_id = p.id
            ${whereSql}
            ORDER BY c.${sortKey} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
            LIMIT ? OFFSET ?`,
            [...queryParams, parsedPageSize, offset]
        );

        const [totalResults] = await db.query(
            `SELECT COUNT(c.id) AS total FROM comments c
            LEFT JOIN posts p ON c.post_id = p.id
            ${whereSql}`,
            queryParams
        );

        const totalItems = totalResults[0].total;
        const totalPages = Math.ceil(totalItems / parsedPageSize);

        res.status(200).json({
            data: comments,
            pagination: {
                totalItems,
                totalPages,
                currentPage: parseInt(pageIndex),
                itemsPerPage: parsedPageSize,
            },
        });
    } catch (error) {
        console.error("Error fetching all comments:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar komentar",
            details: error.message,
        });
    }
};

exports.updateCommentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; 

        if (!status || !['pending', 'approved', 'spam'].includes(status)) {
            return res.status(400).json({ error: "Status tidak valid. Harus 'pending', 'approved', atau 'spam'." });
        }

        const [result] = await db.query(
            "UPDATE comments SET status = ? WHERE id = ?",
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Komentar tidak ditemukan atau status tidak berubah." });
        }

        res.status(200).json({ message: `Status komentar berhasil diperbarui menjadi '${status}'.` });
    } catch (error) {
        console.error("Error updating comment status:", error);
        res.status(500).json({ error: "Gagal memperbarui status komentar", details: error.message });
    }
};


exports.deleteComment = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `DELETE FROM comments WHERE id = ?`;
    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 1) {
      res.status(200).json({ message: "Komentar berhasil dihapus." });
    } else {
      res
        .status(404)
        .json({ error: "Komentar tidak ditemukan atau gagal dihapus." });
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
    res
      .status(500)
      .json({
        error: "Terjadi kesalahan server saat menghapus komentar",
        details: error.message,
      });
  }
};
