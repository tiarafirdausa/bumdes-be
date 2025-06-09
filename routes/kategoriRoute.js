const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController'); // Pastikan path ini benar

// Route untuk membuat kategori baru (POST /kategori)
router.post('/', kategoriController.createKategori);
// Route untuk mendapatkan semua kategori (GET /kategori)
router.get('/', kategoriController.getKategoris);
// Route untuk mendapatkan kategori berdasarkan ID (GET /kategori/:id)
router.get('/:id', kategoriController.getKategoriById);
// Route untuk memperbarui kategori berdasarkan ID (PUT /kategori/:id)
router.put('/:id', kategoriController.updateKategori);
// Route untuk menghapus kategori berdasarkan ID (DELETE /kategori/:id)
router.delete('/:id', kategoriController.deleteKategori);
module.exports = router;