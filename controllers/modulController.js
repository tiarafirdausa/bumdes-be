// controllers/modulController.js
const db = require("../models/db");

// Menambahkan modul baru
exports.addModul = async (req, res) => {
  const { judul, folder, menu, konten, widget, home, aktif } = req.body;

  // Validasi di sisi backend
  if (!judul || !folder) {
    return res.status(400).json({ error: "Judul dan Folder wajib diisi." });
  }

  if (!menu && !konten && !widget && !home) {
    return res.status(400).json({ error: "Setidaknya satu dari Menu, Konten, Widget, atau Home harus dipilih." });
  }

  if (typeof aktif !== 'boolean') {
    return res.status(400).json({ error: "Nilai Aktif tidak valid." });
  }

  try {
    const query = `INSERT INTO modul (judul, folder, menu, konten, widget, home, aktif) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
      judul, 
      folder, 
      menu, 
      konten, 
      widget, 
      home, 
      aktif
    ];

    const [result] = await db.query(query, values);

    if (result.affectedRows === 1) {
      const [newModul] = await db.query("SELECT * FROM modul WHERE id_modul = ?", [result.insertId]);
      res.status(201).json({
        message: "Modul berhasil ditambahkan.",
        data: newModul[0],
      });
    } else {
      res.status(500).json({ error: "Gagal menambahkan modul." });
    }
  } catch (error) {
    console.error("Error adding modul:", error);
    res.status(500).json({
      error: "Terjadi kesalahan server saat menambahkan modul.",
      details: error.message,
    });
  }
};

// Mendapatkan daftar semua modul
exports.getAllModuls = async (req, res) => {
    try {
        const { query, pageIndex = 1, pageSize = 10 } = req.query;
        const sortKey = req.query['sort[key]'];
        const sortOrder = req.query['sort[order]'];

        let sql = "SELECT * FROM modul";
        let countSql = "SELECT COUNT(id_modul) AS total FROM modul";

        const params = [];
        const countParams = [];

        if (query) {
            const searchQuery = `%${query}%`;
            sql += " WHERE judul LIKE ?";
            countSql += " WHERE judul LIKE ?";
            params.push(searchQuery);
            countParams.push(searchQuery);
        }

        if (sortKey && sortOrder) {
            const validSortKeys = ['judul', 'created_at', 'updated_at', 'aktif', 'home'];
            if (validSortKeys.includes(sortKey)) {
                const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                sql += ` ORDER BY ${sortKey} ${order}`;
            } else {
                sql += " ORDER BY judul ASC";
            }
        } else {
            sql += " ORDER BY judul ASC";
        }

        const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
        sql += " LIMIT ? OFFSET ?";
        params.push(parseInt(pageSize), offset);

        const [moduls] = await db.query(sql, params);
        const [totalResult] = await db.query(countSql, countParams);
        const total = totalResult[0].total;

        res.status(200).json({ moduls, total });

    } catch (error) {
        console.error("Error fetching all moduls:", error);
        res.status(500).json({
            error: "Gagal mengambil daftar modul.",
            details: error.message,
        });
    }
};

// Mendapatkan satu modul berdasarkan ID
exports.getModulById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `SELECT * FROM modul WHERE id_modul = ?`;
    const [modul] = await db.query(query, [id]);

    if (modul.length > 0) {
      res.status(200).json(modul[0]);
    } else {
      res.status(404).json({ error: "Modul tidak ditemukan." });
    }
  } catch (error) {
    console.error("Error fetching modul by ID:", error);
    res.status(500).json({
      error: "Gagal mengambil modul.",
      details: error.message,
    });
  }
};

// Memperbarui data modul
exports.updateModul = async (req, res) => {
  const { id } = req.params;
  const { judul, folder, menu, konten, widget, home, aktif } = req.body;

  // Validasi di sisi backend
  if (!judul || !folder) {
    return res.status(400).json({ error: "Judul dan Folder wajib diisi." });
  }

  if (!menu && !konten && !widget && !home) {
    return res.status(400).json({ error: "Setidaknya satu dari Menu, Konten, Widget, atau Home harus dipilih." });
  }

  if (aktif === undefined) {
    return res.status(400).json({ error: "Nilai Aktif tidak valid." });
  }

  try {
    const query = `UPDATE modul SET judul = ?, folder = ?, menu = ?, konten = ?, widget = ?, home = ?, aktif = ? WHERE id_modul = ?`;
    
    // Menggunakan langsung nilai boolean dari frontend
    const values = [
      judul, 
      folder, 
      menu, 
      konten, 
      widget, 
      home, 
      aktif, 
      id
    ];
    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Modul tidak ditemukan atau data tidak berubah." });
    }

    res.status(200).json({ message: "Modul berhasil diperbarui." });
  } catch (error) {
    console.error("Error updating modul:", error);
    res.status(500).json({
      error: "Gagal memperbarui modul.",
      details: error.message,
    });
  }
};

// Menghapus modul
exports.deleteModul = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `DELETE FROM modul WHERE id_modul = ?`;
    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 1) {
      res.status(200).json({ message: "Modul berhasil dihapus." });
    } else {
      res.status(404).json({ error: "Modul tidak ditemukan atau gagal dihapus." });
    }
  } catch (error) {
    console.error("Error deleting modul:", error);
    res.status(500).json({
      error: "Terjadi kesalahan server saat menghapus modul.",
      details: error.message,
    });
  }
};

exports.getHomeModules = async (req, res) => {
  try {
    const query = `SELECT * FROM modul WHERE home = 1 AND aktif = 1 ORDER BY judul ASC`;
    const [moduls] = await db.query(query);

    res.status(200).json(moduls);
  } catch (error) {
    console.error("Error fetching home modules:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar modul home.",
      details: error.message,
    });
  }
};