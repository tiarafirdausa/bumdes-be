// backend/config/rateLimiters.js
const rateLimit = require('express-rate-limit');

// Rate limiter untuk endpoint login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, 
  message: { 
    error: 'Terlalu banyak percobaan login dari IP ini, silakan coba lagi setelah 15 menit.'
  },
  standardHeaders: true,
  legacyHeaders: false, 
  handler: (req, res) => { 
    res.status(429).json({ error: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.' });
  },
});

// Rate limiter untuk endpoint registrasi
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 10, 
  message: { 
    error: 'Terlalu banyak permintaan registrasi dari IP ini, silakan coba lagi setelah 1 jam.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => { 
    res.status(429).json({ error: 'Terlalu banyak permintaan registrasi. Silakan coba lagi nanti.' });
  },
});

// Ekspor limiter agar bisa digunakan di file lain
module.exports = {
  loginLimiter,
  registerLimiter,
};