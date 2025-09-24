// routes/mediaRoute.js

const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");
const { mediaUpload } = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  mediaUpload,
  mediaController.createMediaCollection
);
router.get("/", mediaController.getMediaCollections);
router.get("/categories", mediaController.getMediaCategories);
router.get(
  "/category/:categoryId",
  mediaController.getMediaCollectionsByCategory
);
router.get(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  mediaController.getMediaCollectionById
);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  mediaUpload,
  mediaController.updateMediaCollection
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  mediaController.deleteMediaCollection
);

module.exports = router;
