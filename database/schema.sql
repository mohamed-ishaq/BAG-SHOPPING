CREATE DATABASE IF NOT EXISTS bag_shop;
USE bag_shop;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50),
    image_url VARCHAR(500),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shopping cart table
CREATE TABLE cart (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    product_id INT,
    quantity INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Orders table
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    order_number VARCHAR(50) UNIQUE,
    total_amount DECIMAL(10,2),
    status ENUM('pending', 'processing', 'shipped', 'delivered') DEFAULT 'pending',
    shipping_address TEXT,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Order items table
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT,
    product_id INT,
    quantity INT,
    price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Insert sample products
INSERT INTO products (name, description, price, category, image_url, stock) VALUES
('Classic Leather Bag', 'Premium genuine leather bag perfect for daily use', 129.99, 'Leather', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500', 50),
('Travel Backpack', 'Spacious backpack with laptop compartment', 79.99, 'Backpack', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', 100),
('Elegant Handbag', 'Stylish handbag for special occasions', 89.99, 'Handbag', 'https://images.unsplash.com/photo-1584917865448-de89fe76cc2b?w=500', 30),
('Sports Duffel Bag', 'Durable duffel bag for gym and travel', 49.99, 'Sports', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', 75),
('Laptop Messenger Bag', 'Professional messenger bag with padding', 69.99, 'Business', 'https://images.unsplash.com/photo-1622560480605-d6c0c85758d7?w=500', 45);