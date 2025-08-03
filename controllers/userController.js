// backend/controllers/userController.js
const db = require("../models/db");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const fs = require("fs");
const path = require("path");

exports.createUser = async (req, res) => {
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
    const { name, email, username, password, role, status, password_confirmation } = req.body;
    const fotoPath = req.file
      ? `/uploads/users/${req.file.filename}`
      : null;

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

    // --- Hash Password dan Set Status Default ---
    const hashedPassword = await bcrypt.hash(password, 10);
    const userStatus = ['active', 'suspended'].includes(status) ? status : 'active';

    // --- Insert Data Pengguna ke Database ---
    const [result] = await db.query(
      "INSERT INTO users (name, email, username, password, role, foto, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, email, username, hashedPassword, role, fotoPath, userStatus] 
    );

    const newUser = {
      id: result.insertId,
      name: name, 
      email,
      username,
      role,
      foto: fotoPath,
      status: userStatus,
    };

    res
      .status(201)
      .json({ message: "Pembuatan pengguna berhasil.", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
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
      .json({ error: "Gagal membuat pengguna.", details: error.message });
  }
};

// --- Update Pengguna ---
exports.updateUser = async (req, res) => {
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

  const { id } = req.params;
  const {
    name,
    email,
    username,
    current_password, 
    new_password,     
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
      "SELECT username, email, role, name, foto, status, password FROM users WHERE id = ?",
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

    if (email !== undefined && email !== oldUser.email) {
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
        updateFields.push("email = ?");
        updateValues.push(email);
    }

    // --- Update 'username' ---
    if (username !== undefined && username !== oldUser.username) {
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
        updateFields.push("username = ?");
        updateValues.push(username);
    }

    if (new_password) {
      const isMatch = await bcrypt.compare(current_password, oldUser.password);
      if (!isMatch) {
        if (req.file) {
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr)
              console.error(
                "Error deleting uploaded file due to current password mismatch:",
                unlinkErr
              );
          });
        }
        return res.status(401).json({ error: "Current password tidak cocok." });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);
      updateFields.push("password = ?");
      updateValues.push(hashedPassword);
    }

    // --- Update 'role' ---
    if (role !== undefined && role !== oldUser.role) {
      updateFields.push("role = ?");
      updateValues.push(role);
    }

    // --- Update 'status' ---
    if (status !== undefined && status !== oldUser.status) {
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ error: "Status tidak valid. Harus 'active' atau 'suspended'." });
        }
        updateFields.push("status = ?");
        updateValues.push(status);
    }

    // --- Update 'foto' ---
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
      req.body.clear_foto === 'true'
    ) {
      updateFields.push("foto = ?");
      updateValues.push(null);
      responseBody.photo_cleared = true;
      // Hapus foto lama jika ada
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


    if (updateFields.length === 0) {
      return res
        .status(400)
        .json({
          error: "Tidak ada data yang disediakan untuk diperbarui atau tidak ada perubahan yang terdeteksi.",
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
      return res.status(200).json({ message: "Tidak ada perubahan yang dilakukan pada pengguna." });
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
        const {
            query, 
            pageIndex = 1,
            pageSize = 10,
            sort = {},
            role, 
            status 
        } = req.query;

        let sql = "SELECT id, name, email, username, role, foto, status FROM users";
        let countSql = "SELECT COUNT(id) AS total FROM users";
        
        const whereClauses = [];
        const params = [];
        const countParams = [];

        if (query) {
            const searchQuery = `%${query}%`;
            whereClauses.push("(name LIKE ? OR email LIKE ? OR username LIKE ?)");
            params.push(searchQuery, searchQuery, searchQuery);
            countParams.push(searchQuery, searchQuery, searchQuery);
        }

        if (role) {
            whereClauses.push("role = ?");
            params.push(role);
            countParams.push(role);
        }

        if (status) {
            whereClauses.push("status = ?");
            params.push(status);
            countParams.push(status);
        }

        if (whereClauses.length > 0) {
            const combinedWhere = whereClauses.join(" AND ");
            sql += ` WHERE ${combinedWhere}`;
            countSql += ` WHERE ${combinedWhere}`;
        }

        if (sort.key && sort.order) {
            const validSortKeys = ['id', 'name', 'email', 'username', 'role', 'status', 'created_at', 'updated_at']; // Tambahkan created_at/updated_at jika ada di tabel users
            if (validSortKeys.includes(sort.key)) {
                const order = sort.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                sql += ` ORDER BY ${sort.key} ${order}`;
            } else {
                sql += " ORDER BY name ASC";
            }
        } else {
            sql += " ORDER BY name ASC";
        }

        const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
        sql += " LIMIT ? OFFSET ?";
        params.push(parseInt(pageSize), offset);

        const [users] = await db.query(sql, params);

        const [totalResult] = await db.query(countSql, countParams);
        const total = totalResult[0].total;

        res.status(200).json({ users, totalCount: total });
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