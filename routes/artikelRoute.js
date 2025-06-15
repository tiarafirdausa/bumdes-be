// backend/routes/artikelRoute.js
const express = require('express');
const router = express.Router();
const artikelController = require('../controllers/artikelController');
const { articleImageUpload } = require('../validation/configMulter');

router.post('/', articleImageUpload.single('gambar'), artikelController.createArtikel);
router.get('/', artikelController.getArtikels);
router.get('/:judul_seo', artikelController.getArtikelByJudulSeo);
router.get('/:id', artikelController.getArtikelById);
router.put('/:id', articleImageUpload.single('gambar'), artikelController.updateArtikel);
router.delete('/:id', artikelController.deleteArtikel);

module.exports = router;