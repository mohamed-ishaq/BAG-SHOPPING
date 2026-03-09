const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Validation rules for order creation
const orderValidation = [
    body('shipping_address').notEmpty().withMessage('Shipping address is required'),
    body('payment_method').isIn(['credit_card', 'debit_card', 'paypal', 'cash_on_delivery'])
        .withMessage('Invalid payment method'),
    body('contact_phone').optional().isMobilePhone().withMessage('Invalid phone number')
];

// Create new order
router.post('/', authenticateToken, orderValidation, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { shipping_address, payment_method, notes, contact_phone } = req.body;

        // Get cart items with product details
        const [cartItems] = await connection.query(
            `SELECT c.product_id, c.quantity, p.price, p.name, p.stock 
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?`,
            [req.user.id]
        );

        if (cartItems.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // Check stock availability
        for (const item of cartItems) {
            if (item.quantity > item.stock) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: `Insufficient stock for ${item.name}. Available: ${item.stock}` 
                });
            }
        }

        // Calculate total
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.1; // 10% tax
        const shipping_cost = subtotal > 100 ? 0 : 10; // Free shipping over $100
        const total = subtotal + tax + shipping_cost;

        // Generate unique order number
        const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        // Create order
        const [orderResult] = await connection.query(
            `INSERT INTO orders 
             (user_id, order_number, subtotal, tax, shipping_cost, total_amount, 
              status, shipping_address, payment_method, notes, contact_phone) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
            [req.user.id, orderNumber, subtotal, tax, shipping_cost, total, 
             shipping_address, payment_method, notes, contact_phone || req.user.phone]
        );

        // Create order items and update stock
        for (const item of cartItems) {
            await connection.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderResult.insertId, item.product_id, item.quantity, item.price]
            );

            // Update product stock
            await connection.query(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        // Clear user's cart
        await connection.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

        await connection.commit();

        res.status(201).json({
            message: 'Order placed successfully',
            order: {
                id: orderResult.insertId,
                order_number: orderNumber,
                total: total,
                status: 'pending'
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Server error while creating order' });
    } finally {
        connection.release();
    }
});

// Get user's orders
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [orders] = await db.query(
            `SELECT o.*, 
                    COUNT(oi.id) as total_items,
                    SUM(oi.quantity) as total_quantity
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.user_id = ?
             GROUP BY o.id
             ORDER BY o.created_at DESC`,
            [req.user.id]
        );

        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single order details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Get order details
        const [orders] = await db.query(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        // Get order items
        const [items] = await db.query(
            `SELECT oi.*, p.name, p.image_url, p.description
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );

        order.items = items;

        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Cancel order (if pending)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Check if order exists and is pending
        const [orders] = await connection.query(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        if (order.status !== 'pending') {
            return res.status(400).json({ 
                error: 'Only pending orders can be cancelled' 
            });
        }

        // Update order status
        await connection.query(
            'UPDATE orders SET status = ? WHERE id = ?',
            ['cancelled', req.params.id]
        );

        // Restore product stock
        const [orderItems] = await connection.query(
            'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
            [req.params.id]
        );

        for (const item of orderItems) {
            await connection.query(
                'UPDATE products SET stock = stock + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        await connection.commit();

        res.json({ message: 'Order cancelled successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling order:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        connection.release();
    }
});

// Track order by order number
router.get('/track/:orderNumber', async (req, res) => {
    try {
        const [orders] = await db.query(
            `SELECT o.*, u.full_name, u.email
             FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.order_number = ?`,
            [req.params.orderNumber]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];
        
        // Get order items
        const [items] = await db.query(
            `SELECT oi.*, p.name, p.image_url
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [order.id]
        );

        order.items = items;

        // Remove sensitive information
        delete order.user_id;

        res.json(order);
    } catch (error) {
        console.error('Error tracking order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get order status
router.get('/:id/status', authenticateToken, async (req, res) => {
    try {
        const [orders] = await db.query(
            'SELECT status, updated_at FROM orders WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ 
            status: orders[0].status,
            last_updated: orders[0].updated_at 
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get order invoice
router.get('/:id/invoice', authenticateToken, async (req, res) => {
    try {
        // Get order with items
        const [orders] = await db.query(
            `SELECT o.*, u.full_name, u.email, u.address as user_address
             FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.id = ? AND o.user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        // Get order items
        const [items] = await db.query(
            `SELECT oi.*, p.name
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );

        order.items = items;

        res.json(order);
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;