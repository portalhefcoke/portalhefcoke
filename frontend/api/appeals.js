const jwt = require('jsonwebtoken');
const { query } = require('../_db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'hef-portal-secret-key';

function authMiddleware(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = async (req, res) => {
  const decoded = authMiddleware(req, res);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (req.method === 'POST') {
    try {
      const { institution, course, yearOfStudy, admissionNumber, appealReason, supportingDocuments } = req.body;

      if (!institution || !course || !yearOfStudy || !admissionNumber || !appealReason) {
        return res.status(400).json({ message: 'All required fields must be filled' });
      }

      const userResult = await query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const newAppeal = {
        id: Date.now().toString(),
        userId: decoded.userId,
        institution,
        course,
        yearOfStudy,
        admissionNumber,
        appealReason,
        supportingDocuments: supportingDocuments || [],
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await query(
        `INSERT INTO appeals (id, user_id, institution, course, year_of_study, admission_number, appeal_reason, supporting_documents, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [newAppeal.id, newAppeal.userId, newAppeal.institution, newAppeal.course, newAppeal.yearOfStudy,
         newAppeal.admissionNumber, newAppeal.appealReason, JSON.stringify(newAppeal.supportingDocuments),
         newAppeal.status, newAppeal.createdAt]
      );

      res.status(201).json({
        message: 'Appeal submitted successfully',
        appeal: newAppeal
      });
    } catch (error) {
      console.error('Appeal submission error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  } else if (req.method === 'GET') {
    try {
      const result = await query(
        'SELECT * FROM appeals WHERE user_id = $1 ORDER BY created_at DESC',
        [decoded.userId]
      );

      const appeals = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        institution: row.institution,
        course: row.course,
        yearOfStudy: row.year_of_study,
        admissionNumber: row.admission_number,
        appealReason: row.appeal_reason,
        supportingDocuments: row.supporting_documents,
        status: row.status,
        createdAt: row.created_at
      }));

      res.json({ appeals });
    } catch (error) {
      console.error('Get appeals error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
};