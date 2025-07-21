// backend/controllers/authController.js
const db = require("../models/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const fs = require("fs");
const path = require("path");
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
      nama_lengkap: user.nama_lengkap,
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

    generateTokenAndSetCookie(user,200, res);
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

// --- Register Pengguna Baru ---
exports.registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr)
          console.error(
            "Error deleting uploaded file due to validation errors:",
            unlinkErr
          );
      });
    }
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { name, email, username, password, role, status } = req.body;
    const fotoPath = req.file
      ? `/uploads/users/${req.file.filename}`
      : null;
    if (!name || !email || !username || !password || !role) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr)
            console.error(
              "Error deleting uploaded file due to missing fields:",
              unlinkErr
            );
        });
      }
      return res
        .status(400)
        .json({
          error:
            "Semua field wajib diisi: nama_lengkap, email, username, password, level.",
        });
    }

    const [existingUsers] = await db.query(
      "SELECT username, email FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUsers.length > 0) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr)
            console.error(
              "Error deleting uploaded file due to duplicate entry:",
              unlinkErr
            );
        });
      }
      const isUsernameTaken = existingUsers.some(
        (u) => u.username === username
      );
      const isEmailTaken = existingUsers.some((u) => u.email === email);

      if (isUsernameTaken && isEmailTaken)
        return res
          .status(409)
          .json({ error: "Username dan email sudah terdaftar." });
      if (isUsernameTaken)
        return res.status(409).json({ error: "Username sudah terdaftar." });
      if (isEmailTaken)
        return res.status(409).json({ error: "Email sudah terdaftar." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userStatus = ['active', 'suspended'].includes(status) ? status : 'active';

    const [result] = await db.query(
      "INSERT INTO users (name, email, username, password, role, foto, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, email, username, hashedPassword, role, fotoPath, userStatus] // Use fotoPath
    );

    const newUser = {
      id: result.insertId,
      name,
      email,
      username,
      role,
      foto: fotoPath,
      status: userStatus,
    };

    res
      .status(201)
      .json({ message: "Registrasi pengguna berhasil.", user: newUser });
  } catch (error) {
    console.error("Error registering user:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr)
          console.error(
            "Error deleting uploaded file on DB failure:",
            unlinkErr
          );
      });
    }
    res
      .status(500)
      .json({ error: "Gagal melakukan registrasi.", details: error.message });
  }
};

// --- Update Pengguna ---
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    username,
    password,
    role,
    foto: fotoFromBody,
    status,
  } = req.body;
  const newFotoPath = req.file
    ? `/uploads/users/${req.file.filename}`
    : undefined;

  let updateFields = [];
  let updateValues = [];
  let responseBody = {};

  try {
    const [oldUserRows] = await db.query(
      "SELECT username, email, role, name, foto, status FROM users WHERE id = ?",
      [id]
    );

    if (oldUserRows.length === 0) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr)
            console.error(
              "Error deleting uploaded file because user not found:",
              unlinkErr
            );
        });
      }
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }

    const oldUser = oldUserRows[0];
    const oldFotoPath = oldUser.foto;

    if (name !== undefined && name !== oldUser.name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }

    if (email !== undefined) {
      if (email !== oldUser.email) {
        const [existingEmail] = await db.query(
          "SELECT id FROM users WHERE email = ? AND id != ?",
          [email, id]
        );
        if (existingEmail.length > 0) {
          if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
              if (unlinkErr)
                console.error(
                  "Error deleting uploaded file due to duplicate email:",
                  unlinkErr
                );
            });
          }
          return res.status(409).json({ error: "Email sudah terdaftar." });
        }
      }
      if (email !== oldUser.email) {
        updateFields.push("email = ?");
        updateValues.push(email);
      }
    }

    if (username !== undefined) {
      if (username !== oldUser.username) {
        const [existingUsername] = await db.query(
          "SELECT id FROM users WHERE username = ? AND id != ?",
          [username, id]
        );
        if (existingUsername.length > 0) {
          if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
              if (unlinkErr)
                console.error(
                  "Error deleting uploaded file due to duplicate username:",
                  unlinkErr
                );
            });
          }
          return res.status(409).json({ error: "Username sudah terdaftar." });
        }
      }
      if (username !== oldUser.username) {
        updateFields.push("username = ?");
        updateValues.push(username);
      }
    }

    if (password !== undefined && password.length > 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push("password = ?");
      updateValues.push(hashedPassword);
    }

    if (role !== undefined && role !== oldUser.role) {
      updateFields.push("role = ?");
      updateValues.push(role);
    }

    if (status !== undefined && status !== oldUser.status) {
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ error: "Status tidak valid. Harus 'active' atau 'suspended'." });
        }
        updateFields.push("status = ?");
        updateValues.push(status);
    }

    if (req.file) {
      updateFields.push("foto = ?");
      updateValues.push(newFotoPath);
      if (oldFotoPath && oldFotoPath.startsWith("/uploads/users")) {
        const fullOldPath = path.join(__dirname, "..", "public", oldFotoPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr)
              console.error(
                "Failed to delete old user photo:",
                fullOldPath,
                unlinkErr
              );
            else console.log("Old user photo deleted:", fullOldPath);
          });
        }
      }
    } else if (
      fotoFromBody !== undefined &&
      (fotoFromBody === null || fotoFromBody === "")
    ) {
      updateFields.push("foto = ?");
      updateValues.push(null);
      responseBody.photo_cleared = true;
      if (oldFotoPath && oldFotoPath.startsWith("/uploads/users")) {
        const fullOldPath = path.join(__dirname, "..", "public", oldFotoPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr)
              console.error(
                "Failed to delete old user photo:",
                fullOldPath,
                unlinkErr
              );
            else console.log("Old user photo deleted:", fullOldPath);
          });
        }
      }
    }

    if (
      updateFields.length === 0 &&
      !req.file &&
      !(
        fotoFromBody !== undefined &&
        (fotoFromBody === null || fotoFromBody === "")
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Tidak ada data yang disediakan untuk diperbarui atau tidak ada perubahan yang terdeteksi.",
        });
    }

    const query = `UPDATE users SET ${updateFields.join(
      ", "
    )} WHERE id = ?`;
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr)
            console.error(
              "Error deleting uploaded file after no DB change:",
              unlinkErr
            );
        });
      }
      return res
        .status(404)
        .json({
          error:
            "Pengguna tidak ditemukan atau tidak ada perubahan yang dilakukan.",
        });
    }

    res
      .status(200)
      .json({
        message: "Informasi pengguna berhasil diperbarui",
        new_photo_path: newFotoPath,
        ...responseBody,
      });
  } catch (error) {
    console.error("Error updating user:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr)
          console.error(
            "Error deleting uploaded file on DB failure:",
            unlinkErr
          );
      });
    }
    if (error.code === "ER_DUP_ENTRY") {
      res
        .status(409)
        .json({
          error:
            "Terjadi duplikasi entri. Username atau email mungkin sudah terdaftar.",
          details: error.message,
        });
    } else {
      res
        .status(500)
        .json({ error: "Gagal memperbarui pengguna.", details: error.message });
    }
  }
};

exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, username, role, foto, status FROM users"
    );
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({
        error: "Gagal mengambil daftar pengguna.",
        details: error.message,
      });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const [user] = await db.query("SELECT foto FROM users WHERE id = ?", [
      id,
    ]);
    const fotoPathToDelete = user.length > 0 ? user[0].foto : null;
    const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }

    if (
      fotoPathToDelete &&
      fotoPathToDelete.startsWith("/uploads/users")
    ) {
      const fullPath = path.join(__dirname, "..", "public", fotoPathToDelete);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => {
          if (err)
            console.error("Gagal menghapus file foto pengguna:", fullPath, err);
          else console.log("File foto pengguna dihapus:", fullPath);
        });
      }
    }
    res.status(200).json({ message: "Pengguna berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res
      .status(500)
      .json({ error: "Gagal menghapus pengguna.", details: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await db.query(
      "SELECT id, username, name, email, role, foto, status FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }

    const user = users[0];
    // delete user.password;

    res.status(200).json({ user: user });
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res
      .status(500)
      .json({
        error: "Gagal mengambil informasi pengguna.",
        details: error.message,
      });
  }
};

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

