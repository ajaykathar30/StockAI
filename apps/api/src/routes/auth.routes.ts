import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { env } from '../config/env';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(['DEMO_ANALYST', 'INVENTORY_MANAGER', 'ADMIN']).optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      email: data.email.toLowerCase(),
      passwordHash,
      fullName: data.fullName,
      role: data.role || 'INVENTORY_MANAGER'
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      env.SESSION_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('qs_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization
      },
      token
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      env.SESSION_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('qs_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: user.organization
      },
      token
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Login failed' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.qs_token || req.headers.authorization?.replace(/^Bearer\s+/, '');

  if (token) {
    try {
      const decoded = jwt.verify(token, env.SESSION_SECRET) as any;
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (user) {
        return res.json({
          success: true,
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            organization: user.organization
          }
        });
      }
    } catch (e) {
      // Token invalid or expired
    }
  }

  // If in demo mode, provide automatic default guest analyst session
  if (env.DEMO_MODE) {
    return res.json({
      success: true,
      user: {
        id: 'demo_analyst_001',
        email: 'analyst@quickstock.local',
        fullName: 'Quick-Commerce Inventory Analyst',
        role: 'INVENTORY_MANAGER',
        organization: 'IIIT Academic Prototype'
      }
    });
  }

  res.status(401).json({ success: false, error: 'Not authenticated' });
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('qs_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
