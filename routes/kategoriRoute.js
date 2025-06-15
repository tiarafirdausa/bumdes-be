const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController'); 

router.post('/', kategoriController.createKategori);
router.get('/', kategoriController.getKategoris);
router.get('/id/:id', kategoriController.getKategoriById);
router.get('/:kategori_seo', kategoriController.getKategoriBySeo);
router.put('/id/:id', kategoriController.updateKategori);
router.delete('/id/:id', kategoriController.deleteKategori);
module.exports = router;