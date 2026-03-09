// ============================================
// LUXURY BAGS - MASTER JAVASCRIPT
// Complete Integrated Functionality
// ============================================

const API_URL = 'http://localhost:3000/api';

// ============================================
// GLOBAL STATE
// ============================================
let currentUser = null;
let cart = [];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Luxury Bags initialized');
    checkAuthStatus();
    loadCart();
    createParticles();
    setupNavbarScroll();
    updateCartCount();
});

// ============================================
// AUTHENTICATION
// ============================================
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
        try {
            currentUser = JSON.parse(userData);
            updateUIForLoggedInUser();
        } catch (error) {
            console.error('Error parsing user data:', error);
            logout();
        }
    } else {
        updateUIForLoggedOutUser();
    }
}

function updateUIForLoggedInUser() {
    const loginLinks = document.querySelectorAll('.login-link');
    const logoutLinks = document.querySelectorAll('.logout-link');
    const profileLinks = document.querySelectorAll('.profile-link');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const authLinks = document.querySelector('.auth-links');
    
    loginLinks.forEach(link => link.style.display = 'none');
    logoutLinks.forEach(link => link.style.display = 'inline-block');
    profileLinks.forEach(link => link.style.display = 'inline-block');
    
    if (welcomeMessage) {
        welcomeMessage.innerHTML = `<i class="fas fa-crown"></i> Welcome back, ${currentUser?.full_name || currentUser?.username || 'Valued Customer'}!`;
    }
    
    if (authLinks) {
        authLinks.innerHTML = `
            <a href="dashboard.html" class="profile-link"><i class="fas fa-user"></i> Dashboard</a>
            <a href="#" onclick="logout()" class="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</a>
        `;
    }
}

function updateUIForLoggedOutUser() {
    const loginLinks = document.querySelectorAll('.login-link');
    const logoutLinks = document.querySelectorAll('.logout-link');
    const profileLinks = document.querySelectorAll('.profile-link');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const authLinks = document.querySelector('.auth-links');
    
    loginLinks.forEach(link => link.style.display = 'inline-block');
    logoutLinks.forEach(link => link.style.display = 'none');
    profileLinks.forEach(link => link.style.display = 'none');
    
    if (welcomeMessage) {
        welcomeMessage.innerHTML = '<i class="fas fa-crown"></i> Welcome to Luxury Bags';
    }
    
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
        
        const response = await fetch(`${API_URL}/auth/login`, {
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

        showNotification('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectUrl;
        }, 1500);

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function register(userData) {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_URL}/auth/register`, {
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

        showNotification('Registration successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    currentUser = null;
    cart = [];
    
    updateUIForLoggedOutUser();
    updateCartCount();
    
    showNotification('Logged out successfully', 'success');
    
    const protectedPages = ['cart.html', 'checkout.html', 'dashboard.html', 'profile.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }
}

function isAuthenticated() {
    return !!localStorage.getItem('token');
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
// CART MANAGEMENT
// ============================================
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
        } catch (error) {
            console.error('Error parsing cart:', error);
            cart = [];
        }
    }
    updateCartCount();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

function addToCart(product, quantity = 1) {
    if (!isAuthenticated()) {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        showNotification('Please login to add items to cart', 'warning');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: quantity,
            stock: product.stock || 10
        });
    }
    
    saveCart();
    showNotification(`${product.name} added to cart!`, 'success');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    showNotification('Item removed from cart', 'success');
}

function updateCartQuantity(productId, newQuantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = newQuantity;
            saveCart();
        }
    }
}

function clearCart() {
    cart = [];
    saveCart();
    showNotification('Cart cleared', 'success');
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartCount() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartCount() {
    const count = getCartCount();
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
    });
}

// ============================================
// UI UTILITIES
// ============================================
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    particlesContainer.innerHTML = '';
    
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

function setupNavbarScroll() {
    window.addEventListener('scroll', function() {
        const navbar = document.getElementById('navbar');
        if (navbar && window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else if (navbar) {
            navbar.classList.remove('scrolled');
        }
    });
}

function showLoading(show = true) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function formatPrice(price) {
    return '$' + parseFloat(price).toFixed(2);
}

// ============================================
// PRODUCT FUNCTIONS
// ============================================
async function loadProducts(filters = {}) {
    try {
        showLoading(true);
        
        let url = `${API_URL}/products?`;
        const params = new URLSearchParams(filters);
        url += params.toString();
        
        const response = await fetch(url);
        const products = await response.json();
        
        return products;
    } catch (error) {
        console.error('Error loading products:', error);
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
// WISHLIST FUNCTIONS
// ============================================
function getWishlist() {
    return JSON.parse(localStorage.getItem('wishlist') || '[]');
}

function addToWishlist(product) {
    let wishlist = getWishlist();
    
    if (!wishlist.some(item => item.id === product.id)) {
        wishlist.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image
        });
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
        showNotification('Added to wishlist!', 'success');
        return true;
    } else {
        showNotification('Already in wishlist', 'info');
        return false;
    }
}

function removeFromWishlist(productId) {
    let wishlist = getWishlist();
    wishlist = wishlist.filter(item => item.id !== productId);
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    showNotification('Removed from wishlist', 'success');
}

// ============================================
// EXPORT GLOBAL FUNCTIONS
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
    getCart: () => cart,
    getCartTotal,
    getCartCount
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
// Add to utils object in main.js
const utils = {
    // ... existing utils functions ...
    
    viewProduct: function(productId) {
        window.location.href = `product-detail.html?id=${productId}`;
    },
    
    // ... rest of utils functions ...
};