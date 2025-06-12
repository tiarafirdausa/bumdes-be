const express = require('express')
const cors = require('cors');
const db = require('./models/db');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
require('dotenv').config();

const authRoute = require('./routes/authRoute');
const menuRoute = require('./routes/menuRoute');
const kategoriRoute = require('./routes/kategoriRoute');
const artikelRoute = require('./routes/artikelRoute');
const halamanRoute = require('./routes/halamanRoute');
const dashboardRoute = require('./routes/dashboardRoute'); 
const komentarRoute = require('./routes/komentarRoute')
const { loginLimiter, registerLimiter } = require('./validation/rateLimiters');
const generateCsrfToken = require('./middleware/csrfMiddleware');


const app = express()
const port = process.env.PORT

app.use(cors({
    origin: process.env.FRONTEND_URL, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], 
}));

// Middleware (Helmet dan Rate Limiting)
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet()); 
app.disable('x-powered-by');

app.use('/public/uploads', express.static('public/uploads'));

app.get('/auth/csrf-token', generateCsrfToken, (req, res) => {
    res.json({ csrfToken: req.csrfToken });
});


app.use('/auth/login', loginLimiter);
app.use('/auth/register', registerLimiter);

app.use('/menu', menuRoute);
app.use('/auth', authRoute);
app.use('/kategori', kategoriRoute);
app.use('/artikel',  artikelRoute);
app.use('/halaman', halamanRoute);
app.use('/dashboard', generateCsrfToken, dashboardRoute);
app.use('/komentar', komentarRoute)

app.use((err, req, res, next) => {
    if (err.message === 'CSRF token tidak valid atau tidak ada.') {
        return res.status(403).json({ error: 'Forbidden: CSRF token tidak valid.' });
    }
    next(err);
});

async function startServer() {
  try {
    await db.query('SELECT 1');
    console.log('Database connected successfully!');

    app.listen(port, () => {
      console.log(`Server berjalan di http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
}

startServer();
