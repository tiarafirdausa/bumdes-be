const db = require("../models/db");

exports.createMenu = async (req, res) => {
  const { judul, induk, jenis_link, link, urut } = req.body;
  const kategori_menu = "main";
  try {
    const [result] = await db.query(
      "INSERT INTO menu (judul, kategori_menu, induk, jenis_link, link, urut) VALUES (?, ?, ?, ?, ?, ?)",
      [judul, kategori_menu, induk, jenis_link, link, urut]
    );

    res.status(201).json({
      id: result.insertId,
      judul,
      kategori_menu,
      induk,
      jenis_link,
      link,
      urut,
    });
  } catch (error) {
    console.error("Kesalahan saat membuat menu:", error);
    res
      .status(500)
      .json({ error: "Gagal membuat menu", details: error.message });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
          m.id_menu,
          m.judul,
          m.kategori_menu,
          m.induk,
          m.jenis_link,
          m.urut,
          CASE
              WHEN m.jenis_link = 'halaman' THEN h.judul_seo    
              WHEN m.jenis_link = 'kategori' THEN k.kategori_seo 
              ELSE m.link                                     
          END AS link_final                                   
      FROM
          menu m
      LEFT JOIN
          halaman h ON m.link = h.id_halaman AND m.jenis_link = 'halaman'
      LEFT JOIN
          kategori k ON m.link = k.id_kategori AND m.jenis_link = 'kategori' -- Join baru untuk kategori
      ORDER BY
          m.urut ASC
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Kesalahan saat mengambil menu:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil menu", details: error.message });
  }
};

exports.updateMenu = async (req, res) => {
  const { id } = req.params;
  const { judul, induk, jenis_link, link, urut } = req.body;
  const kategori_menu = "main";
  try {
    const [result] = await db.query(
      "UPDATE menu SET judul = ?, kategori_menu = ?, induk = ?, jenis_link = ?, link = ?, urut = ? WHERE id_menu = ?",
      [judul, kategori_menu, induk, jenis_link, link, urut, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }

    res.status(200).json({ message: "Menu berhasil diperbarui" });
  } catch (error) {
    console.error("Kesalahan saat memperbarui menu:", error);
    res
      .status(500)
      .json({ error: "Gagal memperbarui menu", details: error.message });
  }
};

exports.deleteMenu = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query("DELETE FROM menu WHERE id_menu = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }

    res.status(200).json({ message: "Menu berhasil dihapus" });
  } catch (error) {
    console.error("Kesalahan saat menghapus menu:", error);
    res
      .status(500)
      .json({ error: "Gagal menghapus menu", details: error.message });
  }
};

// menuController.js
exports.getMenuById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query("SELECT * FROM menu WHERE id_menu = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Menu not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
};
