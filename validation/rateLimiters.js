// backend/config/rateLimiters.js
const rateLimit = require('express-rate-limit');

// Rate limiter untuk endpoint login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5, // Batasi 5 request per IP per windowMs (jendela waktu)
  message: { // Pesan error yang akan dikirim jika batas tercapai
    error: 'Terlalu banyak percobaan login dari IP ini, silakan coba lagi setelah 15 menit.'
  },
  standardHeaders: true, // Mengembalikan informasi batas laju dalam header RateLimit-*
  legacyHeaders: false, // Nonaktifkan header X-RateLimit-* yang lama
  handler: (req, res) => { // Fungsi kustom saat batas tercapai
    res.status(429).json({ error: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.' });
  },
});

// Rate limiter untuk endpoint registrasi
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 10, // Batasi 10 request registrasi per IP per jam
  message: { // Pesan error yang akan dikirim jika batas tercapai
    error: 'Terlalu banyak permintaan registrasi dari IP ini, silakan coba lagi setelah 1 jam.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => { // Fungsi kustom saat batas tercapai
    res.status(429).json({ error: 'Terlalu banyak permintaan registrasi. Silakan coba lagi nanti.' });
  },
});

// Ekspor limiter agar bisa digunakan di file lain
module.exports = {
  loginLimiter,
  registerLimiter,
};