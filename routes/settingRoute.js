const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settingController");
const { settingImageUpload } = require("../validation/configMulter");

router.get("/", settingController.getSettings);
router.put("/", settingImageUpload, settingController.updateSettings);
module.exports = router;
