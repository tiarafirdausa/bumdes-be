// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;

exports.protect = (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    console.error("Token tidak ditemukan.");
    return res
      .status(401)
      .json({ error: "Akses ditolak. Tidak ada token otorisasi." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Verifikasi token gagal:", error);
    return res
      .status(401)
      .json({
        error: "Token tidak valid atau kadaluarsa. Silakan login kembali.",
      });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({
          error: "Anda tidak memiliki izin untuk mengakses resource ini.",
        });
    }
    next();
  };
};
