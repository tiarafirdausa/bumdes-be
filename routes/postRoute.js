// routes/postRoute.js 
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { postImageUpload } = require('../validation/configMulter');

router.post('/', postImageUpload, postController.createPost); 
router.get('/', postController.getPosts);
router.get('/:id', postController.getPostById);
router.get('/:slug', postController.getPostBySlug); 
router.get("/category/:slug", postController.getPostByCategory);
router.put('/id/:id', postImageUpload, postController.updatePost);
router.delete('/:id', postController.deletePost);

module.exports = router;