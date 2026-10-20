import express from 'express';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { Plan } from '../models/Plan.js';
import { LicenseCode } from '../models/LicenseCode.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { PlatformActivity } from '../models/PlatformActivity.js';
import { SubscriptionInvoice } from '../models/SubscriptionInvoice.js';
import { signToken, getSubscriptionInfo } from '../middleware/auth.js';
import { sendTenantWelcomeEmail } from '../utils/email.js';

export const publicRouter = express.Router();

const toPublicPlan = (p) => ({
  id: p.id,
  name: p.name,
  price: p.price,
  maxDoctors: p.maxDoctors,
  maxReceptionists: p.maxReceptionists,
  maxPharmacists: p.maxPharmacists,
  maxStorage: p.maxStorage,
  durationMonths: p.durationMonths
});

const getSettings = async () => (await SystemSetting.findOne({}).lean()) || {};

// Pricing plans for the landing page and registration form
publicRouter.get('/plans', async (req, res) => {
  try {
    const plans = await Plan.find({}).sort({ price: 1 }).lean();
    res.json(plans.map(toPublicPlan));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Non-sensitive platform settings needed before sign-in
publicRouter.get('/config', async (req, res) => {
  try {
    const s = await getSettings();
    res.json({
      platformName: s.platformName || 'Smart Hospital Management Software',
      supportEmail: s.supportEmail || '',
      maintenanceMode: !!s.maintenanceMode,
      allowSelfSignup: s.allowSelfSignup !== false,
      trialDays: s.trialDays || 14
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Registration throttle: max 5 sign-ups per IP per hour
const signupAttempts = new Map();
const isSignupThrottled = (ip) => {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const recent = (signupAttempts.get(ip) || []).filter(t => now - t < windowMs);
  if (recent.length >= 5) {
    signupAttempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  signupAttempts.set(ip, recent);
  return false;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateTrialCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let salt = '';
  for (const b of bytes) salt += chars[b % chars.length];
  return `TRIAL-${new Date().getFullYear()}-${salt}`;
};

const addMonths = (months) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Self-service hospital registration.
// Without a license code the hospital starts a free trial; with an unused license code it is activated on that paid plan.
publicRouter.post('/register', async (req, res) => {
  const {
    hospitalName, adminName, email, password, phone, address, city, planId, licenseCode
  } = req.body || {};

  try {
    const settings = await getSettings();
    const usingLicense = typeof licenseCode === 'string' && licenseCode.trim() !== '';

    if (!usingLicense && settings.allowSelfSignup === false) {
      return res.status(403).json({ message: 'Free trial sign-up is currently disabled. Please contact sales for a license code.' });
    }

    const cleanEmail = String(email || '').toLowerCase().trim();
    const errors = [];
    if (!hospitalName || String(hospitalName).trim().length < 3) errors.push('Hospital name must be at least 3 characters.');
    if (!adminName || String(adminName).trim().length < 2) errors.push('Administrator name is required.');
    if (!EMAIL_RE.test(cleanEmail)) errors.push('A valid email address is required.');
    if (!password || String(password).length < 8) errors.push('Password must be at least 8 characters.');
    if (!phone || String(phone).replace(/\D/g, '').length < 10) errors.push('A valid 10-digit phone number is required.');
    if (!address || String(address).trim().length < 5) errors.push('Hospital address is required.');
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    if (isSignupThrottled(req.ip)) {
      return res.status(429).json({ message: 'Too many registrations from this network. Please try again in an hour.' });
    }

    const existingUser = await User.findOne({ $or: [{ email: cleanEmail }, { email: String(email).trim() }] });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists. Please sign in instead.' });
    }

    let plan;
    let license;
    let expiryDate;
    let isTrial;

    if (usingLicense) {
      const code = licenseCode.trim();
      license = await LicenseCode.findOne({ code: { $in: [code, code.toUpperCase()] } });
      if (!license) return res.status(400).json({ message: 'Invalid license code. Please check the code shared by our team.' });
      if (license.isUsed) return res.status(400).json({ message: 'This license code has already been activated.' });
      if (license.status === 'Expired') return res.status(400).json({ message: 'This license code has been revoked or expired.' });
      plan = await Plan.findOne({ id: license.planId }).lean();
      if (!plan) return res.status(400).json({ message: 'The plan linked to this license is no longer available.' });
      expiryDate = addMonths(license.validityMonths || plan.durationMonths || 12);
      isTrial = false;
    } else {
      const targetPlanId = planId || settings.trialPlanId;
      plan = (targetPlanId && await Plan.findOne({ id: targetPlanId }).lean())
        || await Plan.findOne({}).sort({ price: 1 }).lean();
      if (!plan) return res.status(503).json({ message: 'No subscription plans are configured yet. Please contact support.' });

      let code = generateTrialCode();
      while (await LicenseCode.exists({ code })) code = generateTrialCode();
      license = new LicenseCode({
        code,
        planId: plan.id,
        validityMonths: 0,
        licenseType: 'Trial',
        isUsed: false,
        status: 'Unused'
      });
      expiryDate = addDays(settings.trialDays || 14);
      isTrial = true;
    }

    const tenant = new Tenant({
      hospitalName: String(hospitalName).trim(),
      adminEmail: cleanEmail,
      adminPersonalEmail: cleanEmail,
      adminPhone: String(phone).trim(),
      address: [String(address).trim(), city ? String(city).trim() : ''].filter(Boolean).join(', '),
      licenseCodeUsed: license.code,
      subscriptionExpiryDate: expiryDate,
      planId: plan.id,
      status: 'Active',
      isTrial,
      signupSource: usingLicense ? 'license-activation' : 'self-signup'
    });
    await tenant.save();

    let adminUser;
    try {
      adminUser = new User({
        name: String(adminName).trim(),
        email: cleanEmail,
        personalEmail: cleanEmail,
        password: String(password),
        role: 'HOSPITAL_ADMIN',
        hospitalId: tenant._id.toString(),
        isActivated: true
      });
      await adminUser.save();
    } catch (err) {
      await Tenant.findByIdAndDelete(tenant._id);
      throw err;
    }

    license.isUsed = true;
    license.status = 'Used';
    license.activatedByHospitalId = tenant._id.toString();
    await license.save();

    if (usingLicense) {
      await SubscriptionInvoice.create({
        hospitalName: tenant.hospitalName,
        hospitalId: tenant._id.toString(),
        planName: plan.name,
        amount: plan.price,
        method: 'Manual Invoice',
        status: 'Paid',
        date: new Date().toISOString().split('T')[0]
      });
    }

    await PlatformActivity.create({
      description: usingLicense
        ? `Hospital "${tenant.hospitalName}" self-activated with license ${license.code} on "${plan.name}".`
        : `New free-trial sign-up: "${tenant.hospitalName}" on "${plan.name}" (trial ends ${expiryDate}).`,
      type: 'hospital',
      timestamp: new Date().toISOString()
    });

    sendTenantWelcomeEmail({
      toEmail: cleanEmail,
      hospitalName: tenant.hospitalName,
      adminUsername: cleanEmail,
      adminPassword: '(the password you chose during registration)',
      accessCode: license.code,
      planName: isTrial ? `${plan.name} — Free Trial` : plan.name,
      subscriptionExpiryDate: expiryDate,
      maxDoctors: plan.maxDoctors,
      maxReceptionists: plan.maxReceptionists,
      maxPharmacists: plan.maxPharmacists,
      maxStorage: plan.maxStorage
    }).catch(err => console.error('Failed to dispatch registration welcome email:', err));

    res.status(201).json({
      token: signToken(adminUser),
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        hospitalId: adminUser.hospitalId
      },
      hospital: {
        id: tenant._id.toString(),
        hospitalName: tenant.hospitalName,
        accessCode: license.code,
        planName: plan.name
      },
      subscription: getSubscriptionInfo(tenant)
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'An account with these details already exists.' });
    }
    res.status(500).json({ message: error.message || 'Registration failed. Please try again.' });
  }
});
