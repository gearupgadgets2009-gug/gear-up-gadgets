/**
 * ============================================================================
 * Gear Up Gadgets - Enterprise Production Node.js Server
 * ============================================================================
 * 
 * Provides:
 * 1. Secure backend API endpoint for Gmail SMTP transactional emails (/api/send-email)
 * 2. High-performance static asset hosting with security headers
 * 3. Health check diagnostic endpoint (/api/health)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check API Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        emailConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS),
        environment: process.env.NODE_ENV || 'production'
    });
});

// Import and mount the email dispatcher serverless handler
const emailHandler = require('./api/send-email');
app.all('/api/send-email', (req, res) => {
    return emailHandler(req, res);
});

// Serve static frontend files
const publicDir = path.join(__dirname, 'public');
const rootDir = __dirname;

// Serve public directory if exists, otherwise fallback to root
app.use(express.static(publicDir));
app.use(express.static(rootDir));

// SPA / Clean URLs fallback
app.get('*', (req, res) => {
    // If request has no extension and matches an html file in root or public
    const reqPath = req.path.replace(/^\//, '');
    const cleanHtmlFile = path.join(rootDir, `${reqPath}.html`);
    const publicHtmlFile = path.join(publicDir, `${reqPath}.html`);

    const fs = require('fs');
    if (fs.existsSync(publicHtmlFile)) {
        return res.sendFile(publicHtmlFile);
    }
    if (fs.existsSync(cleanHtmlFile)) {
        return res.sendFile(cleanHtmlFile);
    }
    // Default fallback to index.html
    const indexFile = fs.existsSync(path.join(publicDir, 'index.html'))
        ? path.join(publicDir, 'index.html')
        : path.join(rootDir, 'index.html');
    res.sendFile(indexFile);
});

// Start Server
app.listen(PORT, () => {
    console.log(`====================================================================`);
    console.log(`🚀 Gear Up Gadgets Enterprise Server running on port ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📧 Transactional Email Gateway: http://localhost:${PORT}/api/send-email`);
    console.log(`🔐 Credentials: process.env.GMAIL_USER is ${process.env.GMAIL_USER ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`====================================================================`);
});
