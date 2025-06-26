// Anda perlu mengimpor ini di file route Anda
const express = require('express');
const router = express.Router();
const fotoController = require('../controllers/fotoController');
const { galeriImageUpload } = require('../validation/configMulter');

// Routes untuk galeri_foto
router.post('/', galeriImageUpload.single('gambar'), fotoController.createGaleriFoto);
router.get('/', fotoController.getAllGaleriFoto);
router.get('/:id', fotoController.getGaleriFotoById);
router.put('/:id', galeriImageUpload.single('gambar'), fotoController.updateGaleriFoto);
router.delete('/:id', fotoController.deleteGaleriFoto);

module.exports = router;