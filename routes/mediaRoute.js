// routes/mediaRoute.js (Nama file diubah dari galeriRoute.js)
const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController'); 
const { mediaUpload } = require('../validation/configMulter'); 

router.post('/', mediaUpload, mediaController.createMediaEntry);
router.get('/', mediaController.getAllMediaEntries);
router.get('/id/:id', mediaController.getMediaEntryById);
router.get('/category/:slug', mediaController.getMediaByCategorySlug); 
router.put('/id/:id', mediaUpload, mediaController.updateMediaEntry);
router.delete('/:id', mediaController.deleteMediaEntry); 

module.exports = router;