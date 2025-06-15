const express = require('express');
const router = express.Router();
const halamanController = require('../controllers/halamanController');
const { halamanImageUpload } = require('../validation/configMulter');

router.post('/', halamanImageUpload.single('gambar'), halamanController.createHalaman); 
router.get('/', halamanController.getHalamans);
router.get('/id/:id', halamanController.getHalamanById);
router.get('/:judul_seo', halamanController.getHalamanByJudulSeo);
router.put('/id/:id', halamanImageUpload.single('gambar'), halamanController.updateHalaman);
router.delete('/id/:id', halamanController.deleteHalaman);

module.exports = router;