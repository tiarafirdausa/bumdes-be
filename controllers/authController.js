// backend/controllers/authController.js
const db = require("../models/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const crypto = require("crypto");
const sendEmail = require("../middleware/sendEmail");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

const convertExpiresInToMs = (expiresIn) => {
  const value = parseInt(expiresIn);
  if (expiresIn.endsWith("h")) {
    return value * 60 * 60 * 1000;
  } else if (expiresIn.endsWith("m")) {
    return value * 60 * 1000;
  } else if (expiresIn.endsWith("d")) {
    return value * 24 * 60 * 60 * 1000;
  }
  return value * 1000;
};

const generateTokenAndSetCookie = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const cookieMaxAgeMs = convertExpiresInToMs(JWT_EXPIRES_IN);
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: cookieMaxAgeMs,
    sameSite: "Lax",
  });

  res.status(statusCode).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      foto: user.foto,
      status: user.status,
    },
  });
};

// --- Login Pengguna ---
exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username dan password wajib diisi." });
    }

    const [users] = await db.query(
      "SELECT id, name, email, username, password, role, foto, status FROM users WHERE username = ?",
      [username]
    );
    const user = users[0];
    if (!user) {
      return res
        .status(401)
        .json({ error: "Kredensial tidak valid (username tidak ditemukan)." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ error: "Kredensial tidak valid (password salah)." });
    }

    generateTokenAndSetCookie(user, 200, res);
  } catch (error) {
    console.error("Error logging in user:", error);
    res
      .status(500)
      .json({ error: "Gagal melakukan login.", details: error.message });
  }
};

// --- Mendapatkan Info User yang Sedang Login (Protected Route) ---
exports.getLoggedInUser = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, username, role, foto, status FROM users WHERE id = ?",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }

    res.status(200).json({
      message: "Informasi pengguna yang sedang login.",
      user: users[0],
    });
  } catch (error) {
    console.error("Error fetching logged-in user:", error);
    res
      .status(500)
      .json({
        error: "Gagal mengambil informasi pengguna.",
        details: error.message,
      });
  }
};

// --- Logout Pengguna ---
exports.logoutUser = (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ message: "Berhasil logout." });
  } catch (error) {
    console.error("Error logging out user:", error);
    res
      .status(500)
      .json({ error: "Gagal melakukan logout.", details: error.message });
  }
};

const getEmailSettings = async () => {
    const [settings] = await db.query("SELECT `key`, `value` FROM settings WHERE `group` = 'email'");
    const emailSettings = {};
    settings.forEach(row => {
        emailSettings[row.key] = row.value;
    });

    const isSecure = emailSettings.smtp_port === '465'; 
    
    return {
        host: emailSettings.smtp_host,
        port: parseInt(emailSettings.smtp_port),
        user: emailSettings.smtp_username,
        pass: emailSettings.smtp_password,
        from: emailSettings.mail_from_address,
    };
};

// --- Forgot Password ---
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email wajib diisi.' });
    }

    try {
        const [users] = await db.query(
            "SELECT id, username, email FROM users WHERE email = ?",
            [email]
        );

        const user = users[0];
        if (!user) {
            return res.status(200).json({ message: 'Jika email terdaftar, instruksi reset password telah dikirim.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); 

        await db.query(
            "UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?",
            [passwordResetToken, resetPasswordExpires, user.id]
        );

        const smtpConfig = await getEmailSettings();
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        const message = `
            <h1>Anda telah meminta reset password</h1>
            <p>Silakan buka tautan berikut untuk mereset password Anda:</p>
            <a href="${resetUrl}" clicktracking="off">${resetUrl}</a>
            <p>Tautan ini akan kedaluwarsa dalam 1 jam.</p>
            <p>Jika Anda tidak meminta reset password ini, abaikan email ini.</p>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Reset Password Anda',
                message,
                smtpConfig
            });

            res.status(200).json({ message: 'Email reset password berhasil dikirim.' });
        } catch (emailError) {
            await db.query(
                "UPDATE users SET resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?",
                [user.id]
            );
            console.error("Error sending email:", emailError);
            return res.status(500).json({ error: 'Gagal mengirim email reset password. Silakan coba lagi nanti.', details: emailError.message });
        }

    } catch (error) {
        console.error("Error in forgotPassword:", error);
        res.status(500).json({ error: 'Terjadi kesalahan saat memproses permintaan lupa password.', details: error.message });
    }
};

// --- Reset Password ---
exports.resetPassword = async (req, res) => {
    const { token } = req.query;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password baru wajib diisi.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
    }

    try {
        const hashedReceivedToken = crypto.createHash('sha256').update(token).digest('hex');

        const [users] = await db.query(
            "SELECT id FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()",
            [hashedReceivedToken]
        );

        const user = users[0];
        if (!user) {
            return res.status(400).json({ error: 'Token reset password tidak valid atau sudah kedaluwarsa.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?",
            [hashedPassword, user.id]
        );

        res.status(200).json({ message: 'Password berhasil direset. Silakan login dengan password baru Anda.' });

    } catch (error) {
        console.error("Error in resetPassword:", error);
        res.status(500).json({ error: 'Gagal mereset password.', details: error.message });
    }
};