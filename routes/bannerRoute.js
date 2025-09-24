const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/bannerController");
const { bannerImageUpload } = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  bannerImageUpload,
  bannerController.createBanner
);
router.get("/", bannerController.getBanners);
router.get(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  bannerController.getBannerById
);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  bannerImageUpload,
  bannerController.updateBanner
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  bannerController.deleteBanner
);

module.exports = router;
