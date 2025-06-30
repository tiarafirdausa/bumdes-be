// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { userProfileImageUpload } = require("../validation/configMulter");
const {
  registerValidation,
  loginValidation,
} = require("../validation/authValidation");

router.post(
  "/register",
  userProfileImageUpload.single("foto"),
  registerValidation,
  authController.registerUser
);

router.post("/login", loginValidation, authController.loginUser);

router.post("/logout", authController.logoutUser);
router.get("/me", authMiddleware.protect, authController.getLoggedInUser);

router.get(
  "/admin-dashboard",
  authMiddleware.protect,
  authMiddleware.authorize("admin"),
  (req, res) => {
    res.status(200).json({
      message: "Selamat datang di dashboard admin! Anda memiliki akses penuh.",
      user: req.user,
    });
  }
);

router.get("/users/:id", authMiddleware.protect, authController.getUserById);

router.put(
  "/users/:id",
  authMiddleware.protect,
  userProfileImageUpload.single("foto"),
  authController.updateUser
);

router.get("/users", authMiddleware.protect, authController.getUsers);
router.delete("/users/:id", authMiddleware.protect, authController.deleteUser);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

module.exports = router;
