import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { SystemSetting } from '../models/SystemSetting.js';

export const getJwtSecret = () => process.env.JWT_SECRET || 'medisaas_secret_key_12345';

export const signToken = (user) => jwt.sign(
  { id: user._id, role: user.role, hospitalId: user.hospitalId },
  getJwtSecret(),
  { expiresIn: '30d' }
);

// Subscription helpers shared by login, registration and the auth guard
export const getSubscriptionInfo = (tenant) => {
  if (!tenant || !tenant.subscriptionExpiryDate) return null;
  // Calendar days until the expiry date; the subscription stays valid through the expiry date itself
  const expiry = new Date(`${tenant.subscriptionExpiryDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return {
    expiryDate: tenant.subscriptionExpiryDate,
    daysLeft,
    expired: Number.isFinite(daysLeft) ? daysLeft < 0 : false,
    isTrial: !!tenant.isTrial,
    planId: tenant.planId
  };
};

// Short-lived cache so the maintenance flag is not read from MongoDB on every request
let maintenanceCache = { value: false, fetchedAt: 0 };
export const isMaintenanceMode = async () => {
  if (Date.now() - maintenanceCache.fetchedAt < 5000) return maintenanceCache.value;
  const settings = await SystemSetting.findOne({}).lean();
  maintenanceCache = { value: !!(settings && settings.maintenanceMode), fetchedAt: Date.now() };
  return maintenanceCache.value;
};
export const clearMaintenanceCache = () => { maintenanceCache.fetchedAt = 0; };

// Verifies the bearer token, reloads the user and pins every request to the caller's own hospital
export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in again.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (err) {
    return res.status(401).json({ code: 'AUTH_INVALID', message: 'Session expired or invalid. Please sign in again.' });
  }

  try {
    if (!payload.id || !mongoose.Types.ObjectId.isValid(payload.id)) {
      return res.status(401).json({ code: 'AUTH_INVALID', message: 'Session expired or invalid. Please sign in again.' });
    }
    const user = await User.findById(payload.id).select('-password').lean();
    if (!user) {
      return res.status(401).json({ code: 'AUTH_INVALID', message: 'Account no longer exists. Please contact your administrator.' });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId
    };

    if (user.role !== 'SUPER_ADMIN') {
      if (!user.hospitalId || !mongoose.Types.ObjectId.isValid(user.hospitalId)) {
        return res.status(403).json({ code: 'NO_TENANT', message: 'Account is not linked to a hospital.' });
      }
      const tenant = await Tenant.findById(user.hospitalId).lean();
      if (!tenant) {
        return res.status(403).json({ code: 'NO_TENANT', message: 'Associated hospital registration not found.' });
      }
      if (tenant.status === 'Suspended') {
        return res.status(403).json({ code: 'TENANT_SUSPENDED', message: 'Your hospital account is suspended. Please contact the platform operator.' });
      }
      if (await isMaintenanceMode()) {
        return res.status(503).json({ code: 'MAINTENANCE', message: 'System is under maintenance. Please try again shortly.' });
      }

      req.tenant = tenant;
      req.subscription = getSubscriptionInfo(tenant);

      // Tenant isolation: whatever hospitalId the client sends, use the caller's own
      req.hospitalId = user.hospitalId;
      if (req.query && typeof req.query === 'object') req.query.hospitalId = user.hospitalId;
      if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) req.body.hospitalId = user.hospitalId;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' });
  }
  next();
};

// Expired subscriptions: hospital admins keep read access and can renew; everyone else is blocked
export const requireActiveSubscription = (req, res, next) => {
  if (!req.subscription || !req.subscription.expired) return next();
  const isAdmin = req.user && req.user.role === 'HOSPITAL_ADMIN';
  const allowedForAdmin = req.method === 'GET' || req.path === '/renew-subscription' || req.path === '/profile';
  if (isAdmin && allowedForAdmin) return next();
  return res.status(402).json({
    code: 'SUBSCRIPTION_EXPIRED',
    message: `Your hospital subscription expired on ${req.subscription.expiryDate}. Please ask your hospital administrator to renew the plan.`
  });
};
