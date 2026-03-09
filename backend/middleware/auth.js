const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Use environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * Middleware to authenticate JWT token
 * Verifies the token and attaches user info to request object
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                error: 'Access token required',
                message: 'Please login to access this resource'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user still exists in database
        const [users] = await db.query(
            'SELECT id, username, email, full_name, is_admin FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'User not found',
                message: 'The user associated with this token no longer exists'
            });
        }

        // Attach user info to request
        req.user = users[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ 
                error: 'Invalid token',
                message: 'The provided token is invalid'
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Your session has expired. Please login again'
            });
        } else {
            console.error('Auth middleware error:', error);
            return res.status(500).json({ 
                error: 'Authentication error',
                message: 'An error occurred during authentication'
            });
        }
    }
};

/**
 * Middleware for optional authentication
 * Doesn't return error if no token, just sets req.user = null
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        const [users] = await db.query(
            'SELECT id, username, email, full_name, is_admin FROM users WHERE id = ?',
            [decoded.id]
        );

        req.user = users.length > 0 ? users[0] : null;
        next();
    } catch (error) {
        // If token is invalid, just set user to null
        req.user = null;
        next();
    }
};

/**
 * Middleware to check if user is admin
 * Must be used after authenticateToken
 */
const isAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Please login to access this resource'
            });
        }

        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'Admin privileges required to access this resource'
            });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ 
            error: 'Authorization error',
            message: 'An error occurred while checking admin privileges'
        });
    }
};

/**
 * Middleware to check if user owns the resource or is admin
 * @param {Function} getResourceUserId - Function to get user_id from resource
 */
const isOwnerOrAdmin = (getResourceUserId) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    error: 'Authentication required',
                    message: 'Please login to access this resource'
                });
            }

            // Admin can access any resource
            if (req.user.is_admin) {
                return next();
            }

            // Get the resource owner's user_id
            const resourceUserId = await getResourceUserId(req);
            
            // Check if user owns the resource
            if (req.user.id !== resourceUserId) {
                return res.status(403).json({ 
                    error: 'Access denied',
                    message: 'You do not have permission to access this resource'
                });
            }

            next();
        } catch (error) {
            console.error('Owner check error:', error);
            res.status(500).json({ 
                error: 'Authorization error',
                message: 'An error occurred while checking permissions'
            });
        }
    };
};

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            email: user.email,
            is_admin: user.is_admin || false
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

/**
 * Refresh token middleware
 * Generates new token if current token is about to expire
 */
const refreshTokenIfNeeded = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
        
        // Check if token is about to expire (less than 1 hour remaining)
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = decoded.exp - now;
        
        if (timeRemaining < 3600 && timeRemaining > 0) {
            // Generate new token
            const [users] = await db.query(
                'SELECT id, username, email, is_admin FROM users WHERE id = ?',
                [decoded.id]
            );
            
            if (users.length > 0) {
                const newToken = generateToken(users[0]);
                res.setHeader('X-New-Token', newToken);
            }
        }
        
        next();
    } catch (error) {
        // If token is expired or invalid, just continue
        next();
    }
};

/**
 * Validate token without authentication
 * Just checks if token is valid
 */
const validateToken = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                valid: false,
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user exists
        const [users] = await db.query(
            'SELECT id FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.json({ 
                valid: false,
                error: 'User not found'
            });
        }

        res.json({ 
            valid: true,
            user: {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email
            }
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            res.json({ 
                valid: false,
                error: 'Token expired'
            });
        } else {
            res.json({ 
                valid: false,
                error: 'Invalid token'
            });
        }
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    isAdmin,
    isOwnerOrAdmin,
    generateToken,
    refreshTokenIfNeeded,
    validateToken
};