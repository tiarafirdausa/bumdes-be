// backend/validation/authValidation.js
const { body } = require('express-validator');

// Validation for user registration (used by createUser)
exports.registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nama lengkap wajib diisi.')
    .isLength({ min: 3 })
    .withMessage('Nama lengkap minimal 3 karakter.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email wajib diisi.')
    .isEmail()
    .withMessage('Format email tidak valid.'),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username wajib diisi.')
    .isLength({ min: 3 })
    .withMessage('Username minimal 3 karakter.')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username hanya boleh berisi huruf, angka, dan underscore.'),
  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi.')
    .isLength({ min: 6 })
    .withMessage('Password minimal 6 karakter.'),
  body('password_confirmation') 
    .notEmpty()
    .withMessage('Konfirmasi password wajib diisi.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Konfirmasi password tidak cocok dengan password.');
      }
      return true;
    }),
  body('role') 
    .notEmpty()
    .withMessage('Role wajib diisi.')
    .isIn(['admin', 'editor', 'author', 'user']) 
    .withMessage('Role tidak valid.'),
  body('status')
    .optional() 
    .isIn(['active', 'suspended'])
    .withMessage('Status tidak valid.'),
];

// Validation for user update 
exports.updateUserValidationRules = [
  body('name') 
    .trim()
    .notEmpty()
    .withMessage('Nama lengkap wajib diisi.')
    .isLength({ min: 3 })
    .withMessage('Nama lengkap minimal 3 karakter.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email wajib diisi.')
    .isEmail()
    .withMessage('Format email tidak valid.'),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username wajib diisi.')
    .isLength({ min: 3 })
    .withMessage('Username minimal 3 karakter.')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username hanya boleh berisi huruf, angka, dan underscore.'),
  body('role')
    .notEmpty()
    .withMessage('Role wajib diisi.')
    .isIn(['admin', 'editor', 'author', 'user']) 
    .withMessage('Role tidak valid.'),
  body('status')
    .optional()
    .isIn(['active', 'suspended'])
    .withMessage('Status tidak valid.'),

  body('current_password')
    .optional() 
    .notEmpty()
    .withMessage('Current password wajib diisi jika ingin mengubah password.'),
  body('new_password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('New password minimal 6 karakter.')
    .custom((value, { req }) => {
      if (value && !req.body.current_password) {
        throw new Error('Current password wajib diisi untuk mengatur password baru.');
      }
      if (value && req.body.new_password_confirmation && value !== req.body.new_password_confirmation) {
        throw new Error('New password dan konfirmasi password baru tidak cocok.');
      }
      return true;
    }),
  body('new_password_confirmation') 
    .optional()
    .custom((value, { req }) => {
        if (req.body.new_password && !value) {
            throw new Error('Konfirmasi password baru wajib diisi.');
        }
        if (req.body.new_password && value !== req.body.new_password) {
            throw new Error('Konfirmasi password baru tidak cocok dengan password baru.');
        }
        return true;
    }),
];

// Validasi untuk proses login
exports.loginValidation = [
  body("username").notEmpty().withMessage("Username wajib diisi."),
  body("password").notEmpty().withMessage("Password wajib diisi."),
];
