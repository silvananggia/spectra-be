const { db } = require('../db');
const logger = require('../utils/logger');

/**
 * Middleware to check if user is authenticated
 * This is a placeholder - implement proper JWT/auth logic as needed
 */
async function requireAuth(req, res, next) {
  try {
    // TODO: Implement proper JWT token validation
    // For now, check for admin role in headers or session
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify user exists and has admin role
    const user = await db('users')
      .join('user_roles', 'users.id', 'user_roles.user_id')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('users.id', userId)
      .where('roles.name', 'admin')
      .first();

    if (!user) {
      logger.warn(`Unauthorized access attempt by user ${userId}`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = { id: userId, role: 'admin' };
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware to check if user has admin role
 */
async function requireAdmin(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db('users')
      .join('user_roles', 'users.id', 'user_roles.user_id')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('users.id', userId)
      .where('roles.name', 'admin')
      .first();

    if (!user) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Authorization error' });
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
};

