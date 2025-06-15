// backend/routes/artikelRoute.js
const express = require('express');
const router = express.Router();
const artikelController = require('../controllers/artikelController');
const { articleImageUpload } = require('../validation/configMulter');

router.post('/', articleImageUpload.single('gambar'), artikelController.createArtikel);
router.get('/', artikelController.getArtikels);
router.get('/id/:id', artikelController.getArtikelById);
router.get('/:judul_seo', artikelController.getArtikelByJudulSeo);
router.put('/id/:id', articleImageUpload.single('gambar'), artikelController.updateArtikel);
router.delete('/id/:id', artikelController.deleteArtikel);

module.exports = router;