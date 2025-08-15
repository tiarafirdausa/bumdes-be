// src/controllers/pageController.js

const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const deleteFile = (filePath, context) => {
  if (
    !filePath ||
    typeof filePath !== "string" ||
    !filePath.startsWith("/uploads/pages/")
  ) {
    console.error(
      `Invalid or suspicious file path for deletion (${context}):`,
      filePath
    );
    return;
  }

  const fullPath = path.join(__dirname, "..", "..", "public", filePath);

  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr)
        console.error(`Error deleting file (${context}):`, fullPath, unlinkErr);
      else console.log(`File deleted (${context}):`, fullPath);
    });
  } else {
    console.log(`File not found for deletion (${context}):`, fullPath);
  }
};

const deleteMultipleFiles = (filePaths, context) => {
  if (!filePaths || !Array.isArray(filePaths)) {
    console.warn(
      `Attempted to delete multiple files with invalid filePaths array (${context}).`
    );
    return;
  }
  filePaths.forEach((filePath) => deleteFile(filePath, context));
};

exports.createPage = async (req, res) => {
  let connection;
  try {
    const {
      title,
      content,
      author_id,
      meta_title,
      meta_description,
    } = req.body;

    const uploadedFiles = req.files;

    if (!title || !content || !author_id) {
      if (uploadedFiles) {
        if (uploadedFiles.featured_image)
          deleteFile(
            uploadedFiles.featured_image[0].path,
            "createPage: missing fields (featured)"
          );
        if (uploadedFiles.gallery_images)
          deleteMultipleFiles(
            uploadedFiles.gallery_images.map((f) => f.path),
            "createPage: missing fields (gallery)"
          );
      }
      return res
        .status(400)
        .json({ error: "Judul, konten, dan ID penulis wajib diisi." });
    }

    const featured_image_path =
      uploadedFiles && uploadedFiles.featured_image
        ? `/uploads/pages/${uploadedFiles.featured_image[0].filename}`
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

    const finalMetaTitle =
      meta_title !== undefined && meta_title !== "" ? meta_title : title;
    const finalMetaDescription =
      meta_description !== undefined && meta_description !== ""
        ? meta_description
        : title;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [pageResult] = await connection.query(
      "INSERT INTO pages (title, slug, content, author_id, meta_title, meta_description, featured_image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        title,
        slug,
        content,
        author_id,
        finalMetaTitle,
        finalMetaDescription,
        featured_image_path,
      ]
    );
    const pageId = pageResult.insertId;

    const insertedGalleryImages = [];
    if (
      uploadedFiles &&
      uploadedFiles.gallery_images &&
      uploadedFiles.gallery_images.length > 0
    ) {
      const [maxSortOrderResult] = await connection.query(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM page_gallery_images WHERE page_id = ?",
        [pageId]
      );
      let currentMaxOrder = maxSortOrderResult[0].max_order;

      const galleryValues = uploadedFiles.gallery_images.map((file) => {
        currentMaxOrder++;
        return [
          pageId,
          `/uploads/pages/${file.filename}`,
          file.originalname,
          currentMaxOrder,
        ];
      });

      await connection.query(
        "INSERT INTO page_gallery_images (page_id, image_path, alt_text, sort_order) VALUES ?",
        [galleryValues]
      );
      const [newImages] = await connection.query(
        "SELECT id, image_path, alt_text, sort_order FROM page_gallery_images WHERE page_id = ? ORDER BY sort_order ASC",
        [pageId]
      );
      insertedGalleryImages.push(...newImages);
    }

    await connection.commit();

    res.status(201).json({
      id: pageId,
      title,
      slug,
      content,
      author_id,
      meta_title: finalMetaTitle,
      meta_description: finalMetaDescription,
      featured_image: featured_image_path,
      gallery_images: insertedGalleryImages,
      message: "Halaman berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating page:", error);
    if (connection) await connection.rollback();
    if (req.files) {
      if (req.files.featured_image)
        deleteFile(
          req.files.featured_image[0].path,
          "createPage: DB error (featured)"
        );
      if (req.files.gallery_images)
        deleteMultipleFiles(
          req.files.gallery_images.map((f) => f.path),
          "createPage: DB error (gallery)"
        );
    }

    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error:
          "Terjadi duplikasi entri. Judul atau slug halaman mungkin sudah terdaftar.",
        details: error.message,
      });
    } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({
        error: "ID penulis tidak valid.",
        details: error.message,
      });
    } else {
      res
        .status(500)
        .json({ error: "Gagal membuat halaman", details: error.message });
    }
  } finally {
    if (connection) connection.release();
  }
};

exports.updatePage = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const {
      title,
      slug: newSlug,
      content,
      author_id,
      meta_title,
      meta_description,
      clear_featured_image,
      delete_gallery_image_ids,
      updated_gallery_images_order,
    } = req.body;

    const uploadedFiles = req.files;
    let newFeaturedImagePath = undefined;
    if (uploadedFiles && uploadedFiles.featured_image) {
      newFeaturedImagePath = `/uploads/pages/${uploadedFiles.featured_image[0].filename}`;
    }

    let updateFields = [];
    let updateValues = [];
    let responseBody = {};
    const [oldPageData] = await db.query(
      "SELECT featured_image FROM pages WHERE id = ?",
      [id]
    );
    if (oldPageData.length === 0) {
      if (uploadedFiles) {
        if (uploadedFiles.featured_image)
          deleteFile(
            uploadedFiles.featured_image[0].path,
            "updatePage: page not found (featured)"
          );
        if (uploadedFiles.gallery_images)
          deleteMultipleFiles(
            uploadedFiles.gallery_images.map((f) => f.path),
            "updatePage: page not found (gallery)"
          );
      }
      return res.status(404).json({ error: "Halaman tidak ditemukan." });
    }
    const oldFeaturedImagePath = oldPageData[0].featured_image;

    if (title !== undefined) {
      const [existingTitle] = await db.query(
        "SELECT id FROM pages WHERE title = ? AND id != ?",
        [title, id]
      );
      if (existingTitle.length > 0) {
        if (uploadedFiles) {
          if (uploadedFiles.featured_image)
            deleteFile(
              uploadedFiles.featured_image[0].path,
              "updatePage: duplicate title (featured)"
            );
          if (uploadedFiles.gallery_images)
            deleteMultipleFiles(
              uploadedFiles.gallery_images.map((f) => f.path),
              "updatePage: duplicate title (gallery)"
            );
        }
        return res
          .status(409)
          .json({ error: "Halaman dengan judul ini sudah ada." });
      }
      updateFields.push("title = ?");
      updateValues.push(title);
    }

    let finalSlug = newSlug;
    if (newSlug !== undefined) {
      const [existingSlug] = await db.query(
        "SELECT id FROM pages WHERE slug = ? AND id != ?",
        [newSlug, id]
      );
      if (existingSlug.length > 0) {
        if (uploadedFiles) {
          if (uploadedFiles.featured_image)
            deleteFile(
              uploadedFiles.featured_image[0].path,
              "updatePage: duplicate slug (featured)"
            );
          if (uploadedFiles.gallery_images)
            deleteMultipleFiles(
              uploadedFiles.gallery_images.map((f) => f.path),
              "updatePage: duplicate slug (gallery)"
            );
        }
        return res
          .status(409)
          .json({ error: "Halaman dengan slug ini sudah ada." });
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
      finalSlug = uniqueGeneratedSlug;
      updateFields.push("slug = ?");
      updateValues.push(finalSlug);
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
      updateValues.push(meta_title === "" ? null : meta_title);
    }
    if (meta_description !== undefined) {
      updateFields.push("meta_description = ?");
      updateValues.push(meta_description === "" ? null : meta_description);
    }

    if (newFeaturedImagePath !== undefined) {
      updateFields.push("featured_image = ?");
      updateValues.push(newFeaturedImagePath);
      if (
        oldFeaturedImagePath &&
        oldFeaturedImagePath.startsWith("/uploads/pages/")
      ) {
        deleteFile(
          oldFeaturedImagePath,
          "updatePage: old featured image replaced"
        );
      }
    } else if (
      clear_featured_image === "true" ||
      clear_featured_image === true
    ) {
      // Explicitly clear existing image
      updateFields.push("featured_image = ?");
      updateValues.push(null);
      responseBody.image_cleared = true;
      if (
        oldFeaturedImagePath &&
        oldFeaturedImagePath.startsWith("/uploads/pages/")
      ) {
        deleteFile(oldFeaturedImagePath, "updatePage: clear featured image");
      }
    }

    updateFields.push("updated_at = NOW()");

    if (
      updateFields.length === 0 &&
      (!uploadedFiles ||
        (!uploadedFiles.gallery_images && !uploadedFiles.featured_image)) &&
      (!delete_gallery_image_ids || delete_gallery_image_ids === "[]") &&
      (!updated_gallery_images_order ||
        updated_gallery_images_order === "[]") &&
      clear_featured_image !== "true" &&
      clear_featured_image !== true
    ) {
      if (uploadedFiles) {
        if (uploadedFiles.featured_image)
          deleteFile(
            uploadedFiles.featured_image[0].path,
            "updatePage: no data (featured)"
          );
        if (uploadedFiles.gallery_images)
          deleteMultipleFiles(
            uploadedFiles.gallery_images.map((f) => f.path),
            "updatePage: no data (gallery)"
          );
      }
      return res
        .status(400)
        .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    if (updateFields.length > 0) {
      const query = `UPDATE pages SET ${updateFields.join(", ")} WHERE id = ?`;
      updateValues.push(id);
      await connection.query(query, updateValues);
    }

    const newGalleryImagePaths = [];
    if (
      uploadedFiles &&
      uploadedFiles.gallery_images &&
      uploadedFiles.gallery_images.length > 0
    ) {
      const [lastOrderResult] = await connection.query(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM page_gallery_images WHERE page_id = ?",
        [id]
      );
      let nextSortOrder = (lastOrderResult[0].max_order || 0) + 1;

      const galleryValues = uploadedFiles.gallery_images.map((file) => {
        const imagePath = `/uploads/pages/${file.filename}`;
        newGalleryImagePaths.push(imagePath);
        return [id, imagePath, file.originalname, nextSortOrder++];
      });
      await connection.query(
        "INSERT INTO page_gallery_images (page_id, image_path, alt_text, sort_order) VALUES ?",
        [galleryValues]
      );
    }

    if (delete_gallery_image_ids && delete_gallery_image_ids !== "[]") {
      const idsToDelete = JSON.parse(delete_gallery_image_ids).map(Number);
      if (idsToDelete.length > 0) {
        const placeholders = idsToDelete.map(() => "?").join(",");
        const [imagesToDelete] = await connection.query(
          `SELECT image_path FROM page_gallery_images WHERE id IN (${placeholders}) AND page_id = ?`,
          [...idsToDelete, id]
        );
        if (imagesToDelete.length > 0) {
          const pathsToDelete = imagesToDelete.map((img) => img.image_path);
          deleteMultipleFiles(
            pathsToDelete,
            "updatePage: delete specific gallery images"
          );
          await connection.query(
            `DELETE FROM page_gallery_images WHERE id IN (${placeholders}) AND page_id = ?`,
            [...idsToDelete, id]
          );
          responseBody.deleted_gallery_image_ids = idsToDelete;
        }
      }
    }

    if (updated_gallery_images_order && updated_gallery_images_order !== "[]") {
      const orderUpdates = JSON.parse(updated_gallery_images_order);
      const updatePromises = orderUpdates.map((item) =>
        connection.query(
          "UPDATE page_gallery_images SET sort_order = ? WHERE id = ? AND page_id = ?",
          [item.sort_order, item.id, id]
        )
      );
      await Promise.all(updatePromises);
      responseBody.updated_gallery_images_order = orderUpdates;
    }

    await connection.commit();

    const [finalGalleryImages] = await db.query(
      "SELECT id, image_path, alt_text, sort_order FROM page_gallery_images WHERE page_id = ? ORDER BY sort_order ASC",
      [id]
    );

    res.status(200).json({
      message: "Halaman berhasil diperbarui",
      new_featured_image_path: newFeaturedImagePath,
      new_gallery_image_paths: newGalleryImagePaths,
      gallery_images: finalGalleryImages,
      ...responseBody,
    });
  } catch (error) {
    console.error("Error updating page:", error);
    if (connection) await connection.rollback();
    if (req.files) {
      if (req.files.featured_image)
        deleteFile(
          req.files.featured_image[0].path,
          "updatePage: DB error (featured)"
        );
      if (req.files.gallery_images)
        deleteMultipleFiles(
          req.files.gallery_images.map((f) => f.path),
          "updatePage: DB error (gallery)"
        );
    }
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error:
          "Terjadi duplikasi entri. Judul atau slug halaman mungkin sudah terdaftar.",
        details: error.message,
      });
    } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({
        error: "ID penulis tidak valid.",
        details: error.message,
      });
    } else {
      res
        .status(500)
        .json({ error: "Gagal memperbarui halaman", details: error.message });
    }
  } finally {
    if (connection) connection.release();
  }
};

exports.getPages = async (req, res) => {
  try {
    const {
      pageIndex = 1,
      pageSize = 10,
      query: search = "",
      author_id,
    } = req.query;

    const sortKey = req.query['sort[key]'];
    const sortOrder = req.query['sort[order]'];

    const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
    const parsedPageSize = parseInt(pageSize);

    let whereClauses = [];
    let queryParams = [];

    if (search) {
      whereClauses.push(
        "(p.title LIKE ? OR p.content LIKE ? OR p.slug LIKE ?)"
      );
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (author_id) {
      whereClauses.push("p.author_id = ?");
      queryParams.push(author_id);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let orderBySql = "ORDER BY p.created_at DESC";
    
    if (sortKey && sortOrder) {
      const allowedSortColumns = [
        "id",
        "title",
        "slug",
        "created_at",
        "updated_at",
        "author_id",
      ];
      let finalSortBy = allowedSortColumns.includes(sortKey)
        ? `p.${sortKey}`
        : "p.created_at";
      if (sortKey === "author_name") {
        finalSortBy = "u.name";
      }
      const finalOrder =
        sortOrder.toUpperCase() === "ASC" ||
        sortOrder.toUpperCase() === "DESC"
          ? sortOrder.toUpperCase()
          : "DESC";
      orderBySql = `ORDER BY ${finalSortBy} ${finalOrder}`;
    }

    const [pages] = await db.query(
      `SELECT
          p.id, p.title, p.slug, p.content, p.author_id, p.meta_title, p.meta_description,
          p.featured_image, p.created_at, p.updated_at,
          u.name AS author_name
        FROM
          pages p
        LEFT JOIN
          users u ON p.author_id = u.id
        ${whereSql}
        ${orderBySql}
        LIMIT ? OFFSET ?`,
      [...queryParams, parsedPageSize, offset]
    );

    const [totalResults] = await db.query(
      `SELECT COUNT(p.id) AS total FROM pages p LEFT JOIN users u ON p.author_id = u.id ${whereSql}`,
      queryParams
    );
    const totalItems = totalResults[0].total;
    const totalPages = Math.ceil(totalItems / parsedPageSize);

    const pageIds = pages.map((p) => p.id);
    let allGalleryImages = [];

    if (pageIds.length > 0) {
      const [images] = await db.query(
        "SELECT id, page_id, image_path, alt_text, sort_order FROM page_gallery_images WHERE page_id IN (?) ORDER BY page_id ASC, sort_order ASC",
        [pageIds]
      );
      allGalleryImages = images;
    }

    const pagesWithGallery = pages.map((page) => ({
      ...page,
      gallery_images: allGalleryImages.filter((img) => img.page_id === page.id),
    }));

    res.status(200).json({
      data: pagesWithGallery,
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(pageIndex),
        itemsPerPage: parsedPageSize,
      },
    });
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
      "SELECT id, title, slug, content, author_id, meta_title, meta_description, featured_image, created_at, updated_at FROM pages WHERE id = ?",
      [id]
    );

    if (page.length === 0) {
      return res.status(404).json({ error: "Halaman tidak ditemukan" });
    }

    const [galleryImages] = await db.query(
      "SELECT id, image_path, alt_text, sort_order FROM page_gallery_images WHERE page_id = ? ORDER BY sort_order ASC",
      [id]
    );

    const transformedPage = {
      ...page[0],
      gallery_images: galleryImages,
    };

    res.status(200).json(transformedPage);
  } catch (error) {
    console.error("Error fetching page by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil halaman", details: error.message });
  }
};

exports.getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [page] = await db.query(
      `SELECT
          p.id, p.title, p.slug, p.content, p.author_id, p.meta_title, p.meta_description,
          p.featured_image, p.created_at, p.updated_at,
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

    const [galleryImages] = await db.query(
      "SELECT id, image_path, alt_text, sort_order FROM page_gallery_images WHERE page_id = ? ORDER BY sort_order ASC",
      [page[0].id]
    );

    const transformedPage = {
      ...page[0],
      gallery_images: galleryImages,
    };

    res.status(200).json(transformedPage);
  } catch (error) {
    console.error("Error fetching page by slug:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil halaman", details: error.message });
  }
};

exports.deletePage = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [page] = await connection.query(
      "SELECT featured_image FROM pages WHERE id = ?",
      [id]
    );
    const featuredImagePathToDelete =
      page.length > 0 ? page[0].featured_image : null;

    const [galleryImages] = await connection.query(
      "SELECT image_path FROM page_gallery_images WHERE page_id = ?",
      [id]
    );
    const galleryImagePathsToDelete = galleryImages.map(
      (img) => img.image_path
    );

    const [result] = await connection.query("DELETE FROM pages WHERE id = ?", [
      id,
    ]);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Halaman tidak ditemukan" });
    }

    if (
      featuredImagePathToDelete &&
      featuredImagePathToDelete.startsWith("/uploads/pages/")
    ) {
      deleteFile(featuredImagePathToDelete, "deletePage: featured image");
    }
    deleteMultipleFiles(
      galleryImagePathsToDelete,
      "deletePage: gallery images"
    );

    res.status(200).json({ message: "Halaman berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting page:", error);
    if (connection) await connection.rollback();
    res
      .status(500)
      .json({ error: "Gagal menghapus halaman", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};