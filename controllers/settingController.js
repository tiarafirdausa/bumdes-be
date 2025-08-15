const db = require("../models/db");
const path = require("path");
const fs = require("fs");

// Helper untuk menginterpretasikan nilai berdasarkan tipe
const parseSettingValue = (value, type) => {
  switch (type) {
    case 'boolean':
      return value === 'true' || value === '1';
    case 'number':
      return Number(value);
    case 'json':
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error("Error parsing JSON setting:", value, e);
        return value;
      }
    case 'string':
    case 'text':
    case 'image':
    default:
      return value;
  }
};

// Helper untuk mengonversi nilai ke string untuk penyimpanan DB
const serializeSettingValue = (value, type) => {
    if (value === null || value === undefined) return null;
    switch (type) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return String(value);
        case 'json':
            return JSON.stringify(value);
        case 'string':
        case 'text':
        case 'image':
        default:
            return String(value);
    }
};

// Helper untuk menghapus file gambar lama
const deleteOldImage = (oldPath) => {
  if (oldPath && oldPath.startsWith("/uploads/settings/")) { 
    const fullOldPath = path.join(__dirname, "..", "public", oldPath);
    if (fs.existsSync(fullOldPath)) {
      fs.unlink(fullOldPath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old setting image file:", fullOldPath, unlinkErr);
        else console.log("Old setting image file deleted:", fullOldPath);
      });
    }
  }
};

// Fungsi untuk mendapatkan semua pengaturan
exports.getSettings = async (req, res) => {
  try {
    const [settingsRows] = await db.query("SELECT `group`, `key`, `value`, `type` FROM settings");

    const settingsObject = {};
    settingsRows.forEach((setting) => {
      if (!settingsObject[setting.group]) {
        settingsObject[setting.group] = {};
      }
      settingsObject[setting.group][setting.key] = parseSettingValue(setting.value, setting.type);
    });

    res.status(200).json(settingsObject);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Gagal mengambil pengaturan", details: error.message });
  }
};

// Fungsi untuk memperbarui pengaturan
exports.updateSettings = async (req, res) => {
  let connection; 
  try {
    const {
      site_title,
      site_description,
      maintenance_mode, 
      meta_keywords, 
      meta_description, 
      mail_from_address,
      mail_from_name,
      smtp_host,
      smtp_port, 
      smtp_username,
      smtp_password,
      clear_logo, 
      // Pengaturan baru ditambahkan di sini
      maps_url,
      address,
      phone,
      power,
      power_url,
      short_title,
    } = req.body;

    const logoFile = req.files && req.files.logo ? req.files.logo[0] : null;

    const [currentSettingsRows] = await db.query("SELECT `key`, `value`, `type` FROM settings");
    const currentSettingsMap = new Map(currentSettingsRows.map(s => [s.key, { value: s.value, type: s.type }]));

    connection = await db.getConnection();
    await connection.beginTransaction();

    const updateSingleSetting = async (key, newValue, type) => {
      const current = currentSettingsMap.get(key);
      const oldValue = current ? parseSettingValue(current.value, current.type) : undefined;
      const valueToStore = serializeSettingValue(newValue, type);

      if (newValue !== undefined && valueToStore !== current?.value) {
        await connection.query(
          "UPDATE settings SET `value` = ?, `type` = ? WHERE `key` = ?",
          [valueToStore, type, key]
        );
        console.log(`Updated setting: ${key} from '${oldValue}' to '${newValue}' (stored as '${valueToStore}')`);
      } else {
        console.log(`Setting ${key} value is same as old: '${oldValue}'. No update needed.`);
      }
    };

    await updateSingleSetting("site_title", site_title, "string");
    await updateSingleSetting("site_description", site_description, "text");
    await updateSingleSetting("maintenance_mode", maintenance_mode, "boolean");
    await updateSingleSetting("meta_keywords", meta_keywords, "text");
    await updateSingleSetting("meta_description", meta_description, "text");
    await updateSingleSetting("mail_from_address", mail_from_address, "string");
    await updateSingleSetting("mail_from_name", mail_from_name, "string");
    await updateSingleSetting("smtp_host", smtp_host, "string");
    await updateSingleSetting("smtp_port", smtp_port, "number");
    await updateSingleSetting("smtp_username", smtp_username, "string");
    await updateSingleSetting("smtp_password", smtp_password, "string");

    // Panggil fungsi updateSingleSetting untuk setiap pengaturan baru
    await updateSingleSetting("maps_url", maps_url, "text");
    await updateSingleSetting("address", address, "text");
    await updateSingleSetting("phone", phone, "string");
    await updateSingleSetting("power", power, "string");
    await updateSingleSetting("power_url", power_url, "text");
    await updateSingleSetting("short_title", short_title, "string");

    const currentLogoValue = currentSettingsMap.get('logo')?.value;

    if (logoFile) {
      const newLogoPath = `/uploads/settings/${logoFile.filename}`;
      await updateSingleSetting("logo", newLogoPath, "image");
      deleteOldImage(currentLogoValue); 
    } else if (clear_logo === 'true') { 
      await updateSingleSetting("logo", null, "image");
      deleteOldImage(currentLogoValue); 
    }

    await connection.commit(); 

    res.status(200).json({
      message: "Pengaturan berhasil diperbarui!",
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    if (connection) await connection.rollback();

    if (req.files && req.files.logo && req.files.logo[0]) {
      deleteOldImage(`/uploads/settings/${req.files.logo[0].filename}`);
    }

    res.status(500).json({ error: "Gagal memperbarui pengaturan", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};