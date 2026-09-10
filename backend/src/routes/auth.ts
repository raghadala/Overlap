import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import pool from '../db/pool';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/signup', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

    const passwordIsValid = /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  if (!passwordIsValid) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and include one uppercase letter and one number',
    });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, passwordHash]
  );

  const user = result.rows[0];
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '30d' });

  res.status(201).json({ token, user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password as string, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '30d' });

  res.json({ token, user: { id: user.id, email: user.email } });
});

router.post('/google', async (req, res) => {
  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Google token' });
  }

  if (!payload?.sub || !payload.email) {
    return res.status(401).json({ error: 'Google token did not include the expected profile info' });
  }

  const googleId = payload.sub;
  const email = payload.email;

  // match an existing account by google_id first, then by email in case
  // someone previously signed up with a password using the same address.
  const existing = await pool.query(
    'SELECT id, email FROM users WHERE google_id = $1 OR email = $2',
    [googleId, email]
  );

  let user = existing.rows[0];

  if (!user) {
    const inserted = await pool.query(
      'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id, email',
      [email, googleId]
    );
    user = inserted.rows[0];
  } else {
    await pool.query('UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL', [googleId, user.id]);
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '30d' });

  res.json({ token, user });
});

export default router;
