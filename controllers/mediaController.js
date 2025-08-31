// src/controllers/mediaController.js

const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const deleteFile = (filePath, context) => {
  if (
    !filePath ||
    typeof filePath !== "string" ||
    !filePath.startsWith("/uploads/media/")
  ) {
    console.error(
      `Invalid or suspicious file path for deletion (${context}):`,
      filePath
    );
    return;
  }
  const fullPath = path.join(__dirname, "..", "..", "public", filePath);
  console.log("Full path for deletion:", fullPath);
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

exports.createMediaCollection = async (req, res) => {
  let connection;
  try {
    const { title, caption, category_id, uploaded_by } = req.body;
    const uploadedFiles = req.files.media || [];
    const featuredImageFile = req.files.featured_image ? req.files.featured_image[0] : null;
    const originalFeaturedImageFile = req.files.original_featured_image ? req.files.original_featured_image[0] : null;

    if (!uploadedFiles.length && !featuredImageFile) {
      return res.status(400).json({ error: "At least one media file or featured image must be uploaded." });
    }
    if (!uploaded_by) {
      if (featuredImageFile) deleteFile(featuredImageFile.path, "createMediaCollection: missing uploaded_by (featured)");
      if (originalFeaturedImageFile) deleteFile(originalFeaturedImageFile.path, "createMediaCollection: missing uploaded_by (original featured)");
      deleteMultipleFiles(uploadedFiles.map((f) => f.path), "createMediaCollection: missing uploaded_by");
      return res.status(400).json({ error: "Uploader ID is required." });
    }

    const featuredImageUrl = featuredImageFile ? `/uploads/media/${featuredImageFile.filename}` : null;
    const originalFeaturedImageUrl = originalFeaturedImageFile ? `/uploads/media/${originalFeaturedImageFile.filename}` : null;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [collectionResult] = await connection.query(
      "INSERT INTO media_collection (title, caption, category_id, uploaded_by, featured_image, original_featured_image, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [title || null, caption || null, category_id || null, uploaded_by, featuredImageUrl, originalFeaturedImageUrl] 
    );
    const mediaCollectionId = collectionResult.insertId;

    if (uploadedFiles.length > 0) {
      const fileValues = uploadedFiles.map((file, i) => {
        const originalUrl = `/uploads/media/${file.filename}`;
        return [mediaCollectionId, originalUrl, file.originalname, i + 1];
      });

      await connection.query(
        "INSERT INTO media (media_collection_id, url, file_name, sort_order) VALUES ?",
        [fileValues]
      );
    }

    await connection.commit();

    const [insertedFiles] = await db.query(
      "SELECT id, file_name, url, sort_order FROM media WHERE media_collection_id = ? ORDER BY sort_order",
      [mediaCollectionId]
    );
    const [newCollection] = await db.query(
      "SELECT title, caption, category_id, featured_image, original_featured_image FROM media_collection WHERE id = ?",
      [mediaCollectionId]
    );

    res.status(201).json({
      id: mediaCollectionId,
      ...newCollection[0],
      uploaded_by: uploaded_by,
      files: insertedFiles,
      message: "Media collection successfully created.",
    });
  } catch (error) {
    console.error("Error creating media collection:", error);
    if (connection) await connection.rollback();
    if (req.files) {
      if (req.files.featured_image) deleteFile(req.files.featured_image[0].path, "createMediaCollection: DB error (featured)");
      if (req.files.original_featured_image) deleteFile(req.files.original_featured_image[0].path, "createMediaCollection: DB error (original featured)");
      if (req.files.media) deleteMultipleFiles(req.files.media.map((f) => f.path), "createMediaCollection: DB error (media)");
    }
    res.status(500).json({ error: "Failed to create media collection.", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.getMediaCollections = async (req, res) => {
  try {
    const {
      pageIndex = 1,
      pageSize = 10,
      query: search = "",
      categoryId,
      authorId,
    } = req.query;
    const sortKey = req.query["sort[key]"];
    const sortOrder = req.query["sort[order]"];
    const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
    const parsedPageSize = parseInt(pageSize);
    let whereClauses = [];
    let queryParams = [];

    if (search) {
      whereClauses.push(
        "(mc.title LIKE ? OR mc.caption LIKE ? OR u.name LIKE ?)"
      );
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (categoryId && !isNaN(parseInt(categoryId))) {
      whereClauses.push("mc.category_id = ?");
      queryParams.push(parseInt(categoryId));
    }

    if (authorId && !isNaN(parseInt(authorId))) {
      whereClauses.push("mc.uploaded_by = ?");
      queryParams.push(parseInt(authorId));
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    let orderByClause = "ORDER BY mc.created_at DESC";
    if (sortKey && sortOrder) {
      let finalSortBy;
      if (sortKey === "uploaded_by_user.name") {
        finalSortBy = "u.name";
      } else if (
        sortKey === "title" ||
        sortKey === "created_at" ||
        sortKey === "updated_at"
      ) {
        finalSortBy = `mc.${sortKey}`;
      }
      if (finalSortBy) {
        const finalOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
        orderByClause = `ORDER BY ${finalSortBy} ${finalOrder}`;
      }
    }
    const [collections] = await db.query(
      `SELECT mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by, mc.updated_at, mc.featured_image, mc.original_featured_image, u.name AS uploaded_by_name, mc_cat.name AS category_name,mc_cat.id AS category_id FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id ${whereSql} ${orderByClause} LIMIT ? OFFSET ?`,
      [...queryParams, parsedPageSize, offset]
    );

    const [totalResults] = await db.query(
      `SELECT COUNT(mc.id) AS total FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id ${whereSql}`,
      queryParams
    );
    const totalItems = totalResults[0].total;
    const totalPages = Math.ceil(totalItems / parsedPageSize);

    const collectionIds = collections.map((col) => col.id);
    let allMediaFiles = [];

    if (collectionIds.length > 0) {
      const [mediaFiles] = await db.query(
        "SELECT id, media_collection_id, url FROM media WHERE media_collection_id IN (?)",
        [collectionIds]
      );
      allMediaFiles = mediaFiles;
    }

    const collectionsWithMedia = collections.map((collection) => ({
      ...collection,
      media: allMediaFiles.filter(
        (file) => file.media_collection_id === collection.id
      ),
      uploaded_by_user: {
        id: collection.uploaded_by,
        name: collection.uploaded_by_name,
      },
    }));

    res.status(200).json({
      data: collectionsWithMedia,
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(pageIndex),
        itemsPerPage: parsedPageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching media collections:", error);
    res.status(500).json({
      error: "Failed to retrieve media collection list.",
      details: error.message,
    });
  }
};

exports.getMediaCollectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const [collection] = await db.query(
      `SELECT mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by, mc.featured_image, mc.original_featured_image, u.name AS uploaded_by_name, mc_cat.name AS category_name, mc_cat.id AS category_id FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id WHERE mc.id = ?`,
      [id]
    );

    if (collection.length === 0) {
      return res.status(404).json({ error: "Media collection not found." });
    }

    const [files] = await db.query(
      "SELECT id, file_name, url, sort_order FROM media WHERE media_collection_id = ? ORDER BY sort_order",
      [id]
    );

    const transformedCollection = {
      ...collection[0],
      files: files,
    };

    res.status(200).json(transformedCollection);
  } catch (error) {
    console.error("Error fetching media collection by ID:", error);
    res.status(500).json({
      error: "Failed to retrieve media collection.",
      details: error.message,
    });
  }
};

exports.deleteMediaCollection = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [filesToDelete] = await connection.query(
      "SELECT url FROM media WHERE media_collection_id = ?",
      [id]
    );
    const filePathsToDelete = filesToDelete.flatMap((f) =>
      [f.url]
    );

    const [featuredImages] = await connection.query(
      "SELECT featured_image, original_featured_image FROM media_collection WHERE id = ?",
      [id]
    );
    if (featuredImages.length > 0) {
      if (featuredImages[0].featured_image) {
        filePathsToDelete.push(featuredImages[0].featured_image);
      }
      if (featuredImages[0].original_featured_image) {
        filePathsToDelete.push(featuredImages[0].original_featured_image); 
      }
    }

    await connection.query("DELETE FROM media WHERE media_collection_id = ?", [id]);
    const [result] = await connection.query(
      "DELETE FROM media_collection WHERE id = ?",
      [id]
    );
    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Media collection not found." });
    }

    deleteMultipleFiles(filePathsToDelete, "deleteMediaCollection");

    res.status(200).json({ message: "Media collection successfully deleted." });
  } catch (error) {
    console.error("Error deleting media collection:", error);
    if (connection) await connection.rollback();
    res.status(500).json({
      error: "Failed to delete media collection.",
      details: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.updateMediaCollection = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const {
      title,
      caption,
      category_id,
      delete_media_file_ids,
      updated_sort_order,
      clear_featured_image,
    } = req.body;
    const uploadedFiles = req.files.media || [];
    const newFeaturedImage = req.files.featured_image ? req.files.featured_image[0] : null;
    const newOriginalFeaturedImage = req.files.original_featured_image ? req.files.original_featured_image[0] : null; 

    if (!id) {
      return res.status(400).json({ error: "Invalid media collection ID." });
    }

    let updateFields = [];
    let updateValues = [];
    let responseBody = {};

    const [oldCollection] = await db.query(
      "SELECT featured_image, original_featured_image FROM media_collection WHERE id = ?",
      [id]
    );

    if (oldCollection.length === 0) {
      if (req.files) {
        if (req.files.media) deleteMultipleFiles(req.files.media.map((f) => f.path), "updateMediaCollection: collection not found (media)");
        if (req.files.featured_image) deleteFile(req.files.featured_image[0].path, "updateMediaCollection: collection not found (featured)");
        if (req.files.original_featured_image) deleteFile(req.files.original_featured_image[0].path, "updateMediaCollection: collection not found (original featured)"); // Hapus file asli baru jika ada
      }
      return res.status(404).json({ error: "Media collection not found." });
    }
    const oldFeaturedImagePath = oldCollection[0].featured_image;
    const oldOriginalFeaturedImagePath = oldCollection[0].original_featured_image;

    if (title !== undefined) {
      updateFields.push("title = ?");
      updateValues.push(title || null);
    }
    if (caption !== undefined) {
      updateFields.push("caption = ?");
      updateValues.push(caption || null);
    }
    if (category_id !== undefined) {
      updateFields.push("category_id = ?");
      updateValues.push(category_id || null);
    }

    if (newFeaturedImage) {
      const newFeaturedImagePath = `/uploads/media/${newFeaturedImage.filename}`;
      const newOriginalFeaturedImagePathValue = newOriginalFeaturedImage ? `/uploads/media/${newOriginalFeaturedImage.filename}` : null;
      
      updateFields.push("featured_image = ?, original_featured_image = ?");
      updateValues.push(newFeaturedImagePath, newOriginalFeaturedImagePathValue);
      
      if (oldFeaturedImagePath) {
        deleteFile(oldFeaturedImagePath, "updateMediaCollection: old featured image replaced");
      }
      if (oldOriginalFeaturedImagePath) {
        deleteFile(oldOriginalFeaturedImagePath, "updateMediaCollection: old original featured image replaced");
      }
      responseBody.new_featured_image = newFeaturedImagePath;
      responseBody.new_original_featured_image = newOriginalFeaturedImagePathValue;
    } else if (clear_featured_image === "true" || clear_featured_image === true) {
      updateFields.push("featured_image = ?, original_featured_image = ?");
      updateValues.push(null, null);
      if (oldFeaturedImagePath) {
        deleteFile(oldFeaturedImagePath, "updateMediaCollection: clear featured image");
      }
      if (oldOriginalFeaturedImagePath) {
        deleteFile(oldOriginalFeaturedImagePath, "updateMediaCollection: clear original featured image");
      }
      responseBody.featured_image_cleared = true;
    }

    updateFields.push("updated_at = NOW()");

    if (
      updateFields.length === 1 &&
      (!delete_media_file_ids || delete_media_file_ids === "[]") &&
      (!uploadedFiles || uploadedFiles.length === 0) &&
      !updated_sort_order
    ) {
      return res.status(400).json({ error: "No data provided for update." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    if (updateFields.length > 0) {
      const query = `UPDATE media_collection SET ${updateFields.join(", ")} WHERE id = ?`;
      updateValues.push(id);
      await connection.query(query, updateValues);
    }

    let deletedFileIds = [];
    if (delete_media_file_ids && delete_media_file_ids !== "[]") {
      const idsToDelete = JSON.parse(delete_media_file_ids).map(Number);
      if (idsToDelete.length > 0) {
        const placeholders = idsToDelete.map(() => "?").join(",");
        const [filesToDelete] = await connection.query(
          "SELECT url FROM media WHERE id IN (?) AND media_collection_id = ?",
          [idsToDelete, id]
        );
        if (filesToDelete.length > 0) {
          const filePathsToDelete = filesToDelete.map(file => file.url);
          deleteMultipleFiles(filePathsToDelete, "updateMediaCollection: delete specific files");

          await connection.query(
            `DELETE FROM media WHERE id IN (${placeholders}) AND media_collection_id = ?`,
            [...idsToDelete, id]
          );
          deletedFileIds = idsToDelete;
        }
      }
    }

    if (updated_sort_order && updated_sort_order !== "[]") {
      const sortOrderUpdates = JSON.parse(updated_sort_order);
      if (sortOrderUpdates.length > 0) {
        let caseStatements = "";
        let caseValues = [];
        let idsToUpdate = [];
        sortOrderUpdates.forEach((item) => {
          caseStatements += `WHEN id = ? THEN ? `;
          caseValues.push(item.id, item.sort_order);
          idsToUpdate.push(item.id);
        });
        const placeholders = idsToUpdate.map(() => "?").join(",");
        const updateSortOrderQuery = `
            UPDATE media
            SET sort_order = CASE ${caseStatements} END
            WHERE id IN (${placeholders}) AND media_collection_id = ?
        `;
        await connection.query(updateSortOrderQuery, [
          ...caseValues,
          ...idsToUpdate,
          id,
        ]);
      }
    }

    let newFiles = [];
    if (uploadedFiles.length > 0) {
      const [maxSortOrderResult] = await connection.query(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM media WHERE media_collection_id = ?",
        [id]
      );
      let nextSortOrder = maxSortOrderResult[0].max_order + 1;
      const fileValues = uploadedFiles.map((file, index) => {
        const originalUrl = `/uploads/media/${file.filename}`;
        return [
          id,
          originalUrl,
          file.originalname,
          nextSortOrder + index,
        ];
      });

      await connection.query(
        "INSERT INTO media (media_collection_id, url, file_name, sort_order) VALUES ?",
        [fileValues]
      );

      const [insertedFiles] = await connection.query(
        "SELECT id, file_name, url, sort_order FROM media WHERE media_collection_id = ? AND url IN (?)",
        [id, fileValues.map((v) => v[1])]
      );
      newFiles = insertedFiles;
    }

    await connection.commit();
    const [updatedCollection] = await db.query(
      `SELECT mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by, mc.updated_at, mc.featured_image, mc.original_featured_image, u.name AS uploaded_by_name, mc_cat.name AS category_name, mc_cat.id AS category_id FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id WHERE mc.id = ?`,
      [id]
    );

    const [finalFiles] = await db.query(
      "SELECT id, file_name, url, sort_order FROM media WHERE media_collection_id = ? ORDER BY sort_order",
      [id]
    );

    res.status(200).json({
      message: "Media collection successfully updated.",
      ...updatedCollection[0],
      files: finalFiles,
      deleted_file_ids: deletedFileIds,
      new_files: newFiles,
    });
  } catch (error) {
    console.error("Error updating media collection:", error);
    if (connection) await connection.rollback();
    if (req.files) {
      if (req.files.media)
        deleteMultipleFiles(req.files.media.map((f) => f.path), "updateMediaCollection: DB error (media)");
      if (req.files.featured_image)
        deleteFile(req.files.featured_image[0].path, "updateMediaCollection: DB error (featured)");
      if (req.files.original_featured_image)
        deleteFile(req.files.original_featured_image[0].path, "updateMediaCollection: DB error (original featured)");
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({
        error: "Invalid category ID.",
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: "Failed to update media collection.",
        details: error.message,
      });
    }
  } finally {
    if (connection) connection.release();
  }
};

exports.getMediaCollectionsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      pageIndex = 1,
      pageSize = 10,
      query: search = "",
      authorId,
    } = req.query;
    const sortKey = req.query["sort[key]"];
    const sortOrder = req.query["sort[order]"];
    const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
    const parsedPageSize = parseInt(pageSize);
    let whereClauses = [];
    let queryParams = [];

    if (search) {
      whereClauses.push(
        "(mc.title LIKE ? OR mc.caption LIKE ? OR u.name LIKE ?)"
      );
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (authorId && !isNaN(parseInt(authorId))) {
      whereClauses.push("mc.uploaded_by = ?");
      queryParams.push(parseInt(authorId));
    }

    if (categoryId && !isNaN(parseInt(categoryId))) {
      whereClauses.push("mc.category_id = ?");
      queryParams.push(parseInt(categoryId));
    } else {
      return res.status(400).json({ error: "Invalid category ID." });
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    let orderByClause = "ORDER BY mc.created_at DESC";
    if (sortKey && sortOrder) {
      let finalSortBy;
      if (sortKey === "uploaded_by_user.name") {
        finalSortBy = "u.name";
      } else if (
        sortKey === "title" ||
        sortKey === "created_at" ||
        sortKey === "updated_at"
      ) {
        finalSortBy = `mc.${sortKey}`;
      }
      if (finalSortBy) {
        const finalOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
        orderByClause = `ORDER BY ${finalSortBy} ${finalOrder}`;
      }
    }
    const [collections] = await db.query(
      `SELECT mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by, mc.updated_at, mc.featured_image, mc.original_featured_image, u.name AS uploaded_by_name, mc_cat.name AS category_name,mc_cat.id AS category_id FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id ${whereSql} ${orderByClause} LIMIT ? OFFSET ?`,
      [...queryParams, parsedPageSize, offset]
    );

    const [totalResults] = await db.query(
      `SELECT COUNT(mc.id) AS total FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id ${whereSql}`,
      queryParams
    );
    const totalItems = totalResults[0].total;
    const totalPages = Math.ceil(totalItems / parsedPageSize);
    const collectionIds = collections.map((col) => col.id);
    let allMediaFiles = [];

    if (collectionIds.length > 0) {
      const [mediaFiles] = await db.query(
        "SELECT id, media_collection_id, url FROM media WHERE media_collection_id IN (?)",
        [collectionIds]
      );
      allMediaFiles = mediaFiles;
    }

    const collectionsWithMedia = collections.map((collection) => ({
      ...collection,
      media: allMediaFiles.filter(
        (file) => file.media_collection_id === collection.id
      ),
      uploaded_by_user: {
        id: collection.uploaded_by,
        name: collection.uploaded_by_name,
      },
    }));

    res.status(200).json({
      data: collectionsWithMedia,
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(pageIndex),
        itemsPerPage: parsedPageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching media collections by category:", error);
    res.status(500).json({
      error: "Failed to retrieve media collection list by category.",
      details: error.message,
    });
  }
};

exports.getMediaCategories = async (req, res) => {
  try {
    const [categories] = await db.query(
      "SELECT id, name AS category_name FROM media_categories"
    );

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching media categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve media category list.",
      error: error.message,
    });
  }
};