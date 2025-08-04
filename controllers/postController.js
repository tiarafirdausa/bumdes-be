// controllers/postController.js
const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const deleteFile = (filePath, context) => {
  if (
    !filePath ||
    typeof filePath !== "string" ||
    !filePath.startsWith("/uploads/posts/")
  ) {
    console.error(
      `Invalid or suspicious file path for deletion (${context}):`,
      filePath
    );
    return;
  }

  const fullPath = path.join(__dirname, "..", filePath);
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

exports.createPost = async (req, res) => {
  let connection;
  try {
    const {
      title,
      excerpt,
      content,
      author_id,
      meta_title,
      meta_description,
      status,
      published_at,
    } = req.body;

    let categories = req.body.categories;
    let tags = req.body.tags;

    if (categories === undefined) {
      categories = [];
    } else if (!Array.isArray(categories)) {
      categories = [categories];
    }

    if (tags === undefined) {
      tags = [];
    } else if (!Array.isArray(tags)) {
      tags = [tags];
    }

    const uploadedFiles = req.files;

    if (!title || !content || !author_id) {
      if (uploadedFiles) {
        if (uploadedFiles.featured_image)
          deleteFile(
            uploadedFiles.featured_image[0].path,
            "missing fields (featured)"
          );
        if (uploadedFiles.gallery_images)
          deleteMultipleFiles(
            uploadedFiles.gallery_images.map((f) => f.path),
            "missing fields (gallery)"
          );
      }
      return res
        .status(400)
        .json({ error: "Judul, konten, dan ID penulis wajib diisi." });
    }

    const featured_image_path =
      uploadedFiles && uploadedFiles.featured_image
        ? `/uploads/posts/${uploadedFiles.featured_image[0].filename}`
        : null;

    let slug = req.body.slug;
    if (!slug) {
      slug = title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    const [existingSlug] = await db.query(
      "SELECT id FROM posts WHERE slug = ?",
      [slug]
    );

    if (existingSlug.length > 0) {
      let suffix = 1;
      let uniqueSlug = slug;
      while (true) {
        const [checkSlug] = await db.query(
          "SELECT id FROM posts WHERE slug = ?",
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
        : excerpt || title;

    const finalStatus = ["draft", "published", "archived"].includes(status)
      ? status
      : "draft";
    const finalPublishedAt =
      finalStatus === "published" && published_at
        ? new Date(published_at)
        : finalStatus === "published"
        ? new Date()
        : null;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [postResult] = await connection.query(
      "INSERT INTO posts (title, slug, excerpt, content, featured_image, meta_title, meta_description, author_id, status, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        title,
        slug,
        excerpt || null,
        content,
        featured_image_path,
        finalMetaTitle,
        finalMetaDescription,
        author_id,
        finalStatus,
        finalPublishedAt,
      ]
    );
    const postId = postResult.insertId;

    const galleryImagesPaths = [];
    if (
      uploadedFiles &&
      uploadedFiles.gallery_images &&
      uploadedFiles.gallery_images.length > 0
    ) {
      const galleryValues = uploadedFiles.gallery_images.map((file, index) => {
        const imagePath = `/uploads/posts/${file.filename}`;
        galleryImagesPaths.push(imagePath);
        return [postId, imagePath, null, index];
      });
      await connection.query(
        "INSERT INTO post_gallery_images (post_id, image_path, alt_text, sort_order) VALUES ?",
        [galleryValues]
      );
    }

    // Insert post categories
    if (categories.length > 0) {
      const categoryValues = categories.map((catId) => [
        postId,
        parseInt(catId),
      ]); // Pastikan catId adalah integer
      await connection.query(
        "INSERT IGNORE INTO post_categories (post_id, category_id) VALUES ?",
        [categoryValues]
      );
    }

    if (tags.length > 0) {
      const tagValues = tags.map((tagId) => [postId, parseInt(tagId)]); // Pastikan tagId adalah integer
      await connection.query(
        "INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES ?",
        [tagValues]
      );
    }

    await connection.commit();

    res.status(201).json({
      id: postId,
      title,
      slug,
      excerpt,
      content,
      featured_image: featured_image_path,
      gallery_images: galleryImagesPaths,
      meta_title: finalMetaTitle,
      meta_description: finalMetaDescription,
      author_id,
      status: finalStatus,
      published_at: finalPublishedAt,
      categories: categories.map((id) => parseInt(id)),
      tags: tags.map((id) => parseInt(id)),
      message: "Postingan berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating post:", error);
    if (connection) await connection.rollback();
    if (req.files) {
      if (req.files.featured_image)
        deleteFile(req.files.featured_image[0].path, "DB failure (featured)");
      if (req.files.gallery_images)
        deleteMultipleFiles(
          req.files.gallery_images.map((f) => f.path),
          "DB failure (gallery)"
        );
    }

    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error:
          "Terjadi duplikasi entri. Judul atau slug postingan mungkin sudah terdaftar.",
        details: error.message,
      });
    } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({
        error: "ID penulis, kategori, atau tag tidak valid.",
        details: error.message,
      });
    } else {
      res
        .status(500)
        .json({ error: "Gagal membuat postingan", details: error.message });
    }
  } finally {
    if (connection) connection.release();
  }
};

exports.updatePost = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            title,
            newSlug,
            excerpt,
            content,
            author_id,
            meta_title,
            meta_description,
            status,
            published_at,
            clear_featured_image,
            clear_gallery_images,
            delete_gallery_image_ids,
        } = req.body;
        
        let parsed_delete_gallery_image_ids = [];
        if (delete_gallery_image_ids) {
            try {
                parsed_delete_gallery_image_ids = JSON.parse(delete_gallery_image_ids);
                if (!Array.isArray(parsed_delete_gallery_image_ids)) {
                    parsed_delete_gallery_image_ids = [];
                }
            } catch (e) {
                console.error("Failed to parse delete_gallery_image_ids:", e);
                parsed_delete_gallery_image_ids = [];
            }
        }

        let categories = req.body.categories;
        let tags = req.body.tags;

        if (categories === undefined) {
            categories = [];
        } else if (!Array.isArray(categories)) {
            categories = [categories];
        }
        if (tags === undefined) {
            tags = [];
        } else if (!Array.isArray(tags)) {
            tags = [tags];
        }

        const uploadedFiles = req.files;

        let newFeaturedImagePath = undefined;
        if (uploadedFiles && uploadedFiles.featured_image) {
            newFeaturedImagePath = `/uploads/posts/${uploadedFiles.featured_image[0].filename}`;
        }

        let updateFields = [];
        let updateValues = [];
        let responseBody = {};

        const [oldPost] = await db.query(
            "SELECT featured_image, status FROM posts WHERE id = ?",
            [id]
        );
        if (oldPost.length === 0) {
            if (uploadedFiles) {
                if (uploadedFiles.featured_image)
                    deleteFile(
                        uploadedFiles.featured_image[0].path,
                        "post not found (featured)"
                    );
                if (uploadedFiles.gallery_images)
                    deleteMultipleFiles(
                        uploadedFiles.gallery_images.map((f) => f.path),
                        "post not found (gallery)"
                    );
            }
            return res.status(404).json({ error: "Postingan tidak ditemukan." });
        }
        const oldFeaturedImagePath = oldPost[0].featured_image;
        const oldStatus = oldPost[0].status;

        if (title !== undefined) {
            const [existingTitle] = await db.query(
                "SELECT id FROM posts WHERE title = ? AND id != ?",
                [title, id]
            );
            if (existingTitle.length > 0) {
                if (uploadedFiles) {
                    if (uploadedFiles.featured_image)
                        deleteFile(
                            uploadedFiles.featured_image[0].path,
                            "duplicate title (featured)"
                        );
                    if (uploadedFiles.gallery_images)
                        deleteMultipleFiles(
                            uploadedFiles.gallery_images.map((f) => f.path),
                            "duplicate title (gallery)"
                        );
                }
                return res
                    .status(409)
                    .json({ error: "Postingan dengan judul ini sudah ada." });
            }
            updateFields.push("title = ?");
            updateValues.push(title);
        }

        if (newSlug !== undefined) {
            const [existingSlug] = await db.query(
                "SELECT id FROM posts WHERE slug = ? AND id != ?",
                [newSlug, id]
            );
            if (existingSlug.length > 0) {
                if (uploadedFiles) {
                    if (uploadedFiles.featured_image)
                        deleteFile(
                            uploadedFiles.featured_image[0].path,
                            "duplicate slug (featured)"
                        );
                    if (uploadedFiles.gallery_images)
                        deleteMultipleFiles(
                            uploadedFiles.gallery_images.map((f) => f.path),
                            "duplicate slug (gallery)"
                        );
                }
                return res
                    .status(409)
                    .json({ error: "Postingan dengan slug ini sudah ada." });
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
                    "SELECT id FROM posts WHERE slug = ? AND id != ?",
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

        if (excerpt !== undefined) {
            updateFields.push("excerpt = ?");
            updateValues.push(excerpt || null);
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

        let calculatedPublishedAt = null;
        if (
            status !== undefined &&
            ["draft", "published", "archived"].includes(status)
        ) {
            updateFields.push("status = ?");
            updateValues.push(status);
            if (status === "published" && oldStatus !== "published") {
                calculatedPublishedAt = new Date();
            }
        }

        if (published_at !== undefined) {
            calculatedPublishedAt = published_at ? new Date(published_at) : null;
        }

        if (
            calculatedPublishedAt !== null ||
            (published_at !== undefined && published_at === null)
        ) {
            updateFields.push("published_at = ?");
            updateValues.push(calculatedPublishedAt);
        }

        if (newFeaturedImagePath !== undefined) {
            updateFields.push("featured_image = ?");
            updateValues.push(newFeaturedImagePath);
            if (
                oldFeaturedImagePath &&
                oldFeaturedImagePath.startsWith("/uploads/posts/")
            ) {
                deleteFile(oldFeaturedImagePath, "old featured image replaced");
            }
        } else if (clear_featured_image === 'true') { 
            updateFields.push("featured_image = ?");
            updateValues.push(null);
            responseBody.image_cleared = true;
            if (
                oldFeaturedImagePath &&
                oldFeaturedImagePath.startsWith("/uploads/posts/")
            ) {
                deleteFile(oldFeaturedImagePath, "clear featured image");
            }
        }

        updateFields.push("updated_at = NOW()");

        if (
            updateFields.length === 0 &&
            categories === undefined &&
            tags === undefined &&
            (!uploadedFiles ||
                (!uploadedFiles.gallery_images && !uploadedFiles.featured_image)) &&
            clear_gallery_images === undefined &&
            delete_gallery_image_ids === undefined &&
            clear_featured_image === undefined
        ) {
            if (uploadedFiles) {
                if (uploadedFiles.featured_image)
                    deleteFile(
                        uploadedFiles.featured_image[0].path,
                        "no data to update (featured)"
                    );
                if (uploadedFiles.gallery_images)
                    deleteMultipleFiles(
                        uploadedFiles.gallery_images.map((f) => f.path),
                        "no data to update (gallery)"
                    );
            }
            return res
                .status(400)
                .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        if (updateFields.length > 0) {
            const query = `UPDATE posts SET ${updateFields.join(", ")} WHERE id = ?`;
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
                "SELECT MAX(sort_order) AS max_order FROM post_gallery_images WHERE post_id = ?",
                [id]
            );
            let nextSortOrder = (lastOrderResult[0].max_order || 0) + 1;

            const galleryValues = uploadedFiles.gallery_images.map((file) => {
                const imagePath = `/uploads/posts/${file.filename}`;
                newGalleryImagePaths.push(imagePath);
                return [id, imagePath, null, nextSortOrder++];
            });
            await connection.query(
                "INSERT INTO post_gallery_images (post_id, image_path, alt_text, sort_order) VALUES ?",
                [galleryValues]
            );
        }
        
        if (clear_gallery_images === 'true') { 
            const [existingGalleryImages] = await connection.query(
                "SELECT image_path FROM post_gallery_images WHERE post_id = ?",
                [id]
            );
            if (existingGalleryImages.length > 0) {
                const pathsToDelete = existingGalleryImages.map(
                    (img) => img.image_path
                );
                deleteMultipleFiles(pathsToDelete, "clear all gallery images");
                await connection.query(
                    "DELETE FROM post_gallery_images WHERE post_id = ?",
                    [id]
                );
                responseBody.gallery_images_cleared = true;
            }
        }

        if (
            parsed_delete_gallery_image_ids &&
            Array.isArray(parsed_delete_gallery_image_ids) &&
            parsed_delete_gallery_image_ids.length > 0
        ) {
            const placeholders = parsed_delete_gallery_image_ids.map(() => "?").join(",");
            const [imagesToDelete] = await connection.query(
                `SELECT image_path FROM post_gallery_images WHERE id IN (${placeholders}) AND post_id = ?`,
                [...parsed_delete_gallery_image_ids, id]
            );
            if (imagesToDelete.length > 0) {
                const pathsToDelete = imagesToDelete.map((img) => img.image_path);
                deleteMultipleFiles(pathsToDelete, "delete specific gallery images");
                await connection.query(
                    `DELETE FROM post_gallery_images WHERE id IN (${placeholders}) AND post_id = ?`,
                    [...parsed_delete_gallery_image_ids, id]
                );
                responseBody.deleted_gallery_image_ids = parsed_delete_gallery_image_ids;
            }
        }

        if (categories !== undefined) {
            await connection.query("DELETE FROM post_categories WHERE post_id = ?", [
                id,
            ]);
            if (categories.length > 0) {
                const categoryValues = categories.map((catId) => [id, parseInt(catId)]);
                await connection.query(
                    "INSERT IGNORE INTO post_categories (post_id, category_id) VALUES ?",
                    [categoryValues]
                );
            }
        }

        // Update post tags
        if (tags !== undefined) {
            await connection.query("DELETE FROM post_tags WHERE post_id = ?", [id]);
            if (tags.length > 0) {
                const tagValues = tags.map((tagId) => [id, parseInt(tagId)]);
                await connection.query(
                    "INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES ?",
                    [tagValues]
                );
            }
        }

        await connection.commit();

        res.status(200).json({
            message: "Postingan berhasil diperbarui",
            new_featured_image_path: newFeaturedImagePath,
            new_gallery_image_paths: newGalleryImagePaths,
            categories: categories.map((id) => parseInt(id)),
            tags: tags.map((id) => parseInt(id)),
            ...responseBody,
        });
    } catch (error) {
        console.error("Error updating post:", error);
        if (connection) await connection.rollback();
        if (req.files) {
            if (req.files.featured_image)
                deleteFile(req.files.featured_image[0].path, "DB failure (featured)");
            if (req.files.gallery_images)
                deleteMultipleFiles(
                    req.files.gallery_images.map((f) => f.path),
                    "DB failure (gallery)"
                );
        }

        if (error.code === "ER_DUP_ENTRY") {
            res.status(409).json({
                error:
                    "Terjadi duplikasi entri. Judul atau slug postingan mungkin sudah terdaftar.",
                details: error.message,
            });
        } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
            res.status(400).json({
                error: "ID penulis, kategori, atau tag tidak valid.",
                details: error.message,
            });
        } else {
            res
                .status(500)
                .json({ error: "Gagal memperbarui postingan", details: error.message });
        }
    } finally {
        if (connection) connection.release();
    }
};

exports.getPosts = async (req, res) => {
  try {
    const {
      categoryId,
      tagId,
      status,
      authorId,
      query: search,
      pageIndex = 1,
      pageSize = 10,
    } = req.query;

    const sortKey = req.query['sort[key]'];
    const sortOrder = req.query['sort[order]'];

    const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);
    const parsedPageSize = parseInt(pageSize);

    let query = `
      SELECT
          p.id, p.title, p.slug, p.excerpt, p.content, p.featured_image,
          p.meta_title, p.meta_description, p.author_id, p.status, p.published_at,
          p.created_at, p.updated_at,
          u.name AS author_name,
          u.foto AS author_photo,
          GROUP_CONCAT(DISTINCT c.id, ':', c.name, ':', c.slug ORDER BY c.name SEPARATOR ';') AS categories_info,
          GROUP_CONCAT(DISTINCT t.id, ':', t.name, ':', t.slug ORDER BY t.name SEPARATOR ';') AS tags_info,
          GROUP_CONCAT(DISTINCT pgi.id, ':', pgi.image_path, ':', IFNULL(pgi.alt_text, '') ORDER BY pgi.sort_order SEPARATOR ';') AS gallery_images_info
      FROM
          posts p
      LEFT JOIN
          users u ON p.author_id = u.id
      LEFT JOIN
          post_categories pc ON p.id = pc.post_id
      LEFT JOIN
          categories c ON pc.category_id = c.id
      LEFT JOIN
          post_tags pt ON p.id = pt.post_id
      LEFT JOIN
          tags t ON pt.tag_id = t.id
      LEFT JOIN
          post_gallery_images pgi ON p.id = pgi.post_id
    `;

    const queryParams = [];
    const conditions = [];

    if (categoryId) {
      conditions.push(`pc.category_id = ?`);
      queryParams.push(categoryId);
    }
    if (tagId) {
      conditions.push(`pt.tag_id = ?`);
      queryParams.push(tagId);
    }
    if (status) {
      conditions.push(`p.status = ?`);
      queryParams.push(status);
    }
    if (authorId) {
      conditions.push(`p.author_id = ?`);
      queryParams.push(authorId);
    }
    if (search) {
      conditions.push(
        `(p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)`
      );
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(` AND `);
    }

    const allowedSortKeys = [
      "id",
      "title",
      "slug",
      "created_at",
      "updated_at",
      "published_at",
      "status",
      "author_id",
    ];
    let orderBySql = "p.published_at DESC, p.created_at DESC";
    
    if (sortKey && sortOrder) {
      let finalSortBy = allowedSortKeys.includes(sortKey)
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
      orderBySql = `${finalSortBy} ${finalOrder}`;
    }

    query += ` GROUP BY p.id ORDER BY ${orderBySql}`;

    let countQuery = `SELECT COUNT(DISTINCT p.id) AS total FROM posts p LEFT JOIN post_categories pc ON p.id = pc.post_id LEFT JOIN post_tags pt ON p.id = pt.post_id LEFT JOIN users u ON p.author_id = u.id`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ` + conditions.join(` AND `);
    }

    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(parsedPageSize, offset);

    const [posts] = await db.query(query, queryParams);
    const [totalResults] = await db.query(
      countQuery,
      queryParams.slice(0, queryParams.length - 2)
    );

    const totalItems = totalResults[0].total;

    const processedPosts = posts.map((post) => {
      const categories = post.categories_info
        ? post.categories_info
            .split(";")
            .map((cat) => {
              const [id, name, slug] = cat.split(":");
              return { id: parseInt(id), name, slug };
            })
            .filter((cat) => cat.id)
        : [];

      const tags = post.tags_info
        ? post.tags_info
            .split(";")
            .map((tag) => {
              const [id, name, slug] = tag.split(":");
              return { id: parseInt(id), name, slug };
            })
            .filter((tag) => tag.id)
        : [];

      const gallery_images = post.gallery_images_info
        ? post.gallery_images_info
            .split(";")
            .map((img) => {
              const [id, image_path, alt_text] = img.split(":");
              return {
                id: parseInt(id),
                image_path,
                alt_text: alt_text === "null" ? null : alt_text,
              };
            })
            .filter((img) => img.id)
        : [];

      delete post.categories_info;
      delete post.tags_info;
      delete post.gallery_images_info;

      return { ...post, categories, tags, gallery_images };
    });

    res.status(200).json({
      data: processedPosts,
      total: totalItems,
      pageIndex: parseInt(pageIndex),
      pageSize: parsedPageSize,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar postingan",
      details: error.message,
    });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT
          p.id, p.title, p.slug, p.excerpt, p.content, p.featured_image,
          p.meta_title, p.meta_description, p.author_id, p.status, p.published_at,
          p.created_at, p.updated_at,
          u.name AS author_name,
          u.foto AS author_photo,
          GROUP_CONCAT(DISTINCT c.id, ':', c.name, ':', c.slug ORDER BY c.name SEPARATOR ';') AS categories_info,
          GROUP_CONCAT(DISTINCT t.id, ':', t.name, ':', t.slug ORDER BY t.name SEPARATOR ';') AS tags_info,
          GROUP_CONCAT(DISTINCT pgi.id, ':', pgi.image_path, ':', IFNULL(pgi.alt_text, '') ORDER BY pgi.sort_order SEPARATOR ';') AS gallery_images_info
      FROM
          posts p
      LEFT JOIN
          users u ON p.author_id = u.id
      LEFT JOIN
          post_categories pc ON p.id = pc.post_id
      LEFT JOIN
          categories c ON pc.category_id = c.id
      LEFT JOIN
          post_tags pt ON p.id = pt.post_id
      LEFT JOIN
          tags t ON pt.tag_id = t.id
      LEFT JOIN
          post_gallery_images pgi ON p.id = pgi.post_id
      WHERE p.id = ?
      GROUP BY p.id
    `;

    const [posts] = await db.query(query, [id]);
    if (posts.length === 0) {
      return res.status(404).json({ error: "Postingan tidak ditemukan" });
    }

    const post = posts[0];
    const categories = post.categories_info
      ? post.categories_info
          .split(";")
          .map((cat) => {
            const [catId, name, slug] = cat.split(":");
            return { id: parseInt(catId), name, slug };
          })
          .filter((cat) => cat.id)
      : [];

    const tags = post.tags_info
      ? post.tags_info
          .split(";")
          .map((tag) => {
            const [tagId, name, slug] = tag.split(":");
            return { id: parseInt(tagId), name, slug };
          })
          .filter((tag) => tag.id)
      : [];

    const gallery_images = post.gallery_images_info
      ? post.gallery_images_info
          .split(";")
          .map((img) => {
            const [imgId, image_path, alt_text] = img.split(":");
            return {
              id: parseInt(imgId),
              image_path,
              alt_text: alt_text === "null" ? null : alt_text,
            };
          })
          .filter((img) => img.id)
      : [];

    delete post.categories_info;
    delete post.tags_info;
    delete post.gallery_images_info;

    res.status(200).json({ ...post, categories, tags, gallery_images });
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil postingan", details: error.message });
  }
};

exports.getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const query = `
      SELECT
          p.id, p.title, p.slug, p.excerpt, p.content, p.featured_image,
          p.meta_title, p.meta_description, p.author_id, p.status, p.published_at,
          p.created_at, p.updated_at,
          u.name AS author_name,
          u.foto AS author_photo,
          GROUP_CONCAT(DISTINCT c.id, ':', c.name, ':', c.slug ORDER BY c.name SEPARATOR ';') AS categories_info,
          GROUP_CONCAT(DISTINCT t.id, ':', t.name, ':', t.slug ORDER BY t.name SEPARATOR ';') AS tags_info,
          GROUP_CONCAT(DISTINCT pgi.id, ':', pgi.image_path, ':', IFNULL(pgi.alt_text, '') ORDER BY pgi.sort_order SEPARATOR ';') AS gallery_images_info
      FROM
          posts p
      LEFT JOIN
          users u ON p.author_id = u.id
      LEFT JOIN
          post_categories pc ON p.id = pc.post_id
      LEFT JOIN
          categories c ON pc.category_id = c.id
      LEFT JOIN
          post_tags pt ON p.id = pt.post_id
      LEFT JOIN
          tags t ON pt.tag_id = t.id
      LEFT JOIN
          post_gallery_images pgi ON p.id = pgi.post_id
      WHERE p.slug = ?
      GROUP BY p.id
    `;

    const [posts] = await db.query(query, [slug]);

    if (posts.length === 0) {
      return res.status(404).json({ error: "Postingan tidak ditemukan" });
    }

    const post = posts[0];

    const categories = post.categories_info
      ? post.categories_info
          .split(";")
          .map((cat) => {
            const [catId, name, slug] = cat.split(":");
            return { id: parseInt(catId), name, slug };
          })
          .filter((cat) => cat.id)
      : [];

    const tags = post.tags_info
      ? post.tags_info
          .split(";")
          .map((tag) => {
            const [tagId, name, slug] = tag.split(":");
            return { id: parseInt(tagId), name, slug };
          })
          .filter((tag) => tag.id)
      : [];

    const gallery_images = post.gallery_images_info
      ? post.gallery_images_info
          .split(";")
          .map((img) => {
            const [imgId, image_path, alt_text] = img.split(":");
            return {
              id: parseInt(imgId),
              image_path,
              alt_text: alt_text === "null" ? null : alt_text,
            };
          })
          .filter((img) => img.id)
      : [];

    delete post.categories_info;
    delete post.tags_info;
    delete post.gallery_images_info;

    res.status(200).json({ ...post, categories, tags, gallery_images });
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil postingan", details: error.message });
  }
};

exports.deletePost = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [post] = await connection.query(
      "SELECT featured_image FROM posts WHERE id = ?",
      [id]
    );
    const featuredImagePathToDelete =
      post.length > 0 ? post[0].featured_image : null;

    const [galleryImages] = await connection.query(
      "SELECT image_path FROM post_gallery_images WHERE post_id = ?",
      [id]
    );
    const galleryImagePathsToDelete = galleryImages.map(
      (img) => img.image_path
    );

    const [result] = await connection.query("DELETE FROM posts WHERE id = ?", [
      id,
    ]);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Postingan tidak ditemukan" });
    }

    if (
      featuredImagePathToDelete &&
      featuredImagePathToDelete.startsWith("/uploads/posts/")
    ) {
      deleteFile(featuredImagePathToDelete, "post deletion (featured)");
    }
    deleteMultipleFiles(
      galleryImagePathsToDelete,
      "post deletion (gallery images)"
    );

    res.status(200).json({ message: "Postingan berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting post:", error);
    if (connection) await connection.rollback();
    res
      .status(500)
      .json({ error: "Gagal menghapus postingan", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};
