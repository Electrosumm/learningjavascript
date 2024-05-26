const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const customerController = require('../controllers/customercontroller.js'); // Adjusted to match your project structure
const db = require('./db.js');
const app = express();
const port = 3000;

// Use middleware
app.use(express.static('public'));
app.use(fileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Use routes
app.use('/', customerController);


app.post('/api/import', (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    const importFile = req.files.importFile;
    const uploadPath = path.join(__dirname, 'uploads', importFile.name);
    importFile.mv(uploadPath, (err) => {
        if (err) return res.status(500).send(err);
        // Handle file processing here
        res.send('File uploaded and processed.');
    });
});

app.get('/api/export', (req, res) => {
    const fileName = req.query.name || 'export.xlsx';
    const filePath = path.join(__dirname, 'exports', fileName);
    res.download(filePath, fileName);
});

app.get('/customers', (req, res) => {
    res.render('customers');
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});