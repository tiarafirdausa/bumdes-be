// backend/routes/userRoute.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController"); 
const authMiddleware = require("../middleware/authMiddleware");
const { userProfileImageUpload } = require("../validation/configMulter");
const { registerValidation, updateUserValidationRules } = require("../validation/authValidation"); 

// Rute untuk membuat user baru (hanya admin)
router.post(
  "/", 
  // authMiddleware.protect,
  // authMiddleware.authorize("admin"),
  userProfileImageUpload.single("foto"),
  registerValidation,
  userController.createUser
);

router.get("/", 
    // authMiddleware.protect, 
    userController.getUsers);

router.get("/:id", 
  // authMiddleware.protect, 
  userController.getUserById);

router.put(
  "/:id",
  // authMiddleware.protect,
  userProfileImageUpload.single("foto"),
  updateUserValidationRules,
  userController.updateUser
);

router.delete(
  "/:id",
  // authMiddleware.protect,
  // authMiddleware.authorize("admin"), 
  userController.deleteUser
);

module.exports = router;