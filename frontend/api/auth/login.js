const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../_db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'hef-portal-secret-key';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { identifier, password, rememberMe, autoRegister } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/ID and password are required' });
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1 OR id_number = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      if (autoRegister) {
        const isEmail = identifier.includes('@');
        const email = isEmail ? identifier : `${identifier}@hefportal.local`;
        const idNumber = isEmail ? `AUTO-${Date.now()}` : identifier;
        const fullName = isEmail ? identifier.split('@')[0] : `User ${identifier}`;

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = Date.now().toString();

        await query(
          `INSERT INTO users (id, email, id_number, full_name, password, user_type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [newUserId, email, idNumber, fullName, hashedPassword, 'applicant', new Date().toISOString()]
        );

        const token = jwt.sign(
          { userId: newUserId, email },
          JWT_SECRET,
          { expiresIn: rememberMe ? '30d' : '1d' }
        );

        return res.json({
          token,
          user: {
            id: newUserId,
            email,
            fullName,
            idNumber
          },
          autoRegistered: true
        });
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: rememberMe ? '30d' : '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        idNumber: user.id_number
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};