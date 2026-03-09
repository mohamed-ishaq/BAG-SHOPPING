const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'yourpassword',
    database: process.env.DB_NAME || 'bag_shop',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testDBConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Call this when server starts
testDBConnection();

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', async (req, res) => {
    try {
        const [result] = await pool.query('SELECT 1 + 1 as test');
        res.json({ 
            status: 'OK', 
            message: 'Bag Shop API is running',
            database: 'Connected',
            test: result[0].test
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            message: 'Database connection failed',
            error: error.message 
        });
    }
});

// ============================================
// REGISTER ENDPOINT
// ============================================
app.post('/api/register', async (req, res) => {
    console.log('📝 Registration attempt received');
    console.log('Request body:', req.body);
    
    try {
        const { username, email, password, full_name, phone } = req.body;
        
        // Validate input
        if (!username || !email || !password || !full_name) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['username', 'email', 'password', 'full_name']
            });
        }
        
        console.log('Checking if user exists...');
        
        // Check if user exists
        const [existing] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existing.length > 0) {
            console.log('❌ User already exists');
            return res.status(400).json({ error: 'User already exists' });
        }

        console.log('Hashing password...');
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        console.log('Inserting user into database...');
        
        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, full_name, phone || null]
        );

        console.log('✅ User inserted with ID:', result.insertId);

        // Generate token
        const token = jwt.sign(
            { id: result.insertId, username, email },
            process.env.JWT_SECRET || 'your-secret-key-change-this',
            { expiresIn: '24h' }
        );

        res.status(201).json({ 
            message: 'User registered successfully',
            token,
            user: {
                id: result.insertId,
                username,
                email,
                full_name
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        console.error('Error stack:', error.stack);
        
        // Send appropriate error message
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        res.status(500).json({ 
            error: 'Server error during registration',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// LOGIN ENDPOINT
// ============================================
app.post('/api/login', async (req, res) => {
    console.log('🔐 Login attempt received');
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key-change-this',
            { expiresIn: '24h' }
        );

        console.log('✅ Login successful for:', email);

        res.json({ 
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ============================================
// PRODUCTS ENDPOINT
// ============================================
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products');
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// TEST ENDPOINT
// ============================================
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// DEBUG - Echo endpoint to see what's being sent
// ============================================
app.post('/api/debug', (req, res) => {
    console.log('Debug endpoint received:', req.body);
    res.json({ 
        received: req.body,
        headers: req.headers,
        method: req.method
    });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    console.log('404 Not Found:', req.method, req.url);
    res.status(404).json({ 
        error: 'Route not found',
        requested: `${req.method} ${req.url}`
    });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Test: http://localhost:${PORT}/api/test`);
    console.log(`📍 Health: http://localhost:${PORT}/api/health`);
    console.log(`📍 Register: POST http://localhost:${PORT}/api/register`);
    console.log(`📍 Login: POST http://localhost:${PORT}/api/login`);
});