const { Product, PurchaseOrder, User } = require('../models');
const { sendPurchaseOrderEmail } = require('./mailer');

const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const runPOCheck = async () => {
    try {
        console.log('[Scheduler] Running PO check...');

        // Find all products that are HIGH or CRITICAL and have a vendor assigned
        const products = await Product.findAll({
            include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }]
        });

        let created = 0;

        for (const product of products) {
            const { id, name, sku, current_stock, reorder_level, vendor_id, vendor } = product;

            // Skip if no vendor assigned
            if (!vendor_id) continue;

            // Check if HIGH or CRITICAL
            const isCritical = current_stock === 0 || current_stock <= reorder_level * 0.5;
            const isHigh = current_stock <= reorder_level;
            if (!isCritical && !isHigh) continue;

            const riskLevel = isCritical ? 'CRITICAL' : 'HIGH';

            // Skip if PENDING or APPROVED PO already exists
            const existing = await PurchaseOrder.findOne({
                where: { product_id: id, status: ['PENDING', 'APPROVED'] }
            });
            if (existing) continue;

            // Create PO
            const quantity = Math.max(reorder_level * 2, 10);
            const po = await PurchaseOrder.create({
                product_id: id,
                vendor_id,
                quantity,
                status: 'PENDING',
                notes: `[Scheduler] Auto-generated: ${name} (${sku}) is ${riskLevel}. Stock: ${current_stock}, Reorder: ${reorder_level}.`
            });

            console.log(`[Scheduler] ✅ PO #${po.id} created → ${name} | ${riskLevel} | vendor: ${vendor?.name || vendor_id}`);
            created++;

            // Email vendor
            if (vendor && vendor.email) {
                try {
                    await sendPurchaseOrderEmail({
                        vendorEmail: vendor.email,
                        vendorName: vendor.name,
                        productName: name,
                        productSku: sku,
                        quantity,
                        orderId: po.id,
                        notes: `Stock status: ${riskLevel}. Current stock: ${current_stock} units.`
                    });
                } catch (mailErr) {
                    console.error(`[Scheduler] Email failed for PO #${po.id}:`, mailErr.message);
                }
            }
        }

        if (created === 0) {
            console.log('[Scheduler] No new POs needed.');
        } else {
            console.log(`[Scheduler] Done — ${created} new PO(s) created.`);
        }

    } catch (err) {
        console.error('[Scheduler] Error during PO check:', err.message);
    }
};

const startPOScheduler = () => {
    console.log(`[Scheduler] PO auto-check started — runs every 2 minutes.`);
    // Run once immediately on startup
    runPOCheck();
    // Then every 2 minutes
    setInterval(runPOCheck, INTERVAL_MS);
};

module.exports = { startPOScheduler };