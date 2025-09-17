// routes/commentRoute.js 
const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController'); 
const { commentLimiter } = require('../validation/rateLimiters');

router.post('/', commentLimiter, commentController.addComment); 
router.get('/post/:postId', commentController.getCommentsByPostId); 
router.get('/:slug', commentController.getCommentsByPostBySlug);
router.get('/', commentController.getAllComments);
router.delete('/:id', commentController.deleteComment);
router.put('/:id/status', commentController.updateCommentStatus);

module.exports = router;