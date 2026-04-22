const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendForgotPasswordEmail } = require('../utils/mailer');
const crypto = require('crypto');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth.middleware');
const router = express.Router();
const resetTokenStore = {};
const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@#_]).{8,}$/;

router.post('/register', async (req, res) => {
    try {
        const { name, username, email, personal_email, password, role } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
        if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
        if (!password) return res.status(400).json({ error: 'Password is required' });
        if (!PW_REGEX.test(password)) return res.status(400).json({ error: 'Password must be 8+ chars with uppercase, lowercase, number and @/#/_' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
        if (await User.findOne({ where: { email: email.toLowerCase().trim() } })) return res.status(409).json({ error: 'Email is already registered' });
        if (username && username.trim() && await User.findOne({ where: { username: username.trim() } })) return res.status(409).json({ error: 'Username is already taken' });
        const assignedRole = ['ADMIN', 'MANAGER', 'VENDOR'].includes(role) ? role : 'MANAGER';
        const user = await User.create({ name: name.trim(), username: (username && username.trim()) || null, email: email.toLowerCase().trim(), personal_email: personal_email ? personal_email.toLowerCase().trim() : null, password: await bcrypt.hash(password, 10), role: assignedRole });
        return res.status(201).json({ success: true, userId: user.id });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: (err.errors?.[0]?.path || 'field') + ' is already in use' });
        if (err.name === 'SequelizeValidationError') return res.status(400).json({ error: err.errors?.[0]?.message || 'Validation error' });
        return res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
        const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        if (!user) return res.status(401).json({ error: 'No account found with this email' });
        if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Incorrect password' });
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
        return res.json({ token, userId: user.id, name: user.name, role: user.role, email: user.email });
    } catch (err) { return res.status(500).json({ error: 'Login failed: ' + err.message }); }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email, personal_email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        if (!user) return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });

        // Verify personal email matches what was registered
        if (personal_email && user.personal_email) {
            if (user.personal_email.toLowerCase() !== personal_email.toLowerCase().trim()) {
                return res.status(400).json({ error: 'Personal email does not match our records. Use the Gmail you entered during registration.' });
            }
        }
        // Send to personal email if set, otherwise fall back to system email
        const sendToEmail = user.personal_email || personal_email || user.email;
        const rawToken = crypto.randomBytes(32).toString('hex');
        resetTokenStore[rawToken] = { userId: user.id, email: user.email, expiresAt: Date.now() + 15 * 60 * 1000 };
        const resetUrl = (process.env.FRONTEND_URL || 'http://localhost:4200') + '/auth/reset-password?token=' + rawToken;
        const style0 = 'font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090f;border-radius:14px;padding:36px;color:#fff';
        const style1 = 'font-size:22px;font-weight:800;letter-spacing:2px;margin-bottom:4px';
        const style2 = 'font-size:11px;color:#00b4ff;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px';
        const style3 = 'font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;margin-bottom:24px';
        const style4 = 'display:inline-block;padding:13px 32px;background:linear-gradient(135deg,#0070cc,#00b4ff);border-radius:8px;color:#fff;text-decoration:none;font-weight:700;font-size:14px';
        const style5 = 'font-size:12px;color:rgba(255,255,255,0.3);margin-top:28px';
        const html = '<div style=' + style0 + '>'
            + '<h1 style=' + style1 + '>SmartShelfX</h1>'
            + '<p style=' + style2 + '>AI-POWERED INVENTORY</p>'
            + '<h2>Password Reset Request</h2>'
            + '<p style=' + style3 + '>Hi ' + user.name + ', we received a request to reset your SmartShelfX password. This link expires in 15 minutes.</p>'
            + '<a href=' + resetUrl + ' style=' + style4 + '>Reset My Password</a>'
            + '<p style=' + style5 + '>If you did not request this, safely ignore this email.</p>'
            + '</div>';
        await sendForgotPasswordEmail({ toEmail: sendToEmail, toName: user.name, resetUrl, systemEmail: user.email });
        return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    } catch (err) {
        console.error('[FORGOT-PW]', err);
        return res.status(500).json({ error: 'Failed to send reset email. Check SMTP_USER and SMTP_PASS in .env' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, email, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
        const entry = resetTokenStore[token];
        if (!entry) return res.status(400).json({ error: 'Invalid or expired reset link' });
        if (Date.now() > entry.expiresAt) { delete resetTokenStore[token]; return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' }); }
        if (email && email.toLowerCase().trim() !== entry.email.toLowerCase()) return res.status(400).json({ error: 'Email does not match the reset request' });
        if (!PW_REGEX.test(password)) return res.status(400).json({ error: 'Password must be 8+ chars with uppercase, lowercase, number and @/#/_' });
        await User.update({ password: await bcrypt.hash(password, 10) }, { where: { id: entry.userId } });
        delete resetTokenStore[token];
        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('[RESET-PW]', err);
        return res.status(500).json({ error: 'Reset failed: ' + err.message });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'username', 'email', 'role', 'createdAt'] });
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json(user);
    } catch (err) { return res.status(500).json({ error: err.message }); }
});

router.get('/users', authenticate, async (req, res) => {
    try {
        const users = await User.findAll({ attributes: ['id', 'name', 'username', 'email', 'personal_email', 'role', 'password', 'createdAt'], order: [['name', 'ASC']] });
        // Map password field to password_hash for frontend display
        const mapped = users.map(u => ({ ...u.toJSON(), password_hash: u.password }));
        return res.json(mapped);
    } catch (err) { return res.status(500).json({ error: err.message }); }
});

// POST /auth/admin-reset-password — Admin resets any user's password
router.post('/admin-reset-password', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
        const { userId, newPassword } = req.body;
        if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword required' });
        if (!PW_REGEX.test(newPassword)) return res.status(400).json({ error: 'Password must be 8+ chars with uppercase, lowercase, number and @#_' });
        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await user.update({ password: await bcrypt.hash(newPassword, 10) });
        return res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Reset failed: ' + err.message });
    }
});

// DELETE /auth/users/:id — Admin deletes a user
router.delete('/users/:id', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'ADMIN') return res.status(400).json({ error: 'Cannot delete an Admin account' });
        if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
        await user.destroy();
        return res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Delete failed: ' + err.message });
    }
});

module.exports = router;