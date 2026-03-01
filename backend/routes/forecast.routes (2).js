const express = require('express');
const axios = require('axios');
const { Op } = require('sequelize');
const { ForecastResult, Product, User, Alert } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const { risk_level, product_id } = req.query;

        const where = {};
        if (risk_level) where.risk_level = risk_level;
        if (product_id) where.product_id = Number(product_id);

        const forecasts = await ForecastResult.findAll({
            where,
            include: [{
                model: Product,
                as: 'Product',
                attributes: ['id', 'name', 'sku', 'category', 'current_stock', 'reorder_level', 'unit_price'],
                include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }]
            }],
            order: [['created_at', 'DESC']],
            limit: 200
        });

        res.json(forecasts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/run', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

        const mlResponse = await axios.post(`${mlUrl}/forecast`, {}, { timeout: 60000 });
        const mlData = mlResponse.data;

        const savedForecasts = [];

        if (mlData.forecasts && Array.isArray(mlData.forecasts)) {
            for (const item of mlData.forecasts) {
                try {
                    const [record, created] = await ForecastResult.upsert({
                        product_id: item.product_id,
                        forecast_date: item.forecast_date || new Date().toISOString().split('T')[0],
                        predicted_qty: item.predicted_qty || 0,
                        confidence: item.confidence || 0,
                        risk_level: item.risk_level || 'LOW'
                    });

                    savedForecasts.push(record);

                    if (['HIGH', 'CRITICAL'].includes(item.risk_level)) {
                        const product = await Product.findByPk(item.product_id, { attributes: ['name', 'sku'] });
                        if (product) {
                            await Alert.create({
                                product_id: item.product_id,
                                type: 'RESTOCK_SUGGESTED',
                                message: `AI suggests restocking ${product.name} (${product.sku}) — forecasted demand: ${Math.ceil(item.predicted_qty)} units. Risk: ${item.risk_level}`,
                                is_read: false
                            });
                        }
                    }
                } catch (itemErr) {
                    console.error(`Error saving forecast for product ${item.product_id}:`, itemErr.message);
                }
            }
        }

        res.json({
            success: true,
            message: `Forecast completed. ${savedForecasts.length} products updated.`,
            forecasts: savedForecasts,
            accuracy: mlData.model_accuracy || null,
            ran_at: mlData.trained_at || new Date().toISOString()
        });
    } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
            return res.status(503).json({ error: 'ML service is not running. Start ml-service/main.py first.' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.get('/:product_id', async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.product_id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const forecasts = await ForecastResult.findAll({
            where: { product_id: req.params.product_id },
            include: [{
                model: Product,
                as: 'Product',
                attributes: ['id', 'name', 'sku', 'current_stock', 'reorder_level']
            }],
            order: [['forecast_date', 'ASC']],
            limit: 30
        });

        res.json(forecasts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;