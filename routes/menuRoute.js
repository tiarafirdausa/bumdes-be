// routes/menuRoutes.js
const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  menuController.createMenu
);
router.get("/", menuController.getAllMenus);
router.get("/id/:id", menuController.getMenuById);
router.get("/:slug", menuController.getMenuBySlug);
router.get("/with-items/:slug", menuController.getMenuWithItemsBySlug);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  menuController.updateMenu
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  menuController.deleteMenu
);

module.exports = router;