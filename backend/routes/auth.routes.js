const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, username, email, password, role } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Email is required' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const existingEmail = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        if (existingEmail) {
            return res.status(409).json({ error: 'Email is already registered' });
        }

        if (username && username.trim()) {
            const existingUsername = await User.findOne({ where: { username: username.trim() } });
            if (existingUsername) {
                return res.status(409).json({ error: 'Username is already taken' });
            }
        }

        const validRoles = ['ADMIN', 'MANAGER', 'VENDOR'];
        const assignedRole = validRoles.includes(role) ? role : 'MANAGER';

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: name.trim(),
            username: username && username.trim() ? username.trim() : null,
            email: email.toLowerCase().trim(),
            password: hashed,
            role: assignedRole
        });

        return res.status(201).json({ success: true, userId: user.id });

    } catch (err) {
        console.error('[REGISTER ERROR]', err);

        if (err.name === 'SequelizeUniqueConstraintError') {
            const field = err.errors?.[0]?.path || 'field';
            return res.status(409).json({ error: `${field} is already in use` });
        }
        if (err.name === 'SequelizeValidationError') {
            return res.status(400).json({ error: err.errors?.[0]?.message || 'Validation error' });
        }

        return res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        if (!user) {
            return res.status(401).json({ error: 'No account found with this email' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        return res.json({
            token,
            userId: user.id,
            name: user.name,
            role: user.role,
            email: user.email
        });

    } catch (err) {
        console.error('[LOGIN ERROR]', err);
        return res.status(500).json({ error: 'Login failed: ' + err.message });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'name', 'username', 'email', 'role', 'createdAt']
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json(user);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/users', authenticate, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'username', 'email', 'role'],
            order: [['name', 'ASC']]
        });
        return res.json(users);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;