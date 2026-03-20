const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Product, StockTransaction, PurchaseOrder, Alert } = require('../models');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/summary', async (req, res) => {
    try {
        const totalProducts = await Product.count();

        const lowStockItems = await Product.count({
            where: {
                current_stock: { [Op.gt]: 0 },
                [Op.and]: [sequelize.literal('current_stock <= reorder_level')]
            }
        });

        const outOfStockItems = await Product.count({
            where: { current_stock: 0 }
        });

        // Only count POs that have a vendor assigned (orphaned POs excluded)
        const pendingOrders = await PurchaseOrder.count({
            where: { status: 'PENDING', vendor_id: { [Op.ne]: null } }
        });

        res.json({ totalProducts, lowStockItems, outOfStockItems, pendingOrders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stock-trend', async (req, res) => {
    try {
        const rows = await StockTransaction.findAll({
            attributes: [
                [sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), '%Y-%m'), 'month'],
                'type',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'total']
            ],
            where: {
                timestamp: {
                    [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6))
                }
            },
            group: [
                sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), '%Y-%m'),
                'type'
            ],
            order: [
                [sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), '%Y-%m'), 'ASC']
            ],
            raw: true
        });

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/top-restocked', async (req, res) => {
    try {
        const rows = await StockTransaction.findAll({
            attributes: [
                'product_id',
                [sequelize.fn('SUM', sequelize.col('StockTransaction.quantity')), 'total_restocked']
            ],
            where: { type: 'IN' },
            include: [{
                model: Product,
                as: 'Product',
                attributes: ['name', 'sku']
            }],
            group: ['product_id', 'Product.id'],
            order: [[sequelize.fn('SUM', sequelize.col('StockTransaction.quantity')), 'DESC']],
            limit: 10,
            raw: false
        });

        const result = rows.map(r => ({
            name: r.Product.name,
            sku: r.Product.sku,
            total_restocked: Number(r.dataValues.total_restocked)
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/category-breakdown', async (req, res) => {
    try {
        const rows = await Product.findAll({
            attributes: [
                'category',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('current_stock')), 'total_stock']
            ],
            group: ['category'],
            order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
            raw: true
        });

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/low-stock', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const products = await Product.findAll({
            where: {
                [Op.or]: [
                    { current_stock: 0 },
                    sequelize.literal('current_stock <= reorder_level')
                ]
            },
            order: [['current_stock', 'ASC']],
            limit: Number(limit)
        });

        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stock-movement', async (req, res) => {
    try {
        const period = req.query.period || 'month'; // 'day' | 'month' | 'year'

        const fmtMap = {
            day: '%Y-%m-%d',
            month: '%Y-%m',
            year: '%Y'
        };
        const fmt = fmtMap[period] || '%Y-%m';

        // How far back to look
        const sinceMap = { day: 30, month: 6, year: 5 };
        const daysBack = (sinceMap[period] || 6);
        const since = new Date();
        if (period === 'day') since.setDate(since.getDate() - daysBack);
        else if (period === 'month') since.setMonth(since.getMonth() - daysBack);
        else since.setFullYear(since.getFullYear() - daysBack);

        const rows = await StockTransaction.findAll({
            attributes: [
                [sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), fmt), 'label'],
                'type',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'total']
            ],
            where: { timestamp: { [Op.gte]: since } },
            group: [sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), fmt), 'type'],
            order: [[sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), fmt), 'ASC']],
            raw: true
        });

        // Pivot into { label, purchases, sales }
        const map = {};
        for (const r of rows) {
            if (!map[r.label]) map[r.label] = { label: r.label, purchases: 0, sales: 0 };
            if (r.type === 'IN') map[r.label].purchases += Number(r.total);
            else map[r.label].sales += Number(r.total);
        }

        res.json(Object.values(map));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;