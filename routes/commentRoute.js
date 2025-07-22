// routes/commentRoute.js 
const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController'); 
router.post('/', commentController.addComment); 
router.get('/post/:postId', commentController.getCommentsByPostId); 
router.get('/', commentController.getAllComments);
router.delete('/:id', commentController.deleteComment);
router.put('/:id/status', commentController.updateCommentStatus);

module.exports = router;