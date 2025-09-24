// routes/settingRoute.js
const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settingController");
const { settingImageUpload } = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", settingController.getSettings);
router.put(
  "/",
  protect,
  authorize("admin"),
  settingImageUpload,
  settingController.updateSettings
);
module.exports = router;
