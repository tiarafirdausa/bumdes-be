const express = require('express');
const router = express.Router();
const mediaCategoryController = require('../controllers/mediaCategoryController');  

router.post('/', mediaCategoryController.createMediaCategory);
router.get('/', mediaCategoryController.getAllMediaCategories);
router.get('/id/:id', mediaCategoryController.getMediaCategoryById);
router.get('/:slug', mediaCategoryController.getMediaCategoryBySlug);
router.put('/:id', mediaCategoryController.updateMediaCategory);
router.delete('/:id', mediaCategoryController.deleteMediaCategory);

module.exports = router;