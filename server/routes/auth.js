import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';

export const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { email, password, code } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. User profile not found.' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password. Access denied.' });
    }

    // Three-Factor Validation: All roles except SUPER_ADMIN must activate terminal on first-time login
    if (user.role !== 'SUPER_ADMIN') {
      // Check if there is a Tenant document for this user's hospitalId
      const tenant = await Tenant.findById(user.hospitalId);
      if (!tenant) {
        return res.status(404).json({ message: 'Associated hospital node registration not found.' });
      }

      // Enforce active status (Kill Switch!)
      if (tenant.status !== 'Active') {
        return res.status(403).json({ 
          message: `Access Denied: Your hospital node is currently "${tenant.status}". Please contact Platform Operator.` 
        });
      }

      // Enforce Access Code ONLY for first-time activation
      if (!user.isActivated) {
        if (!code) {
          return res.status(400).json({ message: 'Hospital Access Code is required for first-time login activation.' });
        }

        // Verify that the code matches the hospital's licenseCodeUsed
        if (tenant.licenseCodeUsed.toUpperCase().trim() !== code.toUpperCase().trim()) {
          return res.status(401).json({ message: 'Invalid Access Code. Terminal activation failed.' });
        }

        // Activate the user for subsequent logins
        user.isActivated = true;
        await user.save();
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, hospitalId: user.hospitalId },
      process.env.JWT_SECRET || 'medisaas_secret_key_12345',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId
      }
    });
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



