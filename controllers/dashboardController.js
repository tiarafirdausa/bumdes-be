// controllers/dashboardController.js
const db = require("../models/db");

// Fungsi helper untuk menjalankan kueri dengan penanganan kesalahan
const executeQuery = async (connection, query) => {
    try {
        const [rows] = await connection.query(query);
        return rows;
    } catch (error) {
        throw new Error(`Database query failed: ${error.message}`);
    }
};

exports.getDashboardSummary = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();

        const [
            totalPostsResult,
            totalPagesResult,
            totalUsersResult,
            totalCommentsResult,
            pendingCommentsResult,
            recentPosts,
            recentComments,
            recentUsers,
            topPosts,
        ] = await Promise.all([
            executeQuery(connection, 'SELECT COUNT(*) AS count FROM posts'),
            executeQuery(connection, 'SELECT COUNT(*) AS count FROM pages'),
            executeQuery(connection, 'SELECT COUNT(*) AS count FROM users'),
            executeQuery(connection, 'SELECT COUNT(*) AS count FROM comments'),
            executeQuery(connection, "SELECT COUNT(*) AS count FROM comments WHERE status = 'pending'"),
            executeQuery(connection, `
                SELECT 
                    p.id, 
                    p.title, 
                    p.created_at, 
                    p.status, 
                    p.hits,
                    p.slug,
                    u.name AS author_name 
                FROM posts p
                LEFT JOIN users u ON p.author_id = u.id
                ORDER BY p.created_at DESC 
                LIMIT 5
            `),
            executeQuery(connection, `
                SELECT c.id, c.content, c.created_at, c.post_id, c.author_name, p.title AS postTitle
                FROM comments c
                LEFT JOIN posts p ON c.post_id = p.id
                ORDER BY c.created_at DESC
                LIMIT 3
            `),
            executeQuery(connection, 'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5'),
            executeQuery(connection, `
                SELECT 
                    p.id, 
                    p.title, 
                    p.featured_image, 
                    p.hits,
                    u.name AS author_name
                FROM posts p
                LEFT JOIN users u ON p.author_id = u.id
                ORDER BY p.hits DESC 
                LIMIT 3
            `),
        ]);

        const summaryData = {
            totalPosts: totalPostsResult[0].count,
            totalPages: totalPagesResult[0].count,
            totalUsers: totalUsersResult[0].count,
            totalComments: totalCommentsResult[0].count,
            pendingComments: pendingCommentsResult[0].count,
            recentPosts: recentPosts,
            recentComments: recentComments,
            recentUsers: recentUsers,
            topPosts: topPosts,
        };

        res.status(200).json(summaryData);

    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.getAnalyticsData = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();

        const [
            totalViewsResult,
            dailyViews,
            dailyUsers,
        ] = await Promise.all([
            executeQuery(connection, `
                SELECT IFNULL(SUM(hits), 0) AS total_views FROM posts;
            `),
            executeQuery(connection, `
                SELECT DATE(created_at) AS period, COUNT(*) AS posts
                FROM posts
                WHERE created_at >= CURDATE() - INTERVAL 30 DAY
                GROUP BY period
                ORDER BY period ASC;
            `),
            executeQuery(connection, `
                SELECT DATE(created_at) AS period, COUNT(*) AS users
                FROM users
                WHERE created_at >= CURDATE() - INTERVAL 30 DAY
                GROUP BY period
                ORDER BY period ASC;
            `),
        ]);

        res.status(200).json({
            totalViews: totalViewsResult[0].total_views,
            dailyViews: dailyViews,
            dailyUsers: dailyUsers,
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};