const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../_db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'hef-portal-secret-key';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { fullName, email, idNumber, password, userType } = req.body;

    if (!fullName || !email || !idNumber || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await query(
      'SELECT * FROM users WHERE email = $1 OR id_number = $2',
      [email, idNumber]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = Date.now().toString();

    await query(
      `INSERT INTO users (id, email, id_number, full_name, password, user_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newUserId, email, idNumber, fullName, hashedPassword, userType || 'applicant', new Date().toISOString()]
    );

    const token = jwt.sign(
      { userId: newUserId, email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUserId,
        email,
        fullName,
        idNumber
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};