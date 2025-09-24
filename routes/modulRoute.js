const express = require("express");
const router = express.Router();
const modulController = require("../controllers/modulController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/home", modulController.getHomeModules);
router.get("/widget", modulController.getWidgetModules);
router.get("/", modulController.getAllModuls);
router.post(
  "/",
  protect,
  authorize("admin"),
  modulController.addModul
);
router.get("/:id", modulController.getModulById);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  modulController.updateModul
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  modulController.deleteModul
);

module.exports = router;
