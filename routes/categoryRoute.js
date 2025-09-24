const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { excelImportUpload } = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  categoryController.createCategory
);
router.post(
  "/import-excel",
  protect,
  authorize("admin", "editor", "author"),
  excelImportUpload,
  categoryController.importCategories
);
router.get(
  "/",
  categoryController.getCategories
);
router.get(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  categoryController.getCategoryById
);
router.get("/:slug", categoryController.getCategoryBySlug);
router.put(
  "/id/:id",
  protect,
  authorize("admin", "editor", "author"),
  categoryController.updateCategory
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  categoryController.deleteCategory
);
module.exports = router;