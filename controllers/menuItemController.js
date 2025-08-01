// controllers/menuItemController.js
const db = require("../models/db");

const getReferenceSlugOrTitle = async (type, referenceId) => {
  if (!referenceId) return null;

  let query = '';
  let idColumn = '';
  let slugColumn = '';
  let titleColumn = '';

  switch (type) {
    case 'post':
      query = "SELECT slug, title FROM posts WHERE id = ?";
      idColumn = 'id';
      slugColumn = 'slug';
      titleColumn = 'title';
      break;
    case 'category':
      query = "SELECT slug, name AS title FROM categories WHERE id = ?";
      idColumn = 'id';
      slugColumn = 'slug';
      titleColumn = 'name';
      break;
    case 'page':
      query = "SELECT slug, title FROM pages WHERE id = ?";
      idColumn = 'id';
      slugColumn = 'slug';
      titleColumn = 'title';
      break;
    default:
      return null;
  }

  try {
    const [rows] = await db.query(query, [referenceId]);
    if (rows.length > 0) {
      return {
        slug: rows[0][slugColumn],
        title: rows[0][titleColumn]
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching reference for type ${type}, id ${referenceId}:`, error);
    return null;
  }
};


exports.createMenuItem = async (req, res) => {
  try {
    const { menu_id, parent_id, title, url, type, reference_id, target, order } = req.body;

    if (!menu_id || !title) {
      return res.status(400).json({ error: "ID Menu dan Judul item menu wajib diisi." });
    }

    const [menuExists] = await db.query("SELECT id FROM menus WHERE id = ?", [menu_id]);
    if (menuExists.length === 0) {
      return res.status(404).json({ error: "ID Menu tidak ditemukan." });
    }

    if (parent_id) {
      const [parentExists] = await db.query("SELECT id FROM menu_items WHERE id = ? AND menu_id = ?", [parent_id, menu_id]);
      if (parentExists.length === 0) {
        return res.status(404).json({ error: "ID Parent item menu tidak ditemukan atau bukan bagian dari menu ini." });
      }
    }

    let finalUrl = url;
    let finalTitle = title;

    if (type !== 'custom' && reference_id) {
      const refData = await getReferenceSlugOrTitle(type, reference_id);
      if (refData) {
        finalUrl = `/${type}s/${refData.slug}`; 
        finalTitle = refData.title;
      } else {
        return res.status(400).json({ error: `Referensi ${type} dengan ID ${reference_id} tidak ditemukan.` });
      }
    } else if (type === 'custom' && !url) {
        return res.status(400).json({ error: "URL wajib diisi untuk tipe menu 'custom'." });
    }

    const [result] = await db.query(
      "INSERT INTO menu_items (menu_id, parent_id, title, url, type, reference_id, target, `order`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        menu_id,
        parent_id || null,
        finalTitle, 
        finalUrl || null, 
        type || 'custom',
        reference_id || null,
        target || '_self',
        order !== undefined ? order : 0,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      menu_id,
      parent_id: parent_id || null,
      title: finalTitle,
      url: finalUrl || null,
      type: type || 'custom',
      reference_id: reference_id || null,
      target: target || '_self',
      order: order !== undefined ? order : 0,
      message: "Item menu berhasil ditambahkan.",
    });
  } catch (error) {
    console.error("Error creating menu item:", error);
    res.status(500).json({ error: "Gagal membuat item menu", details: error.message });
  }
};

exports.getAllMenuItems = async (req, res) => {
    try {
        const {
            menuId,
            pageIndex = 1,
            pageSize = 10,
            query = '',
            sort = {},
        } = req.query;

        if (!menuId) {
            return res.status(400).json({ error: "Parameter 'menuId' wajib diisi untuk mengambil item menu." });
        }

        const offset = (parseInt(pageIndex) - 1) * parseInt(pageSize);

        let whereClause = ' WHERE menu_id = ?'; 
        let queryParams = [menuId];

        if (query) {
            whereClause += ' AND title LIKE ?';
            queryParams.push(`%${query}%`);
        }

        let orderByClause = ' ORDER BY parent_id ASC, `order` ASC, title ASC'; // Default sort

        if (sort.order && sort.key) {
            const sortOrder = sort.order === 'desc' ? 'DESC' : 'ASC';
            const allowedSortKeys = ['title', 'type', 'order', 'created_at', 'updated_at'];
            if (allowedSortKeys.includes(sort.key)) {
                // Jika ingin sort berdasarkan key lain, tambahkan di awal atau di akhir default sort
                // Contoh: `ORDER BY ${sort.key} ${sortOrder}, parent_id ASC, \`order\` ASC`
                // Atau: `ORDER BY parent_id ASC, \`order\` ASC, ${sort.key} ${sortOrder}`
                orderByClause = ` ORDER BY ${sort.key} ${sortOrder}, parent_id ASC, \`order\` ASC`;
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
    res.status(500).json({ error: "Gagal mengambil item menu", details: error.message });
  }
};

// Fungsi untuk memperbarui item menu
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { menu_id, parent_id, title, url, type, reference_id, target, order } = req.body;

    let updateFields = [];
    let updateValues = [];

    // Validasi menu_id jika disediakan
    if (menu_id !== undefined) {
      const [menuExists] = await db.query("SELECT id FROM menus WHERE id = ?", [menu_id]);
      if (menuExists.length === 0) {
        return res.status(404).json({ error: "ID Menu tidak ditemukan." });
      }
      updateFields.push("menu_id = ?");
      updateValues.push(menu_id);
    }

    // Validasi parent_id jika disediakan (bisa null)
    if (parent_id !== undefined) {
      if (parent_id !== null) { // Jika parent_id bukan null, cek keberadaannya
        const [parentExists] = await db.query("SELECT id FROM menu_items WHERE id = ? AND id != ?", [parent_id, id]);
        if (parentExists.length === 0) {
          return res.status(404).json({ error: "ID Parent item menu tidak ditemukan." });
        }
      }
      updateFields.push("parent_id = ?");
      updateValues.push(parent_id || null);
    }

    // Tentukan URL dan Title berdasarkan tipe jika type atau reference_id diupdate
    let finalUrl = url;
    let finalTitle = title;
    let currentType = type; // Gunakan type dari body jika ada, atau ambil dari DB jika tidak

    // Jika type atau reference_id diupdate, atau jika title/url diupdate dan type adalah reference-based
    if (type !== undefined || reference_id !== undefined) {
        if (type === undefined) { // Jika type tidak diupdate, ambil type yang ada dari DB
            const [currentItem] = await db.query("SELECT type FROM menu_items WHERE id = ?", [id]);
            if (currentItem.length === 0) return res.status(404).json({ error: "Item menu tidak ditemukan." });
            currentType = currentItem[0].type;
        }

        if (currentType !== 'custom' && (reference_id !== undefined || title === undefined)) {
            const refIdToUse = reference_id !== undefined ? reference_id : await db.query("SELECT reference_id FROM menu_items WHERE id = ?", [id]).then(r => r[0][0]?.reference_id);
            if (refIdToUse) {
                const refData = await getReferenceSlugOrTitle(currentType, refIdToUse);
                if (refData) {
                    finalUrl = `/${currentType}s/${refData.slug}`;
                    finalTitle = refData.title;
                } else {
                    return res.status(400).json({ error: `Referensi ${currentType} dengan ID ${refIdToUse} tidak ditemukan.` });
                }
            } else if (currentType !== 'custom' && !refIdToUse) {
                // Jika type adalah reference-based tapi reference_id menjadi null
                finalUrl = null;
                finalTitle = title; // Gunakan title dari body jika ada, atau biarkan null
            }
        } else if (currentType === 'custom' && url === undefined) {
            // Jika type diubah ke custom, tapi URL tidak disediakan, ambil URL yang ada dari DB
            const [currentItem] = await db.query("SELECT url FROM menu_items WHERE id = ?", [id]);
            finalUrl = currentItem[0]?.url;
        }
    }

    if (finalTitle !== undefined) {
      updateFields.push("title = ?");
      updateValues.push(finalTitle);
    }
    if (finalUrl !== undefined) {
      updateFields.push("url = ?");
      updateValues.push(finalUrl);
    }
    if (type !== undefined) {
      updateFields.push("type = ?");
      updateValues.push(type);
    }
    if (reference_id !== undefined) {
      updateFields.push("reference_id = ?");
      updateValues.push(reference_id || null);
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
      return res.status(400).json({ error: "Tidak ada data yang disediakan untuk diperbarui." });
    }

    const query = `UPDATE menu_items SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Item menu tidak ditemukan atau tidak ada perubahan yang dilakukan.",
      });
    }

    res.status(200).json({ message: "Item menu berhasil diperbarui." });
  } catch (error) {
    console.error("Error updating menu item:", error);
    res.status(500).json({ error: "Gagal memperbarui item menu", details: error.message });
  }
};

// Fungsi untuk menghapus item menu
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Periksa apakah ada sub-item yang merujuk ke item ini sebagai parent
    const [childItems] = await db.query("SELECT id FROM menu_items WHERE parent_id = ?", [id]);
    if (childItems.length > 0) {
        // Jika ada, set parent_id mereka menjadi NULL
        await db.query("UPDATE menu_items SET parent_id = NULL WHERE parent_id = ?", [id]);
    }

    const [result] = await db.query("DELETE FROM menu_items WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item menu tidak ditemukan" });
    }

    res.status(200).json({ message: "Item menu berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    res.status(500).json({ error: "Gagal menghapus item menu", details: error.message });
  }
};