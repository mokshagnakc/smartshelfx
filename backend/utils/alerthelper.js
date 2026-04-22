const { Alert, PurchaseOrder, Product, User } = require('../models');

/* ─────────────────────────────────────────────────────────────────
   createStockAlert — creates LOW_STOCK or OUT_OF_STOCK alert
   Only for the assigned vendor. Admin/Manager never receive alerts.
───────────────────────────────────────────────────────────────── */
const createStockAlert = async (product) => {
    const { id, name, sku, current_stock, reorder_level } = product;
    const vendor_id = Number(product.vendor_id);

    // Alerts only go to vendors — skip if no vendor assigned
    if (!vendor_id) return;

    if (current_stock === 0) {
        await Alert.create({
            product_id: id,
            vendor_id,
            type: 'OUT_OF_STOCK',
            message: `${name} (${sku}): completely out of stock! Immediate restock required.`,
            is_read: false
        });
    } else if (current_stock <= reorder_level) {
        await Alert.create({
            product_id: id,
            vendor_id,
            type: 'LOW_STOCK',
            message: `${name} (${sku}): only ${current_stock} units left (reorder level: ${reorder_level}). Please restock soon.`,
            is_read: false
        });
    }
};

/* ─────────────────────────────────────────────────────────────────
   createAutoPO — auto-generates a PENDING PO when stock is
   Critical (stock=0 or stock <= reorder*0.5) or High (stock <= reorder)
   Only runs if:
     - product has a vendor_id assigned
     - no PENDING or APPROVED PO already exists for this product
───────────────────────────────────────────────────────────────── */
const createAutoPO = async (product) => {
    const { id, name, sku, current_stock, reorder_level } = product;
    const vendor_id = Number(product.vendor_id);

    // Must have a vendor to create a PO
    if (!vendor_id) return null;

    // Determine if stock is Critical or High
    const isCritical = current_stock === 0 || current_stock <= reorder_level * 0.5;
    const isHigh = current_stock <= reorder_level;

    if (!isCritical && !isHigh) return null;

    const riskLevel = isCritical ? 'CRITICAL' : 'HIGH';

    // Skip if PENDING or APPROVED PO already exists
    const existing = await PurchaseOrder.findOne({
        where: { product_id: id, status: ['PENDING', 'APPROVED'] }
    });
    if (existing) return null;

    // quantity = reorder_level * 2 (minimum 10)
    const quantity = Math.max(reorder_level * 2, 10);

    const po = await PurchaseOrder.create({
        product_id: id,
        vendor_id,
        quantity,
        status: 'PENDING',
        notes: `Auto-generated: ${name} (${sku}) is ${riskLevel}. Stock: ${current_stock}, Reorder level: ${reorder_level}.`
    });

    console.log(`[AutoPO] PO #${po.id} created → ${name} (${sku}) | Risk: ${riskLevel} | vendor_id: ${vendor_id}`);

    // Email the vendor
    try {
        const vendor = await User.findByPk(vendor_id, { attributes: ['name', 'email'] });
        if (vendor && vendor.email) {
            const { sendPurchaseOrderEmail } = require('./mailer');
            await sendPurchaseOrderEmail({
                vendorEmail: vendor.email,
                vendorName: vendor.name,
                productName: name,
                productSku: sku,
                quantity,
                orderId: po.id,
                notes: `Stock status: ${riskLevel}. Current stock: ${current_stock} units.`
            });
        }
    } catch (mailErr) {
        console.error(`[AutoPO] Email failed for PO #${po.id}:`, mailErr.message);
    }

    return po;
};

/* ─────────────────────────────────────────────────────────────────
   checkAndCreatePO — combined: alert + auto PO
   Call this whenever stock changes
───────────────────────────────────────────────────────────────── */
const checkAndCreatePO = async (product) => {
    try { await createStockAlert(product); } catch (e) {
        console.error('[checkAndCreatePO] Alert error:', e.message);
    }
    try { await createAutoPO(product); } catch (e) {
        console.error('[checkAndCreatePO] PO error:', e.message);
    }
};

module.exports = { createStockAlert, createAutoPO, checkAndCreatePO };