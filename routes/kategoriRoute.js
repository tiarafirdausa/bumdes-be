const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController'); 

router.post('/', kategoriController.createKategori);
router.get('/', kategoriController.getKategoris);
router.get('/:kategori_seo', kategoriController.getKategoriBySeo);
router.get('/:id', kategoriController.getKategoriById);
router.put('/:id', kategoriController.updateKategori);
router.delete('/:id', kategoriController.deleteKategori);
module.exports = router;