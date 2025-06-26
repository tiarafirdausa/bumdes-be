const db = require("../models/db"); 
const path = require("path");
const fs = require("fs");

exports.createKategoriGaleriFoto = async (req, res) => {
  try {
    const { kategori } = req.body;

    if (!kategori) {
      return res.status(400).json({ error: "Nama kategori wajib diisi." });
    }
    const [existingKategori] = await db.query(
      "SELECT id FROM galeri_foto_kategori WHERE kategori = ?",
      [kategori]
    );
    if (existingKategori.length > 0) {
      return res
        .status(409)
        .json({ error: "Kategori dengan nama ini sudah ada." });
    }

    const [result] = await db.query(
      "INSERT INTO galeri_foto_kategori (kategori) VALUES (?)",
      [kategori]
    );

    res.status(201).json({
      id: result.insertId,
      kategori,
      message: "Kategori galeri berhasil ditambahkan.",
    });
  } catch (error) {
    console.error("Error membuat kategori galeri:", error);
    res
      .status(500)
      .json({ error: "Gagal membuat kategori galeri", details: error.message });
  }
};


exports.getAllKategoriGaleriFoto = async (req, res) => {
  try {
    const [kategoris] = await db.query("SELECT * FROM galeri_foto_kategori");
    res.status(200).json(kategoris);
  } catch (error) {
    console.error("Error mendapatkan daftar kategori galeri:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar kategori galeri",
      details: error.message,
    });
  }
};


exports.getKategoriGaleriFotoById = async (req, res) => {
  try {
    const { id } = req.params;
    const [kategori] = await db.query(
      "SELECT * FROM galeri_foto_kategori WHERE id = ?",
      [id]
    );
    if (kategori.length === 0) {
      return res.status(404).json({ error: "Kategori tidak ditemukan." });
    }
    res.status(200).json(kategori[0]);
  } catch (error) {
    console.error("Error mendapatkan kategori galeri berdasarkan ID:", error);
    res.status(500).json({
      error: "Gagal mengambil kategori galeri",
      details: error.message,
    });
  }
};


exports.updateKategoriGaleriFoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { kategori } = req.body;

    if (!kategori) {
      return res.status(400).json({ error: "Nama kategori wajib diisi." });
    }

    const [existingKategori] = await db.query(
      "SELECT id FROM galeri_foto_kategori WHERE kategori = ? AND id != ?",
      [kategori, id]
    );
    if (existingKategori.length > 0) {
      return res
        .status(409)
        .json({ error: "Kategori dengan nama ini sudah ada." });
    }

    const [result] = await db.query(
      "UPDATE galeri_foto_kategori SET kategori = ? WHERE id = ?",
      [kategori, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Kategori tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({
      message: "Kategori galeri berhasil diperbarui.",
    });
  } catch (error) {
    console.error("Error memperbarui kategori galeri:", error);
    res
      .status(500)
      .json({ error: "Gagal memperbarui kategori galeri", details: error.message });
  }
};


exports.deleteKategoriGaleriFoto = async (req, res) => {
  try {
    const { id } = req.params;

    const [linkedPhotos] = await db.query(
      "SELECT COUNT(*) AS count FROM galeri_foto WHERE kategori = ?",
      [id]
    );

    if (linkedPhotos[0].count > 0) {
      return res.status(409).json({
        error: "Tidak dapat menghapus kategori. Ada foto yang masih terhubung dengan kategori ini.",
        details: `${linkedPhotos[0].count} foto masih menggunakan kategori ini.`,
      });
    }

    const [result] = await db.query(
      "DELETE FROM galeri_foto_kategori WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Kategori tidak ditemukan." });
    }

    res.status(200).json({ message: "Kategori galeri berhasil dihapus." });
  } catch (error) {
    console.error("Error menghapus kategori galeri:", error);
    res
      .status(500)
      .json({ error: "Gagal menghapus kategori galeri", details: error.message });
  }
};
