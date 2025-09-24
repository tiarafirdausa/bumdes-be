// routes/tagRoute.js
const express = require("express");
const router = express.Router();
const tagController = require("../controllers/tagController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  tagController.createTag
);
router.get("/", tagController.getAllTags);
router.get(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  tagController.getTagById
);
router.get("/:slug", tagController.getTagBySlug);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  tagController.updateTag
);
router.delete("/:id", protect, authorize("admin"), tagController.deleteTag);

module.exports = router;
