// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
require("dotenv").config();
const db = require("../models/db");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

const convertExpiresInToMs = (expiresIn) => {
    const value = parseInt(expiresIn);
    const unit = expiresIn.replace(value, '');
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return 3600 * 1000; // Default 1 jam
    }
};

exports.generateTokenAndSetCookie = (user, res) => {
    const token = jwt.sign(
        { id: user.id_user, username: user.username, level: user.level }, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRES_IN }
    );
    const cookieMaxAgeMs = convertExpiresInToMs(JWT_EXPIRES_IN);

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: cookieMaxAgeMs, // Gunakan maxAge
        sameSite: "Lax", 
    });
    return token;
};


exports.protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ error: "Akses ditolak. Tidak ada token otorisasi." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);        
        const [users] = await db.query(
            "SELECT id_user, nama_lengkap, email, username, level, foto FROM user WHERE id_user = ?", 
            [decoded.id]
        );

        if (users.length === 0) {
            res.clearCookie("token");
            return res.status(401).json({ error: "Unauthorized: User not found or removed." });
        }
        
        req.user = users[0]; 
        generateTokenAndSetCookie(req.user, res);
        console.log(`Token refreshed for user ID: ${req.user.id_user} (${req.user.username})`);

        next(); 
    } catch (error) {
        console.error("Verifikasi token gagal:", error);
        res.clearCookie("token"); 
        return res.status(401).json({
            error: "Token tidak valid atau kadaluarsa. Silakan login kembali."
        });
    }
};

exports.authorize = (...levels) => {
  return (req, res, next) => {
    if (!req.user || !levels.includes(req.user.level)) {
      return res
        .status(403)
        .json({
          error: "Anda tidak memiliki izin untuk mengakses resource ini.",
        });
    }
    next();
  };
};