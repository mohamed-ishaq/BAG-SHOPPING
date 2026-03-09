const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all products with optional filtering
router.get('/', async (req, res) => {
    try {
        const { category, min_price, max_price, search, sort } = req.query;
        
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        // Apply filters
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        if (min_price) {
            query += ' AND price >= ?';
            params.push(min_price);
        }

        if (max_price) {
            query += ' AND price <= ?';
            params.push(max_price);
        }

        if (search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Apply sorting
        if (sort) {
            switch(sort) {
                case 'price_asc':
                    query += ' ORDER BY price ASC';
                    break;
                case 'price_desc':
                    query += ' ORDER BY price DESC';
                    break;
                case 'name_asc':
                    query += ' ORDER BY name ASC';
                    break;
                case 'newest':
                    query += ' ORDER BY created_at DESC';
                    break;
                default:
                    query += ' ORDER BY id DESC';
            }
        } else {
            query += ' ORDER BY id DESC';
        }

        const [products] = await db.query(query, params);
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
    try {
        const [products] = await db.query(
            'SELECT * FROM products WHERE id = ?',
            [req.params.id]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(products[0]);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
    try {
        const [products] = await db.query(
            'SELECT * FROM products WHERE category = ? ORDER BY id DESC',
            [req.params.category]
        );
        res.json(products);
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get featured products
router.get('/featured/limited', async (req, res) => {
    try {
        const [products] = await db.query(
            'SELECT * FROM products ORDER BY RAND() LIMIT 8'
        );
        res.json(products);
    } catch (error) {
        console.error('Error fetching featured products:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get product categories
router.get('/meta/categories', async (req, res) => {
    try {
        const [categories] = await db.query(
            'SELECT DISTINCT category, COUNT(*) as count FROM products GROUP BY category'
        );
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check product availability
router.get('/:id/availability', async (req, res) => {
    try {
        const [products] = await db.query(
            'SELECT stock FROM products WHERE id = ?',
            [req.params.id]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ 
            available: products[0].stock > 0,
            stock: products[0].stock 
        });
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Search products
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        
        const [products] = await db.query(
            `SELECT * FROM products 
             WHERE name LIKE ? OR description LIKE ? 
             ORDER BY 
                CASE 
                    WHEN name LIKE ? THEN 1
                    WHEN description LIKE ? THEN 2
                    ELSE 3
                END`,
            [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
        );
        
        res.json(products);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;