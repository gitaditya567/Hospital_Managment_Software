import express from 'express';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { 
  sendPasswordResetEmail, 
  sendHospitalAdminAlertEmail, 
  sendPlatformSuperAdminAlertEmail,
  sendHospitalAdminResetSuperAdminAlert
} from '../utils/email.js';
import { signToken, getSubscriptionInfo, isMaintenanceMode, requireAuth } from '../middleware/auth.js';

export const authRouter = express.Router();

// In-memory rate limiting store for failed login attempts (3 attempts -> 5 min lockout)
const loginAttempts = new Map();

function formatRemainingTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

authRouter.post('/login', async (req, res) => {
  const { email, password, code, role: selectedRole } = req.body || {};
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const clientKey = `${clientIp}_${(email || '').toLowerCase().trim()}`;

  // 1. Check if client is currently locked out
  const attempt = loginAttempts.get(clientKey) || { count: 0, lockoutUntil: null };
  if (attempt.lockoutUntil && Date.now() < attempt.lockoutUntil) {
    const remainingMs = attempt.lockoutUntil - Date.now();
    return res.status(429).json({
      message: `Security Lockout Alert: Maximum 3 failed login attempts reached. For security, please wait 5 minutes before trying again to ensure accurate data entry.`,
      lockoutUntil: attempt.lockoutUntil,
      failedAttempts: 3
    });
  }

  // Reset expired lockout
  if (attempt.lockoutUntil && Date.now() >= attempt.lockoutUntil) {
    loginAttempts.delete(clientKey);
  }

  const recordFailedAttempt = (baseMsg) => {
    const current = loginAttempts.get(clientKey) || { count: 0, lockoutUntil: null };
    const newCount = current.count + 1;
    
    if (newCount >= 3) {
      const lockoutUntil = Date.now() + 5 * 60 * 1000; // 5 minutes lockout
      loginAttempts.set(clientKey, { count: newCount, lockoutUntil });
      return {
        status: 429,
        data: {
          message: `Security Lockout Alert: Maximum 3 failed login attempts reached. For security, please wait 5 minutes before trying again to ensure accurate data entry.`,
          lockoutUntil,
          failedAttempts: 3
        }
      };
    } else {
      loginAttempts.set(clientKey, { count: newCount, lockoutUntil: null });
      const remainingAttempts = 3 - newCount;
      return {
        status: 401,
        data: {
          message: `${baseMsg} (Attempt ${newCount} of 3 - Warning: ${remainingAttempts} attempt(s) remaining before 5-minute security lockout)`,
          failedAttempts: newCount,
          remainingAttempts
        }
      };
    }
  };

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const rawEmail = String(email).trim();
    const user = await User.findOne({ email: { $in: [rawEmail, rawEmail.toLowerCase()] } });
    if (!user) {
      const failure = recordFailedAttempt('Invalid credentials. User profile not found.');
      return res.status(failure.status).json(failure.data);
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const failure = recordFailedAttempt('Invalid password. Access denied.');
      return res.status(failure.status).json(failure.data);
    }

    // Role Validation: Check if selected role matches user's actual role
    if (selectedRole && user.role !== selectedRole) {
      const formatRole = (r) => r.replace('_', ' ');
      const failure = recordFailedAttempt(`Role Mismatch Alert: Credentials belong to a "${formatRole(user.role)}" profile, but you selected "${formatRole(selectedRole)}".`);
      return res.status(403).json({
        ...failure.data,
        message: `${failure.data.message} Please select the correct role.`
      });
    }

    // Check if maintenance mode is active (Except for SUPER_ADMIN)
    if (user.role !== 'SUPER_ADMIN') {
      if (await isMaintenanceMode()) {
        return res.status(503).json({ 
          message: 'System is under maintenance. Access restricted to Super Admins only.' 
        });
      }
    }

    let subscription = null;

    // Three-Factor Validation: All roles except SUPER_ADMIN must activate terminal on first-time login
    if (user.role !== 'SUPER_ADMIN') {
      if (!user.hospitalId) {
        return res.status(400).json({ message: 'User profile is not assigned to any hospital node.' });
      }

      let tenant = null;
      try {
        tenant = await Tenant.findById(user.hospitalId);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid hospital node reference format.' });
      }

      if (!tenant) {
        return res.status(404).json({ message: 'Associated hospital node registration not found.' });
      }

      // Enforce active status (Kill Switch!)
      if (tenant.status !== 'Active') {
        return res.status(403).json({ 
          message: `Access Denied: Your hospital node is currently "${tenant.status}". Please contact Platform Operator.` 
        });
      }

      // Expired subscription: only the hospital admin may sign in (to renew)
      subscription = getSubscriptionInfo(tenant);
      if (subscription && subscription.expired && user.role !== 'HOSPITAL_ADMIN') {
        return res.status(402).json({
          code: 'SUBSCRIPTION_EXPIRED',
          message: `Your hospital subscription expired on ${subscription.expiryDate}. Please ask your hospital administrator to renew the plan.`
        });
      }

      // Enforce Access Code ONLY for first-time activation
      if (!user.isActivated) {
        if (!code) {
          return res.status(400).json({ message: 'Hospital Access Code is required for first-time login activation.' });
        }

        // Verify that the code matches the hospital's licenseCodeUsed
        if (!tenant.licenseCodeUsed || tenant.licenseCodeUsed.toUpperCase().trim() !== code.toUpperCase().trim()) {
          const failure = recordFailedAttempt('Invalid Access Code. Terminal activation failed.');
          return res.status(failure.status).json(failure.data);
        }

        // Activate the user for subsequent logins
        user.isActivated = true;
        await user.save();
      }
    }

    // Login successful - Clear failed attempt counter
    loginAttempts.delete(clientKey);

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId
      },
      subscription
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error during authentication.' });
  }
});

// Current session details (used by the client to validate a stored token)
authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user, subscription: req.subscription || null });
});

// Signed-in users can change their own password
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }
    const user = await User.findById(req.user.id);
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    user.password = String(newPassword);
    await user.save();
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

authRouter.get('/hospital-status/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: 'Hospital node not found.' });
    }
    res.json({ status: tenant.status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Secure Credential Recovery & Self-Service Password Reset
authRouter.post('/recover-credentials', async (req, res) => {
  const { email, role, accessCode, newPassword } = req.body || {};
  try {
    if (!email || !role) {
      return res.status(400).json({ message: 'Email address and account role are required for identity verification.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [
        { email: cleanEmail },
        { personalEmail: cleanEmail }
      ]
    });

    if (!user || user.role !== role) {
      return res.status(404).json({ message: 'No matching account found with the provided email/username and role.' });
    }

    // Staff identity verification: Check license access code
    if (user.role !== 'SUPER_ADMIN') {
      if (!accessCode) {
        return res.status(400).json({ message: 'Hospital Access Code is required to verify staff identity.' });
      }

      if (!user.hospitalId) {
        return res.status(400).json({ message: 'Account is not linked to any hospital tenant.' });
      }

      let tenant = null;
      try {
        tenant = await Tenant.findById(user.hospitalId);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid tenant reference format.' });
      }

      if (!tenant || !tenant.licenseCodeUsed || tenant.licenseCodeUsed.toUpperCase().trim() !== accessCode.toUpperCase().trim()) {
        return res.status(401).json({ message: 'Hospital Access Code verification failed. Identity could not be confirmed.' });
      }
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    // Set new password (User model pre-save hook automatically hashes with bcrypt)
    user.password = newPassword;
    await user.save();

    // Fetch tenant details for hospital name, license code, and admin email
    let tenantName = 'Platform Core';
    let hospitalAdminEmail = null;
    let tenantLicenseCode = null;
    let tenantPersonalEmail = null;

    if (user.hospitalId) {
      try {
        const tenant = await Tenant.findById(user.hospitalId);
        if (tenant) {
          tenantName = tenant.hospitalName;
          tenantLicenseCode = tenant.licenseCodeUsed;
          tenantPersonalEmail = tenant.adminPersonalEmail;
          hospitalAdminEmail = (tenant.adminPersonalEmail && tenant.adminPersonalEmail.trim() !== '')
            ? tenant.adminPersonalEmail.trim()
            : tenant.adminEmail;
        }
      } catch (e) {
        console.error('Could not fetch tenant details for email alert', e);
      }
    }

    // Determine target recipient email: Preference is personalEmail if present, otherwise email
    const targetRecipient = (user.personalEmail && user.personalEmail.trim() !== '') 
      ? user.personalEmail.trim() 
      : user.email;

    // 1. Dispatch SMTP credential email notification to the Target User's Personal Email Inbox!
    const emailResult = await sendPasswordResetEmail({
      toEmail: targetRecipient,
      userName: user.name || 'MediSaaS User',
      userRole: user.role,
      newPassword: newPassword
    });

    // 2. Dispatch Security Alert email to Hospital Admin (if staff member reset password)
    if (hospitalAdminEmail && user.role !== 'HOSPITAL_ADMIN') {
      sendHospitalAdminAlertEmail({
        hospitalAdminEmail,
        staffName: user.name || 'Staff Member',
        staffEmail: user.email,
        staffRole: user.role,
        hospitalName: tenantName
      }).catch(err => console.error('Failed to send hospital admin alert:', err));
    }

    // 3. Dispatch Critical Security Alert email to Super Admin (olavel567@gmail.com) when a Hospital Admin resets password
    if (user.role === 'HOSPITAL_ADMIN') {
      sendHospitalAdminResetSuperAdminAlert({
        superAdminEmail: process.env.ADMIN_EMAIL || 'olavel567@gmail.com',
        hospitalName: tenantName,
        adminName: user.name || 'Hospital Admin',
        adminUsername: user.email,
        adminPersonalEmail: user.personalEmail || tenantPersonalEmail,
        licenseCode: tenantLicenseCode
      }).catch(err => console.error('Failed to send hospital admin reset super admin alert:', err));
    } else {
      // General Audit Alert to Super Admin for other roles
      sendPlatformSuperAdminAlertEmail({
        superAdminEmail: process.env.ADMIN_EMAIL || 'olavel567@gmail.com',
        userName: user.name || 'MediSaaS User',
        userEmail: user.email,
        userRole: user.role,
        hospitalName: tenantName
      }).catch(err => console.error('Failed to send super admin alert:', err));
    }

    return res.json({
      success: true,
      emailSent: emailResult.sent,
      emailMethod: emailResult.method,
      message: `Identity verified! Password updated for ${user.email}. Multi-recipient security emails dispatched.`
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error during credential recovery.' });
  }
});

authRouter.get('/maintenance-status', async (req, res) => {
  try {
    res.json({ maintenanceMode: await isMaintenanceMode() });
  } catch (error) {
    res.json({ maintenanceMode: false });
  }
});



