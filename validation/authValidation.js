const { body } = require('express-validator');

// Validasi untuk proses registrasi
const registerValidation = [
    body('nama_lengkap').trim().notEmpty().withMessage('Nama lengkap wajib diisi.'),
    body('email').isEmail().normalizeEmail().withMessage('Format email tidak valid.'),
    body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username harus antara 3 dan 20 karakter.')
                    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username hanya boleh mengandung huruf, angka, dan underscore.'),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter.')
                    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
                    .withMessage('Password harus mengandung setidaknya satu huruf besar, satu huruf kecil, satu angka, dan satu simbol.'),
    body('level').isIn(['author', 'admin']).withMessage('Level tidak valid.'),
];

// Validasi untuk proses login
const loginValidation = [
    body('username').notEmpty().withMessage('Username wajib diisi.'),
    body('password').notEmpty().withMessage('Password wajib diisi.'),
];

// Ekspor validasi agar bisa digunakan di file lain
module.exports = {
    registerValidation,
    loginValidation,
};