const mysql = require('mysql2/promise');
require('dotenv').config();

// Buat koneksi pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;