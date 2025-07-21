// controllers/postController.js
const db = require("../models/db");
const path = require("path");
const fs = require("fs");

const deleteFile = (filePath, context) => {
  const fullPath = path.join(__dirname, "..", filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr) console.error(`Error deleting file (${context}):`, fullPath, unlinkErr);
      else console.log(`File deleted (${context}):`, fullPath);
    });
  }
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
      categories,
      tags,       
    } = req.body;

    if (!title || !content || !author_id) {
      if (req.file) deleteFile(req.file.path, "missing fields");
      return res.status(400).json({ error: "Judul, konten, dan ID penulis wajib diisi." });
    }

    const featured_image_path = req.file
      ? `/uploads/posts/${req.file.filename}` 
      : null;

    let slug = req.body.slug;
    if (!slug) {
      slug = title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    // Periksa keunikan slug
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

    const finalMetaTitle = meta_title !== undefined && meta_title !== "" ? meta_title : title;
    const finalMetaDescription = meta_description !== undefined && meta_description !== "" ? meta_description : excerpt || title;

    const finalStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'draft';
    const finalPublishedAt = finalStatus === 'published' && published_at ? new Date(published_at) : (finalStatus === 'published' ? new Date() : null); 

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [postResult] = await connection.query(
      "INSERT INTO posts (title, slug, excerpt, content, thumbnail, featured_image, meta_title, meta_description, author_id, status, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        title,
        slug,
        excerpt || null, 
        content,
        null, 
        featured_image_path,
        finalMetaTitle,
        finalMetaDescription,
        author_id,
        finalStatus,
        finalPublishedAt,
      ]
    );
    const postId = postResult.insertId;

    if (categories && Array.isArray(categories) && categories.length > 0) {
      const categoryValues = categories.map(catId => [postId, catId]);
      await connection.query(
        "INSERT IGNORE INTO post_categories (post_id, category_id) VALUES ?",
        [categoryValues]
      );
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagValues = tags.map(tagId => [postId, tagId]);
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
      meta_title: finalMetaTitle,
      meta_description: finalMetaDescription,
      author_id,
      status: finalStatus,
      published_at: finalPublishedAt,
      categories,
      tags,
      message: "Postingan berhasil dibuat.",
    });
  } catch (error) {
    console.error("Error creating post:", error);
    if (connection) await connection.rollback();
    if (req.file) deleteFile(req.file.path, "DB failure during create");

    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error: "Terjadi duplikasi entri. Judul atau slug postingan mungkin sudah terdaftar.",
        details: error.message,
      });
    } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({
        error: "ID penulis, kategori, atau tag tidak valid.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal membuat postingan", details: error.message });
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
      slug: newSlug, 
      excerpt,
      content,
      author_id,
      meta_title,
      meta_description,
      status,
      published_at,
      categories, 
      tags,      
      clear_featured_image 
    } = req.body;

    const newFeaturedImagePath = req.file
      ? `/uploads/posts/${req.file.filename}`
      : undefined;

    let updateFields = [];
    let updateValues = [];
    let responseBody = {};

    const [oldPost] = await db.query(
      "SELECT featured_image, status FROM posts WHERE id = ?",
      [id]
    );
    if (oldPost.length === 0) {
      if (req.file) deleteFile(req.file.path, "post not found for update");
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
        if (req.file) deleteFile(req.file.path, "duplicate title");
        return res.status(409).json({ error: "Postingan dengan judul ini sudah ada." });
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
        if (req.file) deleteFile(req.file.path, "duplicate slug");
        return res.status(409).json({ error: "Postingan dengan slug ini sudah ada." });
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
      updateValues.push(meta_title || null);
    }
    if (meta_description !== undefined) {
      updateFields.push("meta_description = ?");
      updateValues.push(meta_description || null);
    }

    if (status !== undefined && ['draft', 'published', 'archived'].includes(status)) {
      updateFields.push("status = ?");
      updateValues.push(status);
      if (status === 'published' && oldStatus !== 'published' && published_at === undefined) {
        updateFields.push("published_at = ?");
        updateValues.push(new Date());
      } else if (published_at !== undefined) { 
        updateFields.push("published_at = ?");
        updateValues.push(published_at ? new Date(published_at) : null);
      }
    } else if (published_at !== undefined) { 
        updateFields.push("published_at = ?");
        updateValues.push(published_at ? new Date(published_at) : null);
    }


    if (req.file) { 
      updateFields.push("featured_image = ?");
      updateValues.push(newFeaturedImagePath);
      if (oldFeaturedImagePath && oldFeaturedImagePath.startsWith("/uploads/posts/")) {
        deleteFile(oldFeaturedImagePath, "old featured image");
      }
    } else if (clear_featured_image === true) { 
      updateFields.push("featured_image = ?");
      updateValues.push(null);
      responseBody.image_cleared = true;
      if (oldFeaturedImagePath && oldFeaturedImagePath.startsWith("/uploads/posts/")) {
        deleteFile(oldFeaturedImagePath, "clear featured image");
      }
    }

    updateFields.push("updated_at = NOW()"); 

    if (updateFields.length === 0 && categories === undefined && tags === undefined) {
      if (req.file) deleteFile(req.file.path, "no data to update");
      return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const query = `UPDATE posts SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);
    const [result] = await connection.query(query, updateValues);

    if (categories !== undefined) {
      await connection.query("DELETE FROM post_categories WHERE post_id = ?", [id]);
      if (Array.isArray(categories) && categories.length > 0) {
        const categoryValues = categories.map(catId => [id, catId]);
        await connection.query("INSERT IGNORE INTO post_categories (post_id, category_id) VALUES ?", [categoryValues]);
      }
    }

    if (tags !== undefined) {
      await connection.query("DELETE FROM post_tags WHERE post_id = ?", [id]);
      if (Array.isArray(tags) && tags.length > 0) {
        const tagValues = tags.map(tagId => [id, tagId]);
        await connection.query("INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES ?", [tagValues]);
      }
    }

    await connection.commit(); 

    if (result.affectedRows === 0 && (categories === undefined || categories.length === 0) && (tags === undefined || tags.length === 0)) {
      if (req.file) deleteFile(req.file.path, "no DB change after update");
      return res.status(404).json({
        error: "Postingan tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({
      message: "Postingan berhasil diperbarui",
      new_featured_image_path: newFeaturedImagePath,
      ...responseBody,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    if (connection) await connection.rollback(); 
    if (req.file) deleteFile(req.file.path, "DB failure during update");

    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        error: "Terjadi duplikasi entri. Judul atau slug postingan mungkin sudah terdaftar.",
        details: error.message,
      });
    } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({
        error: "ID penulis, kategori, atau tag tidak valid.",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: "Gagal memperbarui postingan", details: error.message });
    }
  } finally {
    if (connection) connection.release();
  }
};

exports.getPosts = async (req, res) => {
  try {
    const { categoryId, tagId, status, authorId, search, limit, offset } = req.query;
    let query = `
      SELECT
          p.id, p.title, p.slug, p.excerpt, p.content, p.thumbnail, p.featured_image,
          p.meta_title, p.meta_description, p.author_id, p.status, p.published_at,
          p.created_at, p.updated_at,
          u.name AS author_name,
          u.foto AS author_photo,
          GROUP_CONCAT(DISTINCT c.id, ':', c.name, ':', c.slug SEPARATOR ';') AS categories_info,
          GROUP_CONCAT(DISTINCT t.id, ':', t.name, ':', t.slug SEPARATOR ';') AS tags_info
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
      conditions.push(`(p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)`);
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(` AND `);
    }

    query += ` GROUP BY p.id ORDER BY p.published_at DESC, p.created_at DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      queryParams.push(parseInt(limit));
    }
    if (offset) {
      query += ` OFFSET ?`;
      queryParams.push(parseInt(offset));
    }

    const [posts] = await db.query(query, queryParams);

    const processedPosts = posts.map(post => {
      const categories = post.categories_info ? post.categories_info.split(';').map(cat => {
        const [id, name, slug] = cat.split(':');
        return { id: parseInt(id), name, slug };
      }) : [];
      const tags = post.tags_info ? post.tags_info.split(';').map(tag => {
        const [id, name, slug] = tag.split(':');
        return { id: parseInt(id), name, slug };
      }) : [];

      delete post.categories_info;
      delete post.tags_info;

      return { ...post, categories, tags };
    });

    res.status(200).json(processedPosts);
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
          p.id, p.title, p.slug, p.excerpt, p.content, p.thumbnail, p.featured_image,
          p.meta_title, p.meta_description, p.author_id, p.status, p.published_at,
          p.created_at, p.updated_at,
          u.name AS author_name,
          u.foto AS author_photo,
          GROUP_CONCAT(DISTINCT c.id, ':', c.name, ':', c.slug SEPARATOR ';') AS categories_info,
          GROUP_CONCAT(DISTINCT t.id, ':', t.name, ':', t.slug SEPARATOR ';') AS tags_info
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
      WHERE p.id = ?
      GROUP BY p.id
    `;

    const [posts] = await db.query(query, [id]);
    if (posts.length === 0) {
      return res.status(404).json({ error: "Postingan tidak ditemukan" });
    }

    const post = posts[0];
    const categories = post.categories_info ? post.categories_info.split(';').map(cat => {
      const [catId, name, slug] = cat.split(':');
      return { id: parseInt(catId), name, slug };
    }) : [];
    const tags = post.tags_info ? post.tags_info.split(';').map(tag => {
      const [tagId, name, slug] = tag.split(':');
      return { id: parseInt(tagId), name, slug };
    }) : [];

    delete post.categories_info;
    delete post.tags_info;

    res.status(200).json({ ...post, categories, tags });
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    res.status(500).json({ error: "Gagal mengambil postingan", details: error.message });
  }
};

exports.getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const query = `
      SELECT
          p.id, p.title, p.slug, p.excerpt, p.content, p.thumbnail, p.featured_image,
          p.meta_title, p.meta_description, p.author_id, p.status, p.published_at,
          p.created_at, p.updated_at,
          u.name AS author_name,
          u.foto AS author_photo,
          GROUP_CONCAT(DISTINCT c.id, ':', c.name, ':', c.slug SEPARATOR ';') AS categories_info,
          GROUP_CONCAT(DISTINCT t.id, ':', t.name, ':', t.slug SEPARATOR ';') AS tags_info
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
      WHERE p.slug = ?
      GROUP BY p.id
    `;

    const [posts] = await db.query(query, [slug]);

    if (posts.length === 0) {
      return res.status(404).json({ error: "Postingan tidak ditemukan" });
    }

    const post = posts[0];
    const categories = post.categories_info ? post.categories_info.split(';').map(cat => {
      const [catId, name, slug] = cat.split(':');
      return { id: parseInt(catId), name, slug };
    }) : [];
    const tags = post.tags_info ? post.tags_info.split(';').map(tag => {
      const [tagId, name, slug] = tag.split(':');
      return { id: parseInt(tagId), name, slug };
    }) : [];

    delete post.categories_info;
    delete post.tags_info;

    res.status(200).json({ ...post, categories, tags });
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    res.status(500).json({ error: "Gagal mengambil postingan", details: error.message });
  }
};

exports.deletePost = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const [post] = await db.query(
      "SELECT featured_image FROM posts WHERE id = ?",
      [id]
    );
    const featuredImagePathToDelete = post.length > 0 ? post[0].featured_image : null;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query("DELETE FROM posts WHERE id = ?", [id]);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Postingan tidak ditemukan" });
    }

    if (featuredImagePathToDelete && featuredImagePathToDelete.startsWith("/uploads/posts/")) {
      deleteFile(featuredImagePathToDelete, "post deletion");
    }

    res.status(200).json({ message: "Postingan berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting post:", error);
    if (connection) await connection.rollback(); 
    res.status(500).json({ error: "Gagal menghapus postingan", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};