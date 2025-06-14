const express = require('express');
const router = express.Router();
const halamanController = require('../controllers/halamanController');
const { halamanImageUpload } = require('../validation/configMulter');

router.post('/', halamanImageUpload.single('gambar'), halamanController.createHalaman); 
router.get('/', halamanController.getHalamans);
router.get('/:id', halamanController.getHalamanById);
router.put('/:id', halamanImageUpload.single('gambar'), halamanController.updateHalaman);
router.delete('/:id', halamanController.deleteHalaman);

module.exports = router;