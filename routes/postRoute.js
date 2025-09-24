// routes/postRoute.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { postImageUpload } = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  postImageUpload,
  postController.createPost
);
router.get("/", postController.getPosts);
router.get(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  postController.getPostById
);
router.get("/:slug", postController.getPostBySlug);
router.get("/category/:slug", postController.getPostByCategory);
router.get("/tag/:slug", postController.getPostsByTag);
router.put(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  postImageUpload,
  postController.updatePost
);
router.delete("/:id", protect, authorize("admin"), postController.deletePost);

module.exports = router;
