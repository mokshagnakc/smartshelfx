const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Product, User, sequelize } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

const ACCEPTED_MIMES = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/tab-separated-values',
    'text/plain',
    'application/octet-stream'
];

const ACCEPTED_EXTS = ['.csv', '.xlsx', '.xls', '.tsv', '.ods', '.txt'];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `import_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ACCEPTED_EXTS.includes(ext) || ACCEPTED_MIMES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type. Accepted: ${ACCEPTED_EXTS.join(', ')}`));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(authenticate);

const normalize = (row, keys) => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
        const flat = k.toLowerCase().replace(/[\s_\-]/g, '');
        for (const rk of Object.keys(row)) {
            if (rk.trim().toLowerCase().replace(/[\s_\-]/g, '') === flat && row[rk] !== undefined && row[rk] !== '') {
                return row[rk];
            }
        }
    }
    return undefined;
};

const parseRows = (rows) => {
    const results = [];
    for (const row of rows) {
        const name = normalize(row, ['name', 'product_name', 'productname', 'Product Name', 'item', 'item_name']);
        const sku = normalize(row, ['sku', 'SKU', 'product_sku', 'code', 'item_code', 'barcode']);
        const category = normalize(row, ['category', 'Category', 'cat', 'type', 'group']);

        if (!name || !sku || !category) continue;

        results.push({
            name: String(name).trim(),
            sku: String(sku).trim(),
            category: String(category).trim(),
            vendor_id: null,
            reorder_level: Number(normalize(row, ['reorder_level', 'reorder', 'Reorder Lvl', 'min_stock', 'minimum']) || 10),
            current_stock: Number(normalize(row, ['current_stock', 'stock', 'Stock', 'qty', 'quantity', 'on_hand']) || 0),
            unit_price: Number(normalize(row, ['unit_price', 'price', 'Price', 'cost', 'unit_cost', 'rate']) || 0),
            expiry_date: normalize(row, ['expiry_date', 'expiry', 'expiration', 'best_before', 'exp_date']) || null
        });
    }
    return results;
};

const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', err => reject(err));
    });
};

const parseTSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv({ separator: '\t', mapHeaders: ({ header }) => header.trim() }))
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', err => reject(err));
    });
};

const parseExcel = (filePath) => {
    try {
        const XLSX = require('xlsx');
        const wb = XLSX.readFile(filePath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        return rows;
    } catch (err) {
        throw new Error('Failed to parse Excel file: ' + err.message);
    }
};

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, vendor_id } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const where = {};

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { sku: { [Op.like]: `%${search}%` } }
            ];
        }
        if (category) where.category = category;
        if (vendor_id) where.vendor_id = Number(vendor_id);

        const { count, rows } = await Product.findAndCountAll({
            where,
            include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }],
            order: [['updatedAt', 'DESC']],
            limit: Number(limit),
            offset
        });

        res.json({ total: count, page: Number(page), data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/categories', async (req, res) => {
    try {
        const cats = await Product.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
            raw: true
        });
        res.json(cats.map(c => c.category).filter(Boolean));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, {
            include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }]
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const { name, sku, category, vendor_id, reorder_level, current_stock, unit_price, expiry_date } = req.body;
        if (!name || !sku || !category) {
            return res.status(400).json({ error: 'name, sku and category are required' });
        }
        const existing = await Product.findOne({ where: { sku } });
        if (existing) return res.status(409).json({ error: `SKU "${sku}" already exists` });

        const product = await Product.create({
            name, sku, category,
            vendor_id: vendor_id || null,
            reorder_level: reorder_level || 10,
            current_stock: current_stock || 0,
            unit_price: unit_price || 0,
            expiry_date: expiry_date || null
        });
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const { name, sku, category, vendor_id, reorder_level, current_stock, unit_price, expiry_date } = req.body;
        if (sku && sku !== product.sku) {
            const existing = await Product.findOne({ where: { sku } });
            if (existing) return res.status(409).json({ error: `SKU "${sku}" already in use` });
        }

        await product.update({
            name: name ?? product.name,
            sku: sku ?? product.sku,
            category: category ?? product.category,
            vendor_id: vendor_id ?? product.vendor_id,
            reorder_level: reorder_level ?? product.reorder_level,
            current_stock: current_stock ?? product.current_stock,
            unit_price: unit_price ?? product.unit_price,
            expiry_date: expiry_date ?? product.expiry_date
        });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        await product.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/import-sheet', requireRole('ADMIN', 'MANAGER'), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    try {
        let rawRows = [];

        if (ext === '.csv') {
            rawRows = await parseCSV(filePath);
        } else if (ext === '.tsv' || ext === '.txt') {
            rawRows = await parseTSV(filePath);
        } else if (['.xlsx', '.xls', '.ods'].includes(ext)) {
            rawRows = parseExcel(filePath);
        } else {
            rawRows = await parseCSV(filePath);
        }

        const validRows = parseRows(rawRows);

        if (validRows.length === 0) {
            fs.existsSync(filePath) && fs.unlinkSync(filePath);
            return res.status(400).json({
                error: 'No valid rows found. Required columns: name (or product_name), sku (or code), category. Optional: current_stock, reorder_level, unit_price, expiry_date'
            });
        }

        const imported = await Product.bulkCreate(validRows, {
            ignoreDuplicates: true,
            validate: true
        });

        fs.existsSync(filePath) && fs.unlinkSync(filePath);

        res.json({
            success: true,
            imported: imported.length,
            skipped: validRows.length - imported.length,
            total: validRows.length,
            message: `Successfully imported ${imported.length} of ${validRows.length} products`
        });

    } catch (err) {
        fs.existsSync(filePath) && fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Import failed: ' + err.message });
    }
});

router.post('/import-csv', requireRole('ADMIN', 'MANAGER'), upload.single('file'), async (req, res) => {
    req.url = '/import-sheet';
    router.handle(req, res, () => { });
});

module.exports = router;