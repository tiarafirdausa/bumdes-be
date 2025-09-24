// routes/commentRoute.js
const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const { commentLimiter } = require("../validation/rateLimiters");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", commentLimiter, commentController.addComment);
router.get("/post/:postId", commentController.getCommentsByPostId);
router.get("/:slug", commentController.getCommentsByPostBySlug);
router.get("/", commentController.getAllComments);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  commentController.deleteComment
);
router.put(
  "/:id/status",
  protect,
  authorize("admin", "editor", "author"),
  commentController.updateCommentStatus
);

module.exports = router;