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
    const uploadedFiles = req.files;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res
        .status(400)
        .json({ error: "Setidaknya satu file harus diunggah." });
    }
    if (!uploaded_by) {
      deleteMultipleFiles(
        uploadedFiles.map((f) => f.path),
        "createMediaCollection: missing uploaded_by"
      );
      return res.status(400).json({ error: "ID pengunggah wajib diisi." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [collectionResult] = await connection.query(
      "INSERT INTO media_collection (title, caption, category_id, uploaded_by, created_at) VALUES (?, ?, ?, ?, NOW())",
      [title || null, caption || null, category_id || null, uploaded_by]
    );
    const mediaCollectionId = collectionResult.insertId;

    const mediaValues = uploadedFiles.map((file, index) => [
      mediaCollectionId,
      `/uploads/media/${file.filename}`,
      file.originalname,
      index + 1,
    ]);

    await connection.query(
      "INSERT INTO media (media_collection_id, url, file_name, sort_order) VALUES ?",
      [mediaValues]
    );

    await connection.commit();

    const [insertedFiles] = await db.query(
      "SELECT id, file_name, url, sort_order FROM media WHERE media_collection_id = ? ORDER BY sort_order",
      [mediaCollectionId]
    );

    res.status(201).json({
      id: mediaCollectionId,
      title: title,
      caption: caption,
      category_id: category_id,
      uploaded_by: uploaded_by,
      files: insertedFiles,
      message: "Koleksi media berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating media collection:", error);
    if (connection) await connection.rollback();
    if (req.files) {
      deleteMultipleFiles(
        req.files.map((f) => f.path),
        "createMediaCollection: DB error"
      );
    }
    res
      .status(500)
      .json({ error: "Gagal membuat koleksi media.", details: error.message });
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
      `SELECT mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by, mc.updated_at, u.name AS uploaded_by_name, mc_cat.name AS category_name,mc_cat.id AS category_id FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id ${whereSql} ${orderByClause} LIMIT ? OFFSET ?`,
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
        `SELECT id, media_collection_id, url FROM media WHERE media_collection_id IN (?)`,
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
      error: "Gagal mengambil daftar koleksi media.",
      details: error.message,
    });
  }
};

exports.getMediaCollectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [collection] = await db.query(
      `SELECT 
          mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by,
          u.name AS uploaded_by_name,
          mc_cat.name AS category_name,
          mc_cat.id AS category_id
        FROM media_collection mc
        LEFT JOIN users u ON mc.uploaded_by = u.id
        LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id
        WHERE mc.id = ?`,
      [id]
    );

    if (collection.length === 0) {
      return res.status(404).json({ error: "Koleksi media tidak ditemukan." });
    }

    // Mengambil file dan mengurutkannya berdasarkan sort_order
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
      error: "Gagal mengambil koleksi media.",
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
    const filePathsToDelete = filesToDelete.map((f) => f.url);

    await connection.query("DELETE FROM media WHERE media_collection_id = ?", [
      id,
    ]);

    const [result] = await connection.query(
      "DELETE FROM media_collection WHERE id = ?",
      [id]
    );

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Koleksi media tidak ditemukan." });
    }

    deleteMultipleFiles(filePathsToDelete, "deleteMediaCollection");

    res.status(200).json({ message: "Koleksi media berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting media collection:", error);
    if (connection) await connection.rollback();
    res.status(500).json({
      error: "Gagal menghapus koleksi media.",
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
    } = req.body;
    const uploadedFiles = req.files;

    if (!id) {
      return res.status(400).json({ error: "ID koleksi media tidak valid." });
    }

    let updateFields = [];
    let updateValues = [];

    const [oldCollection] = await db.query(
      "SELECT id FROM media_collection WHERE id = ?",
      [id]
    );

    if (oldCollection.length === 0) {
      if (uploadedFiles && uploadedFiles.length > 0) {
        deleteMultipleFiles(
          uploadedFiles.map((f) => f.path),
          "updateMediaCollection: collection not found"
        );
      }
      return res.status(404).json({ error: "Koleksi media tidak ditemukan." });
    }

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

    updateFields.push("updated_at = NOW()");

    if (
      updateFields.length === 1 &&
      (!delete_media_file_ids || delete_media_file_ids === "[]") &&
      (!uploadedFiles || uploadedFiles.length === 0) &&
      !updated_sort_order
    ) {
      return res
        .status(400)
        .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    if (updateFields.length > 0) {
      const query = `UPDATE media_collection SET ${updateFields.join(
        ", "
      )} WHERE id = ?`;
      updateValues.push(id);
      await connection.query(query, updateValues);
    }

    let deletedFileIds = [];
    if (delete_media_file_ids && delete_media_file_ids !== "[]") {
      console.log("String JSON yang diterima:", delete_media_file_ids);

      const idsToDelete = JSON.parse(delete_media_file_ids).map(Number);
      if (idsToDelete.length > 0) {
        const placeholders = idsToDelete.map(() => "?").join(",");
        const [filesToDelete] = await connection.query(
          `SELECT url FROM media WHERE id IN (${placeholders}) AND media_collection_id = ?`,
          [...idsToDelete, id]
        );
        if (filesToDelete.length > 0) {
          const filePathsToDelete = filesToDelete.map((file) => file.url);
          deleteMultipleFiles(
            filePathsToDelete,
            "updateMediaCollection: delete specific files"
          );

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
    if (uploadedFiles && uploadedFiles.length > 0) {
      const [maxSortOrderResult] = await connection.query(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM media WHERE media_collection_id = ?",
        [id]
      );
      let nextSortOrder = maxSortOrderResult[0].max_order + 1;

      const fileValues = uploadedFiles.map((file, index) => [
        id,
        `/uploads/media/${file.filename}`,
        file.originalname,
        nextSortOrder + index,
      ]);

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
      `SELECT mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by, mc.updated_at, u.name AS uploaded_by_name, mc_cat.name AS category_name, mc_cat.id AS category_id FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id WHERE mc.id = ?`,
      [id]
    );

    const [finalFiles] = await db.query(
      "SELECT id, file_name, url, sort_order FROM media WHERE media_collection_id = ? ORDER BY sort_order",
      [id]
    );

    res.status(200).json({
      message: "Koleksi media berhasil diperbarui.",
      ...updatedCollection[0],
      files: finalFiles,
      deleted_file_ids: deletedFileIds,
      new_files: newFiles,
    });
  } catch (error) {
    console.error("Error updating media collection:", error);
    if (connection) await connection.rollback();
    if (req.files) {
      deleteMultipleFiles(
        req.files.map((f) => f.path),
        "updateMediaCollection: DB error"
      );
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({
        error: "ID kategori tidak valid.",
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: "Gagal memperbarui koleksi media.",
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

    // Logika filter utama
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

    // Tambahkan filter kategori dari req.params
    if (categoryId && !isNaN(parseInt(categoryId))) {
      whereClauses.push("mc.category_id = ?");
      queryParams.push(parseInt(categoryId));
    } else {
      return res.status(400).json({ error: "ID kategori tidak valid." });
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
      `SELECT mc.id, mc.title, mc.caption, mc.created_at, mc.uploaded_by, mc.updated_at, u.name AS uploaded_by_name, mc_cat.name AS category_name,mc_cat.id AS category_id FROM media_collection mc LEFT JOIN users u ON mc.uploaded_by = u.id LEFT JOIN media_categories mc_cat ON mc.category_id = mc_cat.id ${whereSql} ${orderByClause} LIMIT ? OFFSET ?`,
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
        `SELECT id, media_collection_id, url FROM media WHERE media_collection_id IN (?)`,
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
      error: "Gagal mengambil daftar koleksi media berdasarkan kategori.",
      details: error.message,
    });
  }
};