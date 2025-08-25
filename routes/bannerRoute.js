const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/bannerController");
const { bannerImageUpload } = require("../validation/configMulter")

router.post("/", bannerImageUpload, bannerController.createBanner);
router.get("/", bannerController.getBanners);
router.get("/:id", bannerController.getBannerById);
router.put("/:id", bannerImageUpload, bannerController.updateBanner);
router.delete("/:id", bannerController.deleteBanner);

module.exports = router;