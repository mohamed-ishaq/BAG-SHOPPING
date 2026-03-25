// ============================================
// LUXURY BAGS - MASTER JAVASCRIPT
// ============================================

const API_URL = 'http://localhost:3000/api';

let currentUser = null;
let cart = [];
const APP_FALLBACK_PRODUCT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'%3E%3Crect width='900' height='900' fill='%231f2937'/%3E%3Crect x='225' y='300' width='450' height='360' rx='36' fill='%23c7a261'/%3E%3Cpath d='M330 300c0-80 50-130 120-130s120 50 120 130h-55c0-47-24-76-65-76s-65 29-65 76h-55z' fill='%23f8f1de'/%3E%3Ctext x='450' y='740' text-anchor='middle' fill='%23f8f1de' font-size='48' font-family='Arial,sans-serif'%3ELuxury%20Bag%3C/text%3E%3C/svg%3E";

function safeParseJSON(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function getStoredUser() {
    return safeParseJSON(localStorage.getItem('user'), null);
}

function getUserIdentifier(user = currentUser) {
    if (!user) return null;
    return user.id || user.email || user.username || null;
}

function getScopedKey(baseKey, user = currentUser) {
    const identifier = getUserIdentifier(user);
    return identifier ? `${baseKey}_${identifier}` : baseKey;
}

function readArrayByKey(key) {
    return safeParseJSON(localStorage.getItem(key), []) || [];
}

function writeArrayByKey(key, value) {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
}

function migrateLegacyArray(baseKey, user = currentUser) {
    const scopedKey = getScopedKey(baseKey, user);
    if (scopedKey === baseKey) return;
    if (localStorage.getItem(scopedKey)) return;

    const legacyValue = localStorage.getItem(baseKey);
    if (legacyValue) {
        localStorage.setItem(scopedKey, legacyValue);
        localStorage.removeItem(baseKey);
    }
}

function migrateUserData(user = currentUser) {
    if (!user) return;
    ['cart', 'wishlist', 'orders'].forEach((key) => migrateLegacyArray(key, user));
}

function getUserCartKey() {
    return getScopedKey('cart');
}

function getUserWishlistKey() {
    return getScopedKey('wishlist');
}

function getUserOrdersKey() {
    return getScopedKey('orders');
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    createParticles();
    setupNavbarScroll();
    updateCartCount();
});

// ============================================
// AUTHENTICATION
// ============================================
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const userData = getStoredUser();

    if (token && userData) {
        currentUser = userData;
        migrateUserData(currentUser);
        loadCart();
        updateUIForLoggedInUser();
    } else {
        currentUser = null;
        cart = [];
        updateUIForLoggedOutUser();
    }
}

function updateUIForLoggedInUser() {
    document.querySelectorAll('.login-link').forEach((link) => {
        link.style.display = 'none';
    });
    document.querySelectorAll('.logout-link').forEach((link) => {
        link.style.display = 'inline-block';
    });
    document.querySelectorAll('.profile-link').forEach((link) => {
        link.style.display = 'inline-block';
    });

    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.innerHTML = `<i class="fas fa-crown"></i> Welcome back, ${currentUser?.full_name || currentUser?.username || 'Valued Customer'}!`;
    }

    const authLinks = document.querySelector('.auth-links');
    if (authLinks) {
        authLinks.innerHTML = `
            <a href="dashboard.html" class="profile-link"><i class="fas fa-user"></i> Dashboard</a>
            <a href="#" onclick="logout()" class="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</a>
        `;
    }
}

function updateUIForLoggedOutUser() {
    document.querySelectorAll('.login-link').forEach((link) => {
        link.style.display = 'inline-block';
    });
    document.querySelectorAll('.logout-link').forEach((link) => {
        link.style.display = 'none';
    });
    document.querySelectorAll('.profile-link').forEach((link) => {
        link.style.display = 'none';
    });

    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.innerHTML = '<i class="fas fa-crown"></i> Welcome to Luxury Bags';
    }

    const authLinks = document.querySelector('.auth-links');
    if (authLinks) {
        authLinks.innerHTML = `
            <a href="login.html" class="login-link"><i class="fas fa-sign-in-alt"></i> Sign In</a>
            <a href="login.html?tab=register" class="register-link"><i class="fas fa-user-plus"></i> Register</a>
        `;
    }
}

async function login(email, password) {
    try {
        showLoading(true);
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        migrateUserData(currentUser);
        loadCart();
        updateUIForLoggedInUser();
        showNotification('Login successful! Redirecting...', 'success');

        setTimeout(() => {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectUrl;
        }, 1200);
    } catch (error) {
        showNotification(error.message || 'Login failed', 'error');
    } finally {
        showLoading(false);
    }
}

async function register(userData) {
    try {
        showLoading(true);
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        migrateUserData(currentUser);
        loadCart();
        updateUIForLoggedInUser();
        showNotification('Registration successful! Redirecting...', 'success');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1200);
    } catch (error) {
        showNotification(error.message || 'Registration failed', 'error');
    } finally {
        showLoading(false);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    cart = [];

    updateUIForLoggedOutUser();
    updateCartCount();
    showNotification('Logged out successfully', 'success');

    const protectedPages = ['cart.html', 'checkout.html', 'dashboard.html', 'orders.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (protectedPages.includes(currentPage)) {
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 900);
    }
}

function isAuthenticated() {
    return Boolean(localStorage.getItem('token') && getStoredUser());
}

function requireAuth() {
    if (!isAuthenticated()) {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ============================================
// CART
// ============================================
function loadCart() {
    if (!currentUser) {
        cart = [];
        updateCartCount();
        return;
    }
    cart = readArrayByKey(getUserCartKey());
    updateCartCount();
}

function saveCart() {
    if (!currentUser) return;
    writeArrayByKey(getUserCartKey(), cart);
    updateCartCount();
}

function addToCart(product, quantity = 1) {
    if (!requireAuth()) return;

    const normalizedQuantity = Number(quantity) > 0 ? Number(quantity) : 1;
    const selectedColor = product.color || 'Default';
    const existingItem = cart.find(
        (item) => item.id === product.id && (item.color || 'Default') === selectedColor
    );

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + normalizedQuantity;
    } else {
        cart.push({
            ...product,
            image: product.image || product.image_url || APP_FALLBACK_PRODUCT_IMAGE,
            quantity: normalizedQuantity,
            color: selectedColor
        });
    }

    saveCart();
    showNotification(`${product.name} added to cart!`, 'success');
}

function removeFromCart(productId, color = null) {
    cart = cart.filter((item) => {
        if (item.id !== productId) return true;
        if (color === null) return false;
        return (item.color || 'Default') !== color;
    });
    saveCart();
    showNotification('Item removed from cart', 'success');
}

function updateCartQuantity(productId, newQuantity, color = null) {
    const qty = Number(newQuantity);
    const item = cart.find(
        (entry) => entry.id === productId && (color === null || (entry.color || 'Default') === color)
    );
    if (!item) return;
    if (qty <= 0) {
        removeFromCart(productId, color);
        return;
    }
    item.quantity = qty;
    saveCart();
}

function clearCart() {
    cart = [];
    saveCart();
    showNotification('Cart cleared', 'success');
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
}

function getCartCount() {
    return cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
}

function updateCartCount() {
    const count = getCartCount();
    document.querySelectorAll('.cart-count').forEach((el) => {
        el.textContent = String(count);
    });
}

// ============================================
// WISHLIST + ORDERS STORAGE
// ============================================
function getWishlist() {
    return readArrayByKey(getUserWishlistKey());
}

function setWishlist(items) {
    writeArrayByKey(getUserWishlistKey(), items);
}

function addToWishlist(product) {
    if (!requireAuth()) return false;
    const wishlist = getWishlist();
    if (wishlist.some((item) => item.id === product.id)) {
        showNotification('Already in wishlist', 'info');
        return false;
    }
    wishlist.push({
        ...product,
        image: product.image || product.image_url || APP_FALLBACK_PRODUCT_IMAGE
    });
    setWishlist(wishlist);
    showNotification('Added to wishlist!', 'success');
    return true;
}

function removeFromWishlist(productId) {
    if (!requireAuth()) return;
    const wishlist = getWishlist().filter((item) => item.id !== productId);
    setWishlist(wishlist);
    showNotification('Removed from wishlist', 'success');
}

function getOrders() {
    return readArrayByKey(getUserOrdersKey());
}

function setOrders(orders) {
    writeArrayByKey(getUserOrdersKey(), orders);
}

function appendOrder(order) {
    const orders = getOrders();
    orders.push(order);
    setOrders(orders);
}

// ============================================
// UI UTILITIES
// ============================================
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    particlesContainer.innerHTML = '';
    for (let i = 0; i < 30; i += 1) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;
        particlesContainer.appendChild(particle);
    }
}

function setupNavbarScroll() {
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

function showLoading(show = true) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = show ? 'block' : 'none';
}

function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    notification.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
    notification.style.cssText = 'position: fixed; top: 100px; right: 20px; z-index: 9999; min-width: 300px;';
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, duration);
}

function formatPrice(price) {
    return `₹${Number(price || 0).toFixed(2)}`;
}

async function loadProducts(filters = {}) {
    try {
        showLoading(true);
        const params = new URLSearchParams(filters);
        const response = await fetch(`${API_URL}/products?${params.toString()}`);
        const data = await response.json();
        if (!Array.isArray(data)) return data;
        return data.filter((product) => {
            const image = product?.image || product?.image_url;
            return typeof image === 'string' && image.trim() !== '';
        });
    } catch (error) {
        showNotification('Failed to load products', 'error');
        return [];
    } finally {
        showLoading(false);
    }
}

function viewProduct(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
}

// ============================================
// EXPORTS
// ============================================
window.auth = {
    login,
    register,
    logout,
    isAuthenticated,
    requireAuth,
    getCurrentUser: () => currentUser
};

window.cart = {
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    getCart: () => [...cart],
    getCartTotal,
    getCartCount,
    loadCart
};

window.utils = {
    showNotification,
    showLoading,
    formatPrice,
    viewProduct,
    addToWishlist,
    removeFromWishlist,
    getWishlist
};

window.appStorage = {
    getUserIdentifier: () => getUserIdentifier(),
    getScopedKey,
    getUserCartKey,
    getUserWishlistKey,
    getUserOrdersKey,
    getOrders,
    setOrders,
    appendOrder,
    migrateUserData
};


