// backend/routes/userRoute.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController"); 
const { userProfileImageUpload } = require("../validation/configMulter");
const { registerValidation, updateUserValidationRules } = require("../validation/authValidation"); 
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/", 
  protect,
  authorize("admin"),
  userProfileImageUpload.single("foto"),
  registerValidation,
  userController.createUser
);

router.get("/", 
    protect,
  authorize("admin"), 
    userController.getUsers);

router.get("/:id", 
  protect,
  authorize("admin"),
  userController.getUserById);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  userProfileImageUpload.single("foto"),
  updateUserValidationRules,
  userController.updateUser
);

router.delete(
  "/:id",
  protect,
  authorize("admin"), 
  userController.deleteUser
);

module.exports = router;