// controllers/menuItemController.js
const db = require("../models/db");

const getReferenceSlugOrTitle = async (type, referenceId) => {
  if (!referenceId) return null;

  let query = "";
  let slugColumn = "";
  let titleColumn = "";

  switch (type) {
    case "category":
      query = "SELECT slug, name AS title FROM categories WHERE id = ?";
      slugColumn = "slug";
      titleColumn = "name";
      break;
    case "page":
      query = "SELECT slug, title FROM pages WHERE id = ?";
      slugColumn = "slug";
      titleColumn = "title";
      break;
    case "post":
      query = "SELECT slug, title FROM posts WHERE id = ?";
      slugColumn = "slug";
      titleColumn = "title";
      break;
    case "media_category":
      query = "SELECT slug, name AS title FROM media_categories WHERE id = ?";
      slugColumn = "slug";
      titleColumn = "name";
      break;
    case "media":
      query = "SELECT id, title FROM media_collection WHERE id = ?";
      slugColumn = "id"; 
      titleColumn = "title";
      break;
    case "link":
      query = "SELECT link, judul AS title FROM links WHERE id = ?";
      slugColumn = "link";
      titleColumn = "judul";
      break;
    default:
      return null;
  }

  try {
    const [rows] = await db.query(query, [referenceId]);
    if (rows.length > 0) {
      let finalSlug = rows[0][slugColumn];
      if (type === "media") {
        finalSlug = `media/${finalSlug}`;
      }  else if (type === "media_category") {
        finalSlug = `media-kategori/${finalSlug}`; 
      } else if (type === "link") {
        finalSlug = finalSlug || `/link/${referenceId}`;
      }
      return {
        slug: finalSlug,
        title: rows[0][titleColumn],
      };
    }
    return null;
  } catch (error) {
    console.error(
      `Error fetching reference for type ${type}, id ${referenceId}:`,
      error
    );
    return null;
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const {
      menu_id,
      parent_id,
      title,
      url,
      type,
      reference_id,
      target,
      order,
    } = req.body;

    if (!menu_id || !title) {
      return res
        .status(400)
        .json({ error: "ID Menu dan Judul item menu wajib diisi." });
    }

    const [menuExists] = await db.query("SELECT id FROM menus WHERE id = ?", [
      menu_id,
    ]);
    if (menuExists.length === 0) {
      return res.status(404).json({ error: "ID Menu tidak ditemukan." });
    }

    if (parent_id) {
      const [parentExists] = await db.query(
        "SELECT id FROM menu_items WHERE id = ? AND menu_id = ?",
        [parent_id, menu_id]
      );
      if (parentExists.length === 0) {
        return res
          .status(404)
          .json({
            error:
              "ID Parent item menu tidak ditemukan atau bukan bagian dari menu ini.",
          });
      }
    }

    const allowedTypes = [
      "category",
      "page",
      "custom",
      "post",
      "media",
      "media_category",
      "link"
    ];
    if (type && !allowedTypes.includes(type)) {
      return res
        .status(400)
        .json({
          error:
            "Tipe menu tidak valid. Tipe yang diperbolehkan: 'category', 'page', 'post', 'custom', 'media', atau 'media_category'.",
        });
    }

    let finalUrl = url;

    if (type === "custom") {
      if (!url) {
        return res
          .status(400)
          .json({ error: "URL wajib diisi untuk tipe menu 'custom'." });
      }
      finalUrl = url;
    } else if (type === "post" && !reference_id) {
      finalUrl = "/post"; 
    } else if (type === "media" && !reference_id) {
      finalUrl = "/media"; 
    } else if (type === "link" && !reference_id) {
      finalUrl = "/link";
    } else if (reference_id) {
      const refData = await getReferenceSlugOrTitle(type, reference_id);
      if (refData) {
        finalUrl = `/${refData.slug}`;
      } else {
        return res
          .status(400)
          .json({
            error: `Referensi ${type} dengan ID ${reference_id} tidak ditemukan.`,
          });
      }
    } else {
      return res
        .status(400)
        .json({ error: `ID referensi wajib diisi untuk tipe menu '${type}'.` });
    }

    const [result] = await db.query(
      "INSERT INTO menu_items (menu_id, parent_id, title, url, type, reference_id, target, `order`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        menu_id,
        parent_id || null,
        title,
        finalUrl || null,
        type || "custom",
        reference_id || null,
        target || "_self",
        order !== undefined ? order : 0,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      menu_id,
      parent_id: parent_id || null,
      title: title,
      url: finalUrl || null,
      type: type || "custom",
      reference_id: reference_id || null,
      target: target || "_self",
      order: order !== undefined ? order : 0,
      message: "Item menu berhasil ditambahkan.",
    });
  } catch (error) {
    console.error("Error creating menu item:", error);
    res
      .status(500)
      .json({ error: "Gagal membuat item menu", details: error.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      menu_id,
      parent_id,
      title,
      url,
      type,
      reference_id,
      target,
      order,
    } = req.body;

    let updateFields = [];
    let updateValues = [];

    const [currentItem] = await db.query(
      "SELECT * FROM menu_items WHERE id = ?",
      [id]
    );
    if (currentItem.length === 0) {
      return res.status(404).json({ error: "Item menu tidak ditemukan." });
    }
    const oldData = currentItem[0];

    if (menu_id !== undefined) {
      const [menuExists] = await db.query("SELECT id FROM menus WHERE id = ?", [
        menu_id,
      ]);
      if (menuExists.length === 0) {
        return res.status(404).json({ error: "ID Menu tidak ditemukan." });
      }
      updateFields.push("menu_id = ?");
      updateValues.push(menu_id);
    }

    if (parent_id !== undefined) {
      if (parent_id !== null && parent_id !== id) {
        const [parentExists] = await db.query(
          "SELECT id FROM menu_items WHERE id = ?",
          [parent_id]
        );
        if (parentExists.length === 0) {
          return res
            .status(404)
            .json({ error: "ID Parent item menu tidak ditemukan." });
        }
      } else if (parent_id === id) {
        return res
          .status(400)
          .json({
            error: "Item menu tidak bisa menjadi parent untuk dirinya sendiri.",
          });
      }
      updateFields.push("parent_id = ?");
      updateValues.push(parent_id || null);
    }

    const newType = type !== undefined ? type : oldData.type;
    const newReferenceId =
      reference_id !== undefined ? reference_id : oldData.reference_id;
    const allowedTypes = [
      "category",
      "page",
      "custom",
      "post",
      "media",
      "media_category",
      "link"
    ];
    if (newType && !allowedTypes.includes(newType)) {
      return res
        .status(400)
        .json({
          error:
            "Tipe menu tidak valid. Tipe yang diperbolehkan: 'category', 'page', 'post', 'custom', 'media', atau 'media_category'.",
        });
    }

    let newUrl = url !== undefined ? url : oldData.url;
    let newTitle = title !== undefined ? title : oldData.title;

    if (type !== undefined || reference_id !== undefined) {
      if (newType === "custom") {
        if (!newUrl) {
          return res
            .status(400)
            .json({ error: "URL wajib diisi untuk tipe menu 'custom'." });
        }
        newUrl = newUrl;
      } else if (newType === "post" && !newReferenceId) {
        newUrl = "/post";
      } else if (newType === "media" && !newReferenceId) {
        newUrl = "/media";
      } else if (newType === "link" && !newReferenceId) {
        newUrl = "/link";
      } else if (newReferenceId) {
        const refData = await getReferenceSlugOrTitle(newType, newReferenceId);
        if (refData) {
          newUrl = `/${refData.slug}`;
        } else {
          return res
            .status(400)
            .json({
              error: `Referensi ${newType} dengan ID ${newReferenceId} tidak ditemukan.`,
            });
        }
      } else {
        return res
          .status(400)
          .json({
            error: `ID referensi wajib diisi untuk tipe menu '${newType}'.`,
          });
      }
    } else {
      newUrl = oldData.url;
    }

    if (title !== undefined) {
      updateFields.push("title = ?");
      updateValues.push(newTitle);
    }
    if (newUrl !== oldData.url) {
      updateFields.push("url = ?");
      updateValues.push(newUrl);
    }
    if (type !== undefined) {
      updateFields.push("type = ?");
      updateValues.push(newType);
    }
    if (reference_id !== undefined) {
      updateFields.push("reference_id = ?");
      updateValues.push(newReferenceId || null);
    }
    if (target !== undefined) {
      updateFields.push("target = ?");
      updateValues.push(target);
    }
    if (order !== undefined) {
      updateFields.push("`order` = ?");
      updateValues.push(order);
    }

    if (updateFields.length === 0) {
      return res
        .status(400)
        .json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE menu_items SET ${updateFields.join(
      ", "
    )} WHERE id = ?`;
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error:
          "Item menu tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({ message: "Item menu berhasil diperbarui." });
  } catch (error) {
    console.error("Error updating menu item:", error);
    res
      .status(500)
      .json({ error: "Gagal memperbarui item menu", details: error.message });
  }
};

exports.getAllMenuItems = async (req, res) => {
  try {
    const { menuId, pageIndex = 1, pageSize = 10, query = "" } = req.query;

    if (!menuId) {
      return res
        .status(400)
        .json({
          error: "Parameter 'menuId' wajib diisi untuk mengambil item menu.",
        });
    }

    const sortKey = req.query["sort[key]"];
    const sortOrder = req.query["sort[order]"];

    const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);

    let whereClause = " WHERE menu_id = ?";
    let queryParams = [menuId];

    if (query) {
      whereClause += " AND title LIKE ?";
      queryParams.push(`%${query}%`);
    }

    let orderByClause = " ORDER BY parent_id ASC, `order` ASC, title ASC"; // Default sort

    if (sortKey && sortOrder) {
      const order = sortOrder === "desc" ? "DESC" : "ASC";
      const allowedSortKeys = [
        "title",
        "type",
        "order",
        "created_at",
        "updated_at",
      ];
      if (allowedSortKeys.includes(sortKey)) {
        let finalSortKey = sortKey;
        if (finalSortKey === "order") {
          finalSortKey = "`order`";
        }
        orderByClause = ` ORDER BY ${finalSortKey} ${order}, title ASC`;
      }
    }

    const [totalResult] = await db.query(
      `SELECT COUNT(id) AS total FROM menu_items${whereClause}`,
      queryParams
    );
    const total = totalResult[0].total;

    const [menuItems] = await db.query(
      `SELECT id, menu_id, parent_id, title, url, type, reference_id, target, \`order\`, created_at, updated_at FROM menu_items${whereClause}${orderByClause} LIMIT ?, ?`,
      [...queryParams, offset, parseInt(pageSize)]
    );

    res.status(200).json({
      data: menuItems,
      total,
      pageIndex: parseInt(pageIndex),
      pageSize: parseInt(pageSize),
    });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({
      error: "Gagal mengambil daftar item menu",
      details: error.message,
    });
  }
};

exports.getMenuItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const [menuItem] = await db.query(
      "SELECT id, menu_id, parent_id, title, url, type, reference_id, target, `order`, created_at, updated_at FROM menu_items WHERE id = ?",
      [id]
    );

    if (menuItem.length === 0) {
      return res.status(404).json({ error: "Item menu tidak ditemukan" });
    }

    res.status(200).json(menuItem[0]);
  } catch (error) {
    console.error("Error fetching menu item by ID:", error);
    res
      .status(500)
      .json({ error: "Gagal mengambil item menu", details: error.message });
  }
};

// Fungsi untuk menghapus item menu
exports.deleteMenuItem = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [itemExists] = await connection.query(
      "SELECT id FROM menu_items WHERE id = ?",
      [id]
    );

    if (itemExists.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "Item menu tidak ditemukan" });
    }

    await connection.query("DELETE FROM menu_items WHERE id = ?", [id]);

    await connection.commit();
    res.status(200).json({ message: "Item menu berhasil dihapus." });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    res
      .status(500)
      .json({ error: "Gagal menghapus item menu", details: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
