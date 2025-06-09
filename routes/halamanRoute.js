const express = require('express');
const router = express.Router();
const halamanController = require('../controllers/halamanController');
const { halamanImageUpload } = require('../validation/configMulter');

// Route untuk membuat halaman baru (POST /halaman)
router.post('/', halamanImageUpload.single('gambar'), halamanController.createHalaman); 
// Route untuk mendapatkan semua halaman (GET /halaman)
router.get('/', halamanController.getHalamans);
// Route untuk mendapatkan halaman berdasarkan
// ID (GET /halaman/:id)
router.get('/:id', halamanController.getHalamanById);
// Route untuk memperbarui halaman berdasarkan
// ID (PUT /halaman/:id)
router.put('/:id', halamanImageUpload.single('gambar'), halamanController.updateHalaman);
// Route untuk menghapus halaman berdasarkan
// ID (DELETE /halaman/:id)
router.delete('/:id', halamanController.deleteHalaman);

module.exports = router;