const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { pageImageUpload } = require('../validation/configMulter'); 

router.post('/', pageImageUpload.single('featured_image'), pageController.createPage); 
router.get('/', pageController.getPages);
router.get('/id/:id', pageController.getPageById);
router.get('/:slug', pageController.getPageBySlug);
router.put('/id/:id', pageImageUpload.single('featured_image'), pageController.updatePage);
router.delete('/:id', pageController.deletePage);

module.exports = router;