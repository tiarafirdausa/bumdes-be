// routes/menuItemRoutes.js
const express = require("express");
const router = express.Router();
const menuItemController = require("../controllers/menuItemController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  menuItemController.createMenuItem
);
router.get("/", menuItemController.getAllMenuItems);
router.get("/:id", menuItemController.getMenuItemById);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  menuItemController.updateMenuItem
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  menuItemController.deleteMenuItem
);

module.exports = router;