// controllers/settingController.js
const db = require("../models/db"); // Sesuaikan path ini ke file koneksi DB Anda
const path = require("path");
const fs = require("fs");

exports.getSettings = async (req, res) => {
  try {
    const [settings] = await db.query("SELECT parameter, nilai FROM setting");

    const settingsObject = {};
    settings.forEach((setting) => {
      settingsObject[setting.parameter] = setting.nilai;
    });
    res.status(200).json(settingsObject);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil pengaturan", details: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const {
      judul,
      deskripsi,
      url,
      keyword,
      folder,
      judulpendek,
      alamat,
      phone,
      power,
      powerurl,
      email,
      secret_key,
      "data-sitekey": data_sitekey, 
      googleverification,
      theme, 
      Maps_embed,
    } = req.body;

    let responseBody = {};

    const [currentSettingsRows] = await db.query(
      "SELECT parameter, nilai FROM setting"
    );
    const currentSettings = {};
    currentSettingsRows.forEach((row) => {
      currentSettings[row.parameter] = row.nilai;
    });

    const updateSingleSetting = async (parameterName, newValue, oldValue) => {
      let valueToStore = newValue;

      if (newValue === undefined) {
        return; 
      }

      if (valueToStore !== oldValue) {
        console.log(`Updating setting: ${parameterName} from '${oldValue}' to '${valueToStore}'`);
        await db.query("UPDATE setting SET nilai = ? WHERE parameter = ?", [
          valueToStore,
          parameterName,
        ]);
      } else {
        console.log(`Setting ${parameterName} value is same as old: '${oldValue}'. No update needed.`);
      }
    };

    const ikonFile = req.files && req.files.ikon ? req.files.ikon[0] : null;
    const logoFile = req.files && req.files.logo ? req.files.logo[0] : null;

    const oldIkonPath = currentSettings.ikon;
    const oldLogoPath = currentSettings.logo;

    // Ikon handling
    if (ikonFile) {
      const newIkonPath = `/uploads/setting/${ikonFile.filename}`;
      await updateSingleSetting("ikon", newIkonPath, oldIkonPath);
      // Hapus ikon lama jika ada dan merupakan path yang valid
      if (oldIkonPath && oldIkonPath.startsWith("/uploads/setting")) {
        const fullOldPath = path.join(__dirname, "..", "public", oldIkonPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error("Error deleting old ikon file:", err);
          });
        }
      }
      responseBody.new_ikon_path = newIkonPath;
    } else if (req.body.ikon === "") { // Frontend mengirim string kosong untuk menghapus
      await updateSingleSetting("ikon", null, oldIkonPath); // Set ke null di DB
      if (oldIkonPath && oldIkonPath.startsWith("/uploads/setting")) {
        const fullOldPath = path.join(__dirname, "..", "public", oldIkonPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error("Error deleting cleared ikon file:", err);
          });
        }
      }
      responseBody.ikon_cleared = true;
    }

    // Logo handling
    if (logoFile) {
      const newLogoPath = `/uploads/setting/${logoFile.filename}`;
      await updateSingleSetting("logo", newLogoPath, oldLogoPath);
      if (oldLogoPath && oldLogoPath.startsWith("/uploads/setting")) {
        const fullOldPath = path.join(__dirname, "..", "public", oldLogoPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error("Error deleting old logo file:", err);
          });
        }
      }
      responseBody.new_logo_path = newLogoPath;
    } else if (req.body.logo === "") {
      await updateSingleSetting("logo", null, oldLogoPath);
      if (oldLogoPath && oldLogoPath.startsWith("/uploads/setting")) {
        const fullOldPath = path.join(__dirname, "..", "public", oldLogoPath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error("Error deleting cleared logo file:", err);
          });
        }
      }
      responseBody.logo_cleared = true;
    }

    // Update other text fields
    await updateSingleSetting("judul", judul, currentSettings.judul);
    await updateSingleSetting("deskripsi", deskripsi, currentSettings.deskripsi);
    await updateSingleSetting("url", url, currentSettings.url);
    await updateSingleSetting("keyword", keyword, currentSettings.keyword);
    await updateSingleSetting("folder", folder, currentSettings.folder);
    await updateSingleSetting("judulpendek", judulpendek, currentSettings.judulpendek);
    await updateSingleSetting("alamat", alamat, currentSettings.alamat);
    await updateSingleSetting("phone", phone, currentSettings.phone);
    await updateSingleSetting("power", power, currentSettings.power);
    await updateSingleSetting("powerurl", powerurl, currentSettings.powerurl);
    await updateSingleSetting("email", email, currentSettings.email);
    await updateSingleSetting("secret_key", secret_key, currentSettings.secret_key);
    await updateSingleSetting("data-sitekey", data_sitekey, currentSettings["data-sitekey"]);
    await updateSingleSetting("googleverification", googleverification, currentSettings.googleverification);
    await updateSingleSetting("theme", theme, currentSettings.theme); 
    await updateSingleSetting("Maps_embed", Maps_embed, currentSettings.Maps_embed);

    res.status(200).json({
      message: "Pengaturan berhasil diperbarui!",
      ...responseBody,
      updated_fields: req.body,
    });
  } catch (error) {
    console.error("Error updating setting:", error);
    if (req.files && req.files.ikon && req.files.ikon[0]) {
      fs.unlink(req.files.ikon[0].path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting uploaded ikon on failure:", unlinkErr);
      });
    }
    if (req.files && req.files.logo && req.files.logo[0]) {
      fs.unlink(req.files.logo[0].path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting uploaded logo on failure:", unlinkErr);
      });
    }
    res
      .status(500)
      .json({ error: "Gagal memperbarui pengaturan", details: error.message });
  }
};