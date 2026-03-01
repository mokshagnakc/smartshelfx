const express = require('express');
const { Alert, Product } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const { type, is_read, product_id, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const where = {};
        if (type) where.type = type;
        if (product_id) where.product_id = Number(product_id);

        if (is_read !== undefined && is_read !== '') {
            where.is_read = is_read === 'true' || is_read === true;
        }

        const { count, rows } = await Alert.findAndCountAll({
            where,
            include: [{
                model: Product,
                as: 'Product',
                attributes: ['id', 'name', 'sku', 'category', 'current_stock', 'reorder_level']
            }],
            order: [['created_at', 'DESC']],
            limit: Number(limit),
            offset
        });

        const unread = await Alert.count({ where: { is_read: false } });

        res.json({ total: count, unread, page: Number(page), data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/read-all', async (req, res) => {
    try {
        await Alert.update({ is_read: true }, { where: { is_read: false } });
        res.json({ success: true, message: 'All alerts marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/read', async (req, res) => {
    try {
        const alert = await Alert.findByPk(req.params.id);
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        await alert.update({ is_read: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const alert = await Alert.findByPk(req.params.id);
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        await alert.destroy();
        res.json({ success: true, message: 'Alert dismissed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/', requireRole('ADMIN'), async (req, res) => {
    try {
        const deleted = await Alert.destroy({ where: { is_read: true } });
        res.json({ success: true, deleted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;