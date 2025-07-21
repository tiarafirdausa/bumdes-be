const db = require("../models/db");
const path = require("path");
const fs = require("fs");

exports.createPage = async (req, res) => {
  try {
    const { title, content, author_id, meta_title, meta_description, status, published_at } = req.body;

    if (!title || !content || !author_id) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting uploaded file due to missing fields:", unlinkErr);
        });
      }
      return res.status(400).json({ error: "Judul, konten, dan ID penulis wajib diisi." });
    }

    const featured_image_path = req.file
      ? `/uploads/pages/${req.file.filename}` 
      : null; 

    let slug = req.body.slug;
    if (!slug) {
      slug = title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    const [existingSlug] = await db.query(
      "SELECT id FROM pages WHERE slug = ?",
      [slug]
    );
    if (existingSlug.length > 0) {
      let suffix = 1;
      let uniqueSlug = slug;
      while (true) {
        const [checkSlug] = await db.query(
          "SELECT id FROM pages WHERE slug = ?",
          [`${slug}-${suffix}`]
        );
        if (checkSlug.length === 0) {
          uniqueSlug = `${slug}-${suffix}`;
          break;
        }
        suffix++;
      }
      slug = uniqueSlug;
    }

    const finalMetaTitle = meta_title !== undefined && meta_title !== "" ? meta_title : title;
    const finalMetaDescription = meta_description !== undefined && meta_description !== "" ? meta_description : title; 

    const finalStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'draft';
    const finalPublishedAt = finalStatus === 'published' && published_at ? new Date(published_at) : null;


    const [result] = await db.query(
      "INSERT INTO pages (title, slug, content, author_id, meta_title, meta_description, featured_image, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        slug,
        content,
        author_id,
        finalMetaTitle,
        finalMetaDescription,
        featured_image_path,
        finalStatus,
        finalPublishedAt,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      title,
      slug,
      content,
      author_id,
      meta_title: finalMetaTitle,
      meta_description: finalMetaDescription,
      featured_image: featured_image_path,
      status: finalStatus,
      published_at: finalPublishedAt,
      message: "Halaman berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating page:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting uploaded file on DB failure:", unlinkErr);
      });
    }
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error: "Terjadi duplikasi entri. Judul atau slug halaman mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal membuat halaman", details: error.message });
    }
  }
};

exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug: newSlug, 
      content,
      author_id,
      meta_title,
      meta_description,
      status,
      published_at,
    } = req.body;

    const newFeaturedImagePath = req.file
      ? `/uploads/pages/${req.file.filename}`
      : undefined;
    let updateFields = [];
    let updateValues = [];
    let responseBody = {};

    const [oldPage] = await db.query(
      "SELECT featured_image FROM pages WHERE id = ?",
      [id]
    );
    const oldFeaturedImagePath = oldPage.length > 0 ? oldPage[0].featured_image : null;


    if (title !== undefined) {
      const [existingTitle] = await db.query(
        "SELECT id FROM pages WHERE title = ? AND id != ?",
        [title, id]
      );
      if (existingTitle.length > 0) {
        if (req.file) { 
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting uploaded file due to duplicate title:", unlinkErr);
          });
        }
        return res.status(409).json({ error: "Halaman dengan judul ini sudah ada." });
      }
      updateFields.push("title = ?");
      updateValues.push(title);
    }

    if (newSlug !== undefined) {
      const [existingSlug] = await db.query(
        "SELECT id FROM pages WHERE slug = ? AND id != ?",
        [newSlug, id]
      );
      if (existingSlug.length > 0) {
        if (req.file) { 
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting uploaded file due to duplicate slug:", unlinkErr);
          });
        }
        return res.status(409).json({ error: "Halaman dengan slug ini sudah ada." });
      }
      updateFields.push("slug = ?");
      updateValues.push(newSlug || null);
    } else if (title !== undefined) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      let suffix = 1;
      let uniqueGeneratedSlug = generatedSlug;
      while (true) {
        const [checkSlug] = await db.query(
          "SELECT id FROM pages WHERE slug = ? AND id != ?",
          [uniqueGeneratedSlug, id]
        );
        if (checkSlug.length === 0) {
          break;
        }
        uniqueGeneratedSlug = `${generatedSlug}-${suffix}`;
        suffix++;
      }
      updateFields.push("slug = ?");
      updateValues.push(uniqueGeneratedSlug);
    }


    if (content !== undefined) {
      updateFields.push("content = ?");
      updateValues.push(content);
    }
    if (author_id !== undefined) {
      updateFields.push("author_id = ?");
      updateValues.push(author_id);
    }
    if (meta_title !== undefined) {
      updateFields.push("meta_title = ?");
      updateValues.push(meta_title || null);
    }
    if (meta_description !== undefined) {
      updateFields.push("meta_description = ?");
      updateValues.push(meta_description || null);
    }
    if (status !== undefined && ['draft', 'published', 'archived'].includes(status)) {
      updateFields.push("status = ?");
      updateValues.push(status);
    }
    if (status === 'published' && published_at === undefined) {
        updateFields.push("published_at = ?");
        updateValues.push(new Date());
    } else if (published_at !== undefined) {
        updateFields.push("published_at = ?");
        updateValues.push(published_at ? new Date(published_at) : null);
    }

    if (req.file) { 
      updateFields.push("featured_image = ?");
      updateValues.push(newFeaturedImagePath);
      if (oldFeaturedImagePath && oldFeaturedImagePath.startsWith("/uploads/pages/")) {
        const fullOldPath = path.join(__dirname, "..", oldFeaturedImagePath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr) console.error("Gagal menghapus gambar lama:", fullOldPath, unlinkErr);
            else console.log("Gambar lama dihapus:", fullOldPath);
          });
        }
      }
    } else if (req.body.clear_featured_image === true) { 
      updateFields.push("featured_image = ?");
      updateValues.push(null);
      responseBody.image_cleared = true;
      if (oldFeaturedImagePath && oldFeaturedImagePath.startsWith("/uploads/pages/")) {
        const fullOldPath = path.join(__dirname, "..", oldFeaturedImagePath);
        if (fs.existsSync(fullOldPath)) {
          fs.unlink(fullOldPath, (unlinkErr) => {
            if (unlinkErr) console.error("Gagal menghapus gambar lama:", fullOldPath, unlinkErr);
            else console.log("Gambar lama dihapus:", fullOldPath);
          });
        }
      }
    }


    if (updateFields.length === 0) {
      return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE pages SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting uploaded file after no DB change:", unlinkErr);
        });
      }
      return res.status(404).json({
        error: "Halaman tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({
      message: "Halaman berhasil diperbarui",
      new_featured_image_path: newFeaturedImagePath,
      ...responseBody,
    });
  } catch (error) {
    console.error("Error updating page:", error);
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting uploaded file on DB failure:", unlinkErr);
      });
    }
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error: "Terjadi duplikasi entri. Judul atau slug halaman mungkin sudah terdaftar.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal memperbarui halaman", details: error.message });
    }
  }
};

exports.getPages = async (req, res) => {
  try {
    const [pages] = await db.query(
      `SELECT
          p.id, p.title, p.slug, p.content, p.author_id, p.meta_title, p.meta_description,
          p.featured_image, p.status, p.published_at, p.created_at, p.updated_at,
          u.name AS author_name
       FROM
          pages p
       LEFT JOIN
          users u ON p.author_id = u.id
       ORDER BY
          p.created_at DESC`
    );
    res.status(200).json(pages);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar halaman",
      details: error.message,
    });
  }
};

exports.getPageById = async (req, res) => {
  try {
    const { id } = req.params;

    const [page] = await db.query(
      "SELECT id, title, slug, content, author_id, meta_title, meta_description, featured_image, status, published_at, created_at, updated_at FROM pages WHERE id = ?",
      [id]
    );

    if (page.length === 0) {
      return res.status(404).json({ error: "Halaman tidak ditemukan" });
    }

    // Tidak ada hits di skema baru, jadi update hits dihapus
    // await db.query("UPDATE pages SET hits = hits + 1 WHERE id = ?", [id]);

    res.status(200).json(page[0]);
  } catch (error) {
    console.error("Error fetching page by ID:", error);
    res.status(500).json({ error: "Gagal mengambil halaman", details: error.message });
  }
};

exports.getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [page] = await db.query(
      `SELECT
          p.id, p.title, p.slug, p.content, p.author_id, p.meta_title, p.meta_description,
          p.featured_image, p.status, p.published_at, p.created_at, p.updated_at,
          u.name AS author_name
       FROM
          pages p
       LEFT JOIN
          users u ON p.author_id = u.id
       WHERE
          p.slug = ?`,
      [slug]
    );
    if (page.length === 0) {
      return res.status(404).json({ error: "Halaman tidak ditemukan" });
    }
    // Tidak ada hits di skema baru, jadi update hits dihapus
    // await db.query("UPDATE pages SET hits = hits + 1 WHERE slug = ?", [slug]);

    res.status(200).json(page[0]);
  } catch (error) {
    console.error("Error fetching page by slug:", error);
    res.status(500).json({ error: "Gagal mengambil halaman", details: error.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const [page] = await db.query(
      "SELECT featured_image FROM pages WHERE id = ?",
      [id]
    );
    const featuredImagePathToDelete = page.length > 0 ? page[0].featured_image : null;

    const [result] = await db.query(
      "DELETE FROM pages WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Halaman tidak ditemukan" });
    }

    if (featuredImagePathToDelete && featuredImagePathToDelete.startsWith("/uploads/pages/")) {
      const fullPath = path.join(__dirname, "..", featuredImagePathToDelete);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => {
          if (err) console.error("Gagal menghapus file gambar halaman:", fullPath, err);
          else console.log("File gambar halaman dihapus:", fullPath);
        });
      }
    }

    res.status(200).json({ message: "Halaman berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting page:", error);
    res.status(500).json({ error: "Gagal menghapus halaman", details: error.message });
  }
};
