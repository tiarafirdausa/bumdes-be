// routes/postRoute.js 
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { postImageUpload } = require('../validation/configMulter');

router.post('/', postImageUpload.single('featured_image'), postController.createPost); 
router.get('/', postController.getPosts);
router.get('/id/:id', postController.getPostById);
router.get('/:slug', postController.getPostBySlug); 
router.put('/id/:id', postImageUpload.single('featured_image'), postController.updatePost);
router.delete('/:id', postController.deletePost);

module.exports = router;