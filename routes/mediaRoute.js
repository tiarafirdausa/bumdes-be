// routes/mediaRoute.js

const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController'); 
const { mediaUpload } = require('../validation/configMulter'); 

router.post('/', mediaUpload, mediaController.createMediaCollection);
router.get('/', mediaController.getMediaCollections);
router.get('/id/:id', mediaController.getMediaCollectionById);
router.put('/:id', mediaUpload, mediaController.updateMediaCollection);
router.delete('/:id', mediaController.deleteMediaCollection); 

module.exports = router;