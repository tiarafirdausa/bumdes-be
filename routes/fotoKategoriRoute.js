// Anda perlu mengimpor ini di file route Anda
const express = require('express');
const router = express.Router();
const fotoKategoriController = require('../controllers/fotoKategoriController');

// Routes untuk galeri_foto_kategori
router.post('/', fotoKategoriController.createKategoriGaleriFoto);
router.get('/', fotoKategoriController.getAllKategoriGaleriFoto);
router.get('/:id', fotoKategoriController.getKategoriGaleriFotoById);
router.put('/:id', fotoKategoriController.updateKategoriGaleriFoto);
router.delete('/:id', fotoKategoriController.deleteKategoriGaleriFoto);

module.exports = router;