const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendPurchaseOrderEmail = async ({ vendorEmail, vendorName, productName, productSku, quantity, orderId, notes }) => {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'SmartShelfX <noreply@smartshelfx.com>',
        to: vendorEmail,
        subject: `New Purchase Order #PO-${orderId} — ${productName}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: #0d1117; padding: 24px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #00b4ff; font-size: 22px; margin: 0;">SmartShelfX</h1>
          <p style="color: #aaa; margin: 4px 0 0;">AI-Powered Inventory Platform</p>
        </div>
        <div style="background: #fff; padding: 24px; border-radius: 8px; border: 1px solid #e0e0e0;">
          <h2 style="color: #333; margin-top: 0;">New Purchase Order Received</h2>
          <p style="color: #555;">Dear <strong>${vendorName}</strong>,</p>
          <p style="color: #555;">A new purchase order has been raised for the following item:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #333;">Order ID</td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #555;">PO-${orderId}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #333;">Product</td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #555;">${productName}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #333;">SKU</td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #555;">${productSku}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #333;">Quantity</td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #555;"><strong style="color: #00b4ff;">${quantity} units</strong></td>
            </tr>
            ${notes ? `<tr style="background: #f5f5f5;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #333;">Notes</td><td style="padding: 10px; border: 1px solid #ddd; color: #555;">${notes}</td></tr>` : ''}
          </table>
          <p style="color: #555;">Please log in to the SmartShelfX Vendor Portal to approve or reject this order.</p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">This is an automated notification from SmartShelfX.</p>
        </div>
      </div>
    `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendPurchaseOrderEmail };