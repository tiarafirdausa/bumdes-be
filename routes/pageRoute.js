const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { pageImageUpload } = require('../validation/configMulter');

router.post('/', pageImageUpload, pageController.createPage);
router.get('/', pageController.getPages);
router.get('/:slug', pageController.getPageBySlug);
router.get('/id/:id', pageController.getPageById);
router.put('/:id', pageImageUpload, pageController.updatePage);
router.delete('/:id', pageController.deletePage);

module.exports = router;