const express = require("express");
const router = express.Router();
const mediaCategoryController = require("../controllers/mediaCategoryController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  mediaCategoryController.createMediaCategory
);
router.get("/", mediaCategoryController.getAllMediaCategories);
router.get(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  mediaCategoryController.getMediaCategoryById
);
router.get("/:slug", mediaCategoryController.getMediaCategoryBySlug);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  mediaCategoryController.updateMediaCategory
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  mediaCategoryController.deleteMediaCategory
);

module.exports = router;