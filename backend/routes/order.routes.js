const express = require('express');
const { PurchaseOrder, Product, User, ForecastResult } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { sendPurchaseOrderEmail } = require('../utils/mailer');

const router = express.Router();

router.use(authenticate);

router.get('/suggestions', async (req, res) => {
    try {
        const suggestions = await ForecastResult.findAll({
            where: { risk_level: ['HIGH', 'CRITICAL'] },
            include: [{
                model: Product,
                as: 'Product',
                attributes: ['id', 'name', 'sku', 'category', 'current_stock', 'reorder_level', 'unit_price', 'vendor_id'],
                include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }]
            }],
            order: [
                [{ model: Product, as: 'Product' }, 'current_stock', 'ASC'],
                ['risk_level', 'DESC']
            ],
            limit: 20
        });

        res.json(suggestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, status, vendor_id } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const where = {};
        if (status) where.status = status;

        if (req.user.role === 'VENDOR') {
            where.vendor_id = req.user.id;
        } else if (vendor_id) {
            where.vendor_id = Number(vendor_id);
        }

        const { count, rows } = await PurchaseOrder.findAndCountAll({
            where,
            include: [
                {
                    model: Product,
                    as: 'Product',
                    attributes: ['id', 'name', 'sku', 'category', 'unit_price']
                },
                {
                    model: User,
                    as: 'vendor',
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: Number(limit),
            offset
        });

        res.json({ total: count, page: Number(page), data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const order = await PurchaseOrder.findByPk(req.params.id, {
            include: [
                { model: Product, as: 'Product' },
                { model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }
            ]
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (req.user.role === 'VENDOR' && order.vendor_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const { product_id, vendor_id, quantity, notes } = req.body;

        if (!product_id || !quantity) {
            return res.status(400).json({ error: 'product_id and quantity are required' });
        }

        const product = await Product.findByPk(product_id, {
            include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }]
        });

        if (!product) return res.status(404).json({ error: 'Product not found' });

        const resolvedVendorId = vendor_id || product.vendor_id;

        const order = await PurchaseOrder.create({
            product_id: Number(product_id),
            vendor_id: resolvedVendorId ? Number(resolvedVendorId) : null,
            quantity: Number(quantity),
            status: 'PENDING',
            notes: notes || null
        });

        if (resolvedVendorId) {
            const vendor = await User.findByPk(resolvedVendorId, { attributes: ['name', 'email'] });
            if (vendor && vendor.email) {
                try {
                    await sendPurchaseOrderEmail({
                        vendorEmail: vendor.email,
                        vendorName: vendor.name,
                        productName: product.name,
                        productSku: product.sku,
                        quantity: Number(quantity),
                        orderId: order.id,
                        notes: notes || null
                    });
                } catch (mailErr) {
                    console.error('Email failed:', mailErr.message);
                }
            }
        }

        const fullOrder = await PurchaseOrder.findByPk(order.id, {
            include: [
                { model: Product, as: 'Product', attributes: ['id', 'name', 'sku'] },
                { model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }
            ]
        });

        res.status(201).json(fullOrder);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        const validStatuses = ['PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
        }

        const order = await PurchaseOrder.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (req.user.role === 'VENDOR') {
            if (order.vendor_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (!['APPROVED', 'CANCELLED'].includes(status)) {
                return res.status(403).json({ error: 'Vendors can only approve or cancel orders' });
            }
        }

        await order.update({ status });

        const updatedOrder = await PurchaseOrder.findByPk(order.id, {
            include: [
                { model: Product, as: 'Product', attributes: ['id', 'name', 'sku'] },
                { model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }
            ]
        });

        res.json(updatedOrder);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;