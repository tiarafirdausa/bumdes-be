// backend/controllers/authController.js
const db = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const fs = require('fs'); // Import fs for file operations
const path = require('path'); // Import path for path manipulation
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Default to 1 hour

// Helper to convert JWT_EXPIRES_IN (e.g., '1h', '30m') to milliseconds for cookie maxAge
const convertExpiresInToMs = (expiresIn) => {
    const value = parseInt(expiresIn);
    if (expiresIn.endsWith('h')) {
        return value * 60 * 60 * 1000; // hours to milliseconds
    } else if (expiresIn.endsWith('m')) {
        return value * 60 * 1000; // minutes to milliseconds
    } else if (expiresIn.endsWith('d')) {
        return value * 24 * 60 * 60 * 1000; // days to milliseconds
    }
    return value * 1000; // Assume seconds if no unit is specified (e.g., '3600' for 3600 seconds)
};

// Fungsi untuk menghasilkan token JWT dan mengaturnya di cookie
const generateTokenAndSetCookie = (user, statusCode, res) => {
    const token = jwt.sign(
        { id: user.id_user, username: user.username, level: user.level },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    const cookieMaxAgeMs = convertExpiresInToMs(JWT_EXPIRES_IN);

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Set to true in production if backend uses HTTPS
        maxAge: cookieMaxAgeMs,
        sameSite: 'Lax'
    });

    res.status(statusCode).json({
        user: { // Kirim data user dasar (tanpa password)
            id: user.id_user,
            nama_lengkap: user.nama_lengkap,
            email: user.email,
            username: user.username,
            level: user.level,
            foto: user.foto // Include foto path
        }
    });
};

// --- Login Pengguna ---
exports.loginUser = async (req, res) => {
    // Validasi input menggunakan express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { username, password } = req.body;

        // Validasi input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password wajib diisi.' });
        }

        // 1. Cari pengguna berdasarkan username (ambil juga password-nya)
        const [users] = await db.query(
            'SELECT id_user, nama_lengkap, email, username, password, level, foto FROM user WHERE username = ?',
            [username]
        );
        const user = users[0];

        if (!user) {
            return res.status(401).json({ error: 'Kredensial tidak valid (username tidak ditemukan).' });
        }

        // 2. Bandingkan password yang dimasukkan dengan hashed password di database
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Kredensial tidak valid (password salah).' });
        }

        // 3. Jika kredensial valid, hasilkan token dan set cookie
        generateTokenAndSetCookie(user, 200, res);

    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Gagal melakukan login.', details: error.message });
    }
};

// --- Mendapatkan Info User yang Sedang Login (Protected Route) ---
exports.getLoggedInUser = async (req, res) => {
    try {
        // Informasi user sudah tersedia di req.user dari middleware `protect`
        // req.user berisi { id: user.id_user, username: user.username, level: user.level }

        // Ambil semua detail user
        const [users] = await db.query(
            'SELECT id_user, nama_lengkap, email, username, level, foto FROM user WHERE id_user = ?',
            [req.user.id] // Menggunakan ID dari token yang sudah didekode
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }

        res.status(200).json({
            message: 'Informasi pengguna yang sedang login.',
            user: users[0] // Kirim detail pengguna yang ditemukan
        });
    } catch (error) {
        console.error('Error fetching logged-in user:', error);
        res.status(500).json({ error: 'Gagal mengambil informasi pengguna.', details: error.message });
    }
};

// --- Logout Pengguna ---
exports.logoutUser = (req, res) => {
    try {
        // Hapus token dari cookie
        res.clearCookie('token');

        res.status(200).json({ message: 'Berhasil logout.' });
    } catch (error) {
        console.error('Error logging out user:', error);
        res.status(500).json({ error: 'Gagal melakukan logout.', details: error.message });
    }
};

// --- Register Pengguna Baru ---
exports.registerUser = async (req, res) => {
    // Validasi input menggunakan express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // If there's a file, delete it because validation failed
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file due to validation errors:', unlinkErr);
            });
        }
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { nama_lengkap, email, username, password, level } = req.body;
        // The foto path will come from req.file after Multer processes it
        const fotoPath = req.file ? `/public/uploads/users/${req.file.filename}` : null;

        // Validasi input dasar (redundant if using express-validator, but good for safety)
        if (!nama_lengkap || !email || !username || !password || !level) {
            // If there's a file, delete it because required fields are missing
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file due to missing fields:', unlinkErr);
                });
            }
            return res.status(400).json({ error: 'Semua field wajib diisi: nama_lengkap, email, username, password, level.' });
        }

        // 1. Periksa apakah username atau email sudah terdaftar
        const [existingUsers] = await db.query(
            'SELECT username, email FROM user WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            // If there's a file, delete it because of duplicate entry
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file due to duplicate entry:', unlinkErr);
                });
            }
            const isUsernameTaken = existingUsers.some(u => u.username === username);
            const isEmailTaken = existingUsers.some(u => u.email === email);

            if (isUsernameTaken && isEmailTaken) return res.status(409).json({ error: 'Username dan email sudah terdaftar.' });
            if (isUsernameTaken) return res.status(409).json({ error: 'Username sudah terdaftar.' });
            if (isEmailTaken) return res.status(409).json({ error: 'Email sudah terdaftar.' });
        }

        // 2. Hash password sebelum menyimpan
        const hashedPassword = await bcrypt.hash(password, 10); // 10 adalah salt rounds yang direkomendasikan

        // 3. Masukkan pengguna baru ke database
        const [result] = await db.query(
            'INSERT INTO user (nama_lengkap, email, username, password, level, foto) VALUES (?, ?, ?, ?, ?, ?)',
            [nama_lengkap, email, username, hashedPassword, level, fotoPath] // Use fotoPath
        );

        // Buat objek pengguna baru yang akan digunakan untuk JWT
        const newUser = {
            id_user: result.insertId,
            nama_lengkap,
            email,
            username,
            level,
            foto: fotoPath // Include foto path
        };

        // Otomatis login setelah registrasi (opsional)
        generateTokenAndSetCookie(newUser, 201, res);

    } catch (error) {
        console.error('Error registering user:', error);
        // If there's a file, delete it because of a database error
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file on DB failure:', unlinkErr);
            });
        }
        res.status(500).json({ error: 'Gagal melakukan registrasi.', details: error.message });
    }
};

// --- Update Pengguna ---
exports.updateUser = async (req, res) => {
    // Note: Validation for update can be more flexible.
    // If you need express-validator here, apply it in your route.
    const { id } = req.params; // ID of the user to update
    const { nama_lengkap, email, username, password, level, foto: fotoFromBody } = req.body;
    const newFotoPath = req.file ? `/public/uploads/users/${req.file.filename}` : undefined; // New foto path if uploaded

    let updateFields = [];
    let updateValues = [];
    let responseBody = {}; // To add info to the response

    try {
        // Ambil data user lama, terutama path foto
        const [oldUser] = await db.query('SELECT foto FROM user WHERE id_user = ?', [id]);
        const oldFotoPath = oldUser.length > 0 ? oldUser[0].foto : null;

        if (nama_lengkap !== undefined) { updateFields.push('nama_lengkap = ?'); updateValues.push(nama_lengkap); }

        if (email !== undefined) {
            // Check for duplicate email if provided and changed
            if (email !== oldUser[0]?.email) { // Only check if email is different
                const [existingEmail] = await db.query('SELECT id_user FROM user WHERE email = ? AND id_user != ?', [email, id]);
                if (existingEmail.length > 0) {
                    if (req.file) { // Delete new file if email is duplicate
                        fs.unlink(req.file.path, (unlinkErr) => {
                            if (unlinkErr) console.error('Error deleting uploaded file due to duplicate email:', unlinkErr);
                        });
                    }
                    return res.status(409).json({ error: 'Email sudah terdaftar.' });
                }
            }
            updateFields.push('email = ?'); updateValues.push(email);
        }

        if (username !== undefined) {
            // Check for duplicate username if provided and changed
            if (username !== oldUser[0]?.username) { // Only check if username is different
                const [existingUsername] = await db.query('SELECT id_user FROM user WHERE username = ? AND id_user != ?', [username, id]);
                if (existingUsername.length > 0) {
                    if (req.file) { // Delete new file if username is duplicate
                        fs.unlink(req.file.path, (unlinkErr) => {
                            if (unlinkErr) console.error('Error deleting uploaded file due to duplicate username:', unlinkErr);
                        });
                    }
                    return res.status(409).json({ error: 'Username sudah terdaftar.' });
                }
            }
            updateFields.push('username = ?'); updateValues.push(username);
        }

        if (password !== undefined && password.length > 0) { // Only hash and update if password is provided
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?');
            updateValues.push(hashedPassword);
        }

        if (level !== undefined) { updateFields.push('level = ?'); updateValues.push(level); }

        // Logic for 'foto' (profile picture):
        if (req.file) { // A new file was uploaded
            updateFields.push('foto = ?');
            updateValues.push(newFotoPath);
            // Delete old photo if it exists and was an uploaded file
            if (oldFotoPath && oldFotoPath.startsWith('/public/uploads/users')) {
                const fullOldPath = path.join(__dirname, '..', oldFotoPath);
                if (fs.existsSync(fullOldPath)) {
                    fs.unlink(fullOldPath, (unlinkErr) => {
                        if (unlinkErr) console.error('Failed to delete old user photo:', fullOldPath, unlinkErr);
                        else console.log('Old user photo deleted:', fullOldPath);
                    });
                }
            }
        } else if (fotoFromBody !== undefined && (fotoFromBody === null || fotoFromBody === '')) {
            // Frontend explicitly wants to remove the photo (e.g., sent foto: null or foto: "")
            updateFields.push('foto = ?');
            updateValues.push(null); // Set foto to NULL in DB
            responseBody.photo_cleared = true; // Add info to response

            // Delete old photo from file system
            if (oldFotoPath && oldFotoPath.startsWith('/public/uploads/users')) {
                const fullOldPath = path.join(__dirname, '..', oldFotoPath);
                if (fs.existsSync(fullOldPath)) {
                    fs.unlink(fullOldPath, (unlinkErr) => {
                        if (unlinkErr) console.error('Failed to delete old user photo:', fullOldPath, unlinkErr);
                        else console.log('Old user photo deleted:', fullOldPath);
                    });
                }
            }
        }
        // If req.file is not present and fotoFromBody is not null/empty,
        // it means the photo was not changed.

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang disediakan untuk diperbarui.' });
        }

        const query = `UPDATE user SET ${updateFields.join(', ')} WHERE id_user = ?`;
        updateValues.push(id);

        const [result] = await db.query(query, updateValues);

        if (result.affectedRows === 0) {
            // If no changes, delete newly uploaded file (if any)
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file after no DB change:', unlinkErr);
                });
            }
            return res.status(404).json({ error: 'Pengguna tidak ditemukan atau tidak ada perubahan yang dilakukan.' });
        }

        res.status(200).json({ message: 'Informasi pengguna berhasil diperbarui', new_photo_path: newFotoPath, ...responseBody });

    } catch (error) {
        console.error('Error updating user:', error);
        // If there's a file, delete it if a database error occurs
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file on DB failure:', unlinkErr);
            });
        }
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Terjadi duplikasi entri. Username atau email mungkin sudah terdaftar.', details: error.message });
        } else {
            res.status(500).json({ error: 'Gagal memperbarui pengguna.', details: error.message });
        }
    }
};

// --- Get All Users (Admin only, optional) ---
exports.getUsers = async (req, res) => {
    try {
        const [users] = await db.query('SELECT id_user, nama_lengkap, email, username, level, foto FROM user');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar pengguna.', details: error.message });
    }
};

// --- Delete User (Admin only, optional) ---
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Ambil path foto sebelum menghapus record dari database
        const [user] = await db.query('SELECT foto FROM user WHERE id_user = ?', [id]);
        const fotoPathToDelete = user.length > 0 ? user[0].foto : null;

        const [result] = await db.query('DELETE FROM user WHERE id_user = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }

        // Jika ada foto yang terkait dan itu adalah foto yang diunggah
        if (fotoPathToDelete && fotoPathToDelete.startsWith('/public/uploads/users')) {
            const fullPath = path.join(__dirname, '..', fotoPathToDelete);
            if (fs.existsSync(fullPath)) {
                fs.unlink(fullPath, (err) => {
                    if (err) console.error('Gagal menghapus file foto pengguna:', fullPath, err);
                    else console.log('File foto pengguna dihapus:', fullPath);
                });
            }
        }

        res.status(200).json({ message: 'Pengguna berhasil dihapus.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Gagal menghapus pengguna.', details: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await db.query(
            'SELECT id_user, username, nama_lengkap, email, level, foto FROM user WHERE id_user = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }

        // Important: Do not send the password hash back to the client
        const user = users[0];
        delete user.password; // Ensure password field is not sent if it somehow was selected

        res.status(200).json({ user: user });
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        res.status(500).json({ error: 'Gagal mengambil informasi pengguna.', details: error.message });
    }
};