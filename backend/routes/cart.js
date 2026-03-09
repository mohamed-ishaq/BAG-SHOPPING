const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get user's cart
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [cartItems] = await db.query(
            `SELECT c.id as cart_id, c.quantity, c.created_at,
                    p.id as product_id, p.name, p.price, p.image_url, p.stock,
                    p.description, p.category
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );

        // Calculate total
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        res.json({
            items: cartItems,
            total: total,
            item_count: cartItems.length
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add item to cart
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { product_id, quantity = 1 } = req.body;

        // Validate quantity
        if (quantity < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }

        // Check if product exists and has stock
        const [products] = await db.query(
            'SELECT id, name, price, stock FROM products WHERE id = ?',
            [product_id]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = products[0];

        // Check if item already in cart
        const [existingItems] = await db.query(
            'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
            [req.user.id, product_id]
        );

        if (existingItems.length > 0) {
            const newQuantity = existingItems[0].quantity + quantity;
            
            // Check stock
            if (newQuantity > product.stock) {
                return res.status(400).json({ 
                    error: `Only ${product.stock} items available in stock` 
                });
            }

            await db.query(
                'UPDATE cart SET quantity = ? WHERE id = ?',
                [newQuantity, existingItems[0].id]
            );
        } else {
            // Check stock
            if (quantity > product.stock) {
                return res.status(400).json({ 
                    error: `Only ${product.stock} items available in stock` 
                });
            }

            await db.query(
                'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
                [req.user.id, product_id, quantity]
            );
        }

        // Get updated cart
        const [cartItems] = await db.query(
            `SELECT COUNT(*) as count, SUM(quantity) as total_items 
             FROM cart WHERE user_id = ?`,
            [req.user.id]
        );

        res.json({ 
            message: 'Item added to cart successfully',
            cart_summary: cartItems[0]
        });

    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update cart item quantity
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        const cartItemId = req.params.id;

        if (quantity < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }

        // Get cart item with product stock
        const [cartItems] = await db.query(
            `SELECT c.*, p.stock, p.name 
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.id = ? AND c.user_id = ?`,
            [cartItemId, req.user.id]
        );

        if (cartItems.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        const cartItem = cartItems[0];

        // Check stock
        if (quantity > cartItem.stock) {
            return res.status(400).json({ 
                error: `Only ${cartItem.stock} items available in stock` 
            });
        }

        await db.query(
            'UPDATE cart SET quantity = ? WHERE id = ?',
            [quantity, cartItemId]
        );

        res.json({ message: 'Cart updated successfully' });

    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove item from cart
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const [result] = await db.query(
            'DELETE FROM cart WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        res.json({ message: 'Item removed from cart successfully' });

    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear entire cart
router.delete('/', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM cart WHERE user_id = ?',
            [req.user.id]
        );

        res.json({ message: 'Cart cleared successfully' });

    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get cart summary
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const [summary] = await db.query(
            `SELECT 
                COUNT(*) as item_count,
                COALESCE(SUM(quantity), 0) as total_items,
                COALESCE(SUM(p.price * c.quantity), 0) as total_amount
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?`,
            [req.user.id]
        );

        res.json(summary[0]);

    } catch (error) {
        console.error('Error getting cart summary:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Validate cart items (check stock)
router.get('/validate', authenticateToken, async (req, res) => {
    try {
        const [cartItems] = await db.query(
            `SELECT c.id, c.quantity, p.stock, p.name 
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?`,
            [req.user.id]
        );

        const invalidItems = cartItems.filter(item => item.quantity > item.stock);

        if (invalidItems.length > 0) {
            return res.json({
                valid: false,
                invalid_items: invalidItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    requested: item.quantity,
                    available: item.stock
                }))
            });
        }

        res.json({ valid: true });

    } catch (error) {
        console.error('Error validating cart:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;