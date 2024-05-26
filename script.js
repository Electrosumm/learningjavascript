const http = require('http');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const qs = require('querystring');
const path = require('path');
const ejs = require('ejs');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const express = require('express');
const app = express();
const cors = require('cors');

// Import the connection from db.js
const connection = require('./src/js/db.js');

// Rate limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Use middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(limiter);
app.use(cookieParser());
app.use(csrfProtection);

app.get('/form', csrfProtection, (req, res) => {
    res.render('send', { csrfToken: req.csrfToken() });
});

app.post('/process', csrfProtection, (req, res) => {
    res.send('data is being processed');
});

app.use(cors({
    origin: 'https://your-allowed-origin.com',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// Clickjacking prevention
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.cookie('cookieName', 'cookieValue', { secure: true, httpOnly: true });
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "script-src 'self'");
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https://trusted.cdn.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    next();
});

const sessions = {};

function parseCookies(request) {
    const list = {};
    const rc = request.headers.cookie;

    rc && rc.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

function serveFile(filePath, response, data = {}) {
    const safePath = path.join(__dirname, 'src', 'public', path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, ''));
    const absolutePath = path.join(__dirname, 'src', filePath);
    fs.readFile(absolutePath, 'utf8', (err, fileData) => {
        if (err) {
            console.error(err); // Log the error
            response.writeHead(500, { 'Content-Type': 'text/plain' });
            response.end(`Error loading ${filePath}`);
        } else {
            const ext = path.extname(filePath);
            let contentType = 'text/html';

            if (ext === '.css') {
                contentType = 'text/css';
            } else if (ext === '.js') {
                contentType = 'application/javascript';
            } else if (['.jpg', '.jpeg', '.png', '.svg', '.gif'].includes(ext)) {
                contentType = 'image/' + ext.substring(1);
            }

            response.writeHead(200, { 'Content-Type': contentType });

            if (ext === '.ejs') {
                const rendered = ejs.render(fileData, data);
                response.end(rendered);
            } else {
                response.end(fileData);
            }
        }
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (pathname === '/' && req.method === 'GET') {
        serveFile('public/views/login.ejs', res);
    } else if (pathname === '/auth' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const postData = qs.parse(body);
            const username = postData.username;
            const password = postData.password;
            if (username && password) {
                const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
                connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, hashedPassword], (error, results) => {
                    if (error) throw error;
                    if (results.length > 0) {
                        const sessionId = new Date().getTime();
                        sessions[sessionId] = { loggedin: true, username: username };
                        res.writeHead(302, {
                            'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Strict`,
                            'Location': '/home'
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('Incorrect Username and/or Password!');
                    }
                });
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('Please enter Username and Password!');
            }
        });
    } else if (pathname === '/home' && req.method === 'GET') {
        const cookies = parseCookies(req);
        const session = sessions[cookies.sessionId];
        if (session && session.loggedin) {
            fs.readFile('src/public/views/home.ejs', 'utf8', (err, dashboardData) => {
                if (err) {
                    console.error(err); // Log the error
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error loading dashboard');
                    return;
                }
                const content = ejs.render(dashboardData, { username: session.username });
                serveFile('public/views/layout.ejs', res, { title: 'Dashboard', username: session.username, content: content });
            });
        } else {
            res.writeHead(302, { 'Location': '/' });
            res.end();
        }
    } else if (pathname === '/customers' && req.method === 'GET') {
        const cookies = parseCookies(req);
        const session = sessions[cookies.sessionId];
        if (session && session.loggedin) {
            fs.readFile('src/public/views/customers.ejs', 'utf8', (err, customersData) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error loading customers');
                    return;
                }
                const content = ejs.render(customersData, { username: session.username });
                serveFile('public/views/layout.ejs', res, { title: 'Customers', username: session.username, content: content });
            });
        } else {
            res.writeHead(302, { 'Location': '/' });
            res.end();
        }
    } else if (pathname === '/invoices' && req.method === 'GET') {
        const cookies = parseCookies(req);
        const session = sessions[cookies.sessionId];
        if (session && session.loggedin) {
            fs.readFile('src/public/views/invoices.ejs', 'utf8', (err, invoicesData) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error loading invoices');
                    return;
                }
                const content = ejs.render(invoicesData, { username: session.username });
                serveFile('public/views/layout.ejs', res, { title: 'Invoices', username: session.username, content: content });
            });
        } else {
            res.writeHead(302, { 'Location': '/' });
            res.end();
        }
    } else {
        serveFile(pathname, res);
    }
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
