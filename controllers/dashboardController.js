// controllers/dashboardController.js
const db = require("../models/db");

exports.getDashboardSummary = async (req, res) => {
    let connection; 
    try {
        connection = await db.getConnection();

        const [totalPostsResult] = await connection.query('SELECT COUNT(*) AS count FROM posts');
        const totalPosts = totalPostsResult[0].count;

        const [totalPagesResult] = await connection.query('SELECT COUNT(*) AS count FROM pages');
        const totalPages = totalPagesResult[0].count;

        const [totalUsersResult] = await connection.query('SELECT COUNT(*) AS count FROM users');
        const totalUsers = totalUsersResult[0].count;

        const [totalCommentsResult] = await connection.query('SELECT COUNT(*) AS count FROM comments');
        const totalComments = totalCommentsResult[0].count;

        const [pendingCommentsResult] = await connection.query("SELECT COUNT(*) AS count FROM comments WHERE status = 'pending'");
        const pendingComments = pendingCommentsResult[0].count;

        const [recentPosts] = await connection.query('SELECT id, title, created_at FROM posts ORDER BY created_at DESC LIMIT 5');

        const [recentComments] = await connection.query(
            `SELECT c.id, c.content, c.created_at, c.post_id, c.author_name, p.title AS postTitle
             FROM comments c
             LEFT JOIN posts p ON c.post_id = p.id
             ORDER BY c.created_at DESC LIMIT 5`
        );

        const [recentUsers] = await connection.query('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5');

        res.status(200).json({
            totalPosts,
            totalPages,
            totalUsers,
            totalComments,
            pendingComments,
            recentPosts,
            recentComments,
            recentUsers
        });

    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    } finally {
        if (connection) connection.release(); // Pastikan koneksi dikembalikan ke pool
    }
};

exports.getAnalyticsData = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();

        // Contoh: Data kunjungan bulanan (ini sangat bergantung pada bagaimana Anda melacak kunjungan)
        // Ini adalah contoh placeholder. Implementasi nyata akan jauh lebih kompleks.
        const monthlyVisits = [
            { month: 'Jan', visits: 1200 },
            { month: 'Feb', visits: 1500 },
            { month: 'Mar', visits: 1300 },
            { month: 'Apr', visits: 1800 },
            { month: 'May', visits: 2000 },
            { month: 'Jun', visits: 1700 },
            // Anda perlu query database Anda di sini untuk data nyata.
            // Contoh query:
            // const [visits] = await connection.query(`
            //     SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS visits
            //     FROM page_views
            //     WHERE created_at >= CURDATE() - INTERVAL 6 MONTH
            //     GROUP BY month
            //     ORDER BY month;
            // `);
            // res.status(200).json(visits);
        ];

        res.status(200).json(monthlyVisits);

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};