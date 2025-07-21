// routes/tagRoute.js
const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController'); 

router.post('/', tagController.createTag);
router.get('/', tagController.getAllTags);
router.get('/id/:id', tagController.getTagById);
router.get('/:slug', tagController.getTagBySlug);
router.put('/:id', tagController.updateTag);
router.delete('/:id', tagController.deleteTag);

module.exports = router;