const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const { pageImageUpload } = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  pageImageUpload,
  pageController.createPage
);
router.get("/", pageController.getPages);
router.get("/:slug", pageController.getPageBySlug);
router.get(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  pageController.getPageById
);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  pageImageUpload,
  pageController.updatePage
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  pageController.deletePage
);

module.exports = router;
