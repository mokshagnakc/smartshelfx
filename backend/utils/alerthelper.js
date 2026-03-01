const { Alert } = require('../models');

const createStockAlert = async (product) => {
    const { id, name, sku, current_stock, reorder_level } = product;

    if (current_stock === 0) {
        await Alert.create({
            product_id: id,
            type: 'OUT_OF_STOCK',
            message: `${name} (${sku}): completely out of stock!`,
            is_read: false
        });
        return;
    }

    if (current_stock <= reorder_level) {
        await Alert.create({
            product_id: id,
            type: 'LOW_STOCK',
            message: `${name} (${sku}): only ${current_stock} units left (reorder level: ${reorder_level})`,
            is_read: false
        });
    }
};

module.exports = { createStockAlert };