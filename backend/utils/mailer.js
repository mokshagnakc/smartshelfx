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

/* ── Sent to VENDOR when a new PO is raised ────────────────────── */
const sendPurchaseOrderEmail = async ({ vendorEmail, vendorName, productName, productSku, quantity, orderId, notes }) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'SmartShelfX <noreply@smartshelfx.com>',
    to: vendorEmail,
    subject: `New Purchase Order #PO-${orderId} — ${productName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <div style="background:#0d1117;padding:24px;border-radius:8px;margin-bottom:20px;">
          <h1 style="color:#00b4ff;font-size:22px;margin:0;">SmartShelfX</h1>
          <p style="color:#aaa;margin:4px 0 0;">AI-Powered Inventory Platform</p>
        </div>
        <div style="background:#fff;padding:24px;border-radius:8px;border:1px solid #e0e0e0;">
          <h2 style="color:#333;margin-top:0;">📦 New Purchase Order Received</h2>
          <p style="color:#555;">Dear <strong>${vendorName}</strong>,</p>
          <p style="color:#555;">A new purchase order has been raised and requires your approval:</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Order ID</td>
              <td style="padding:10px;border:1px solid #ddd;color:#555;"><strong>PO-${orderId}</strong></td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Product</td>
              <td style="padding:10px;border:1px solid #ddd;color:#555;">${productName}</td>
            </tr>
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">SKU</td>
              <td style="padding:10px;border:1px solid #ddd;color:#555;">${productSku}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Quantity</td>
              <td style="padding:10px;border:1px solid #ddd;color:#555;"><strong style="color:#00b4ff;">${quantity} units</strong></td>
            </tr>
            ${notes ? `<tr style="background:#f5f5f5;"><td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Notes</td><td style="padding:10px;border:1px solid #ddd;color:#555;">${notes}</td></tr>` : ''}
          </table>
          <p style="color:#555;">Please log in to the <strong>SmartShelfX Vendor Portal</strong> to approve or reject this order.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/orders"
               style="background:#00b4ff;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
              Review Order →
            </a>
          </div>
          <p style="color:#888;font-size:12px;margin-top:24px;">This is an automated notification from SmartShelfX.</p>
        </div>
      </div>`
  });
};

/* ── Sent to MANAGER when vendor approves or rejects ───────────── */
const sendManagerNotificationEmail = async ({ managerEmail, managerName, vendorName, productName, productSku, quantity, orderId, decision, notes }) => {
  const isApproved = decision === 'APPROVED';
  const color = isApproved ? '#22c55e' : '#ef4444';
  const icon = isApproved ? '✅' : '❌';
  const label = isApproved ? 'APPROVED' : 'REJECTED';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'SmartShelfX <noreply@smartshelfx.com>',
    to: managerEmail,
    subject: `${icon} PO-${orderId} ${label} by ${vendorName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <div style="background:#0d1117;padding:24px;border-radius:8px;margin-bottom:20px;">
          <h1 style="color:#00b4ff;font-size:22px;margin:0;">SmartShelfX</h1>
          <p style="color:#aaa;margin:4px 0 0;">AI-Powered Inventory Platform</p>
        </div>
        <div style="background:#fff;padding:24px;border-radius:8px;border:1px solid #e0e0e0;">
          <h2 style="color:#333;margin-top:0;">${icon} Purchase Order ${label}</h2>
          <p style="color:#555;">Dear <strong>${managerName || 'Manager'}</strong>,</p>
          <p style="color:#555;">
            Vendor <strong>${vendorName}</strong> has 
            <strong style="color:${color};">${label.toLowerCase()}</strong> 
            purchase order <strong>PO-${orderId}</strong>.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Order ID</td>
              <td style="padding:10px;border:1px solid #ddd;"><strong>PO-${orderId}</strong></td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Product</td>
              <td style="padding:10px;border:1px solid #ddd;">${productName} (${productSku})</td>
            </tr>
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Quantity</td>
              <td style="padding:10px;border:1px solid #ddd;">${quantity} units</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Vendor</td>
              <td style="padding:10px;border:1px solid #ddd;">${vendorName}</td>
            </tr>
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Decision</td>
              <td style="padding:10px;border:1px solid #ddd;"><strong style="color:${color};">${label}</strong></td>
            </tr>
            ${notes ? `<tr><td style="padding:10px;border:1px solid #ddd;font-weight:bold;color:#333;">Notes</td><td style="padding:10px;border:1px solid #ddd;color:#555;">${notes}</td></tr>` : ''}
          </table>
          <div style="text-align:center;margin:24px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/orders"
               style="background:#00b4ff;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
              View Orders →
            </a>
          </div>
          <p style="color:#888;font-size:12px;margin-top:24px;">This is an automated notification from SmartShelfX.</p>
        </div>
      </div>`
  });
};


/* ── Sent to USER for password reset link ──────────────────────── */
const sendForgotPasswordEmail = async ({ toEmail, toName, resetUrl, systemEmail }) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'SmartShelfX <noreply@smartshelfx.com>',
    to: toEmail,
    subject: 'SmartShelfX — Reset Your Password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090f;border-radius:14px;padding:36px;color:#fff;">
        <h1 style="font-size:22px;font-weight:800;letter-spacing:2px;margin-bottom:4px;">SmartShelfX</h1>
        <p style="font-size:11px;color:#00b4ff;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px;">AI-POWERED INVENTORY</p>
        <h2 style="margin-bottom:8px;">Password Reset Request</h2>
        <p style="font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;margin-bottom:24px;">
          Hi <strong>${toName}</strong>, we received a request to reset your SmartShelfX password.<br>
          This link expires in <strong>15 minutes</strong>.
        </p>
        ${systemEmail ? `<p style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:20px;">Your SmartShelfX login email: <strong style="color:#00b4ff;">${systemEmail}</strong></p>` : ''}
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}"
             style="display:inline-block;padding:13px 32px;background:linear-gradient(135deg,#0070cc,#00b4ff);border-radius:8px;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">
            Reset My Password →
          </a>
        </div>
        <p style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:28px;">
          If you did not request this, safely ignore this email. Your password will not change.
        </p>
      </div>`
  });
};

module.exports = { sendPurchaseOrderEmail, sendManagerNotificationEmail, sendForgotPasswordEmail };