const express = require('express');
const router = express.Router();
const galeriController = require('../controllers/galeriController');
const { galeriUpload } = require('../validation/configMulter');

router.post('/', galeriUpload, galeriController.createGaleriEntry);
router.get('/', galeriController.getAllGaleriEntries);
router.get('/:id', galeriController.getGaleriEntryById);
router.put('/:id', galeriUpload, galeriController.updateGaleriEntry); 
router.delete('/:id', galeriController.deleteGaleriEntry);
router.get(':slug', galeriController.getGaleriEntryBySlug);

router.delete('/media/:mediaId', galeriController.deleteGaleriMedia);

module.exports = router;