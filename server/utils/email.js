import nodemailer from 'nodemailer';

/**
 * Creates and returns a Nodemailer Transporter instance based on .env config
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host: host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
  }

  return null;
}

/**
 * 1. Sends full credential email with username & new password to the Target User
 */
export async function sendPasswordResetEmail({ toEmail, userName, userRole, newPassword }) {
  const transporter = createTransporter();

  const formattedRole = (userRole || 'USER').replace(/_/g, ' ');
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173/';
  const fromAddress = process.env.FROM_EMAIL || '"Smart Hospital Management Gateway" <support@twinscloud.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #334155; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 25px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .header p { margin: 4px 0 0 0; font-size: 11px; opacity: 0.9; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 25px; }
        .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .card { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin: 18px 0; }
        .field { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; }
        .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { color: #64748b; font-weight: 600; }
        .value { color: #0f172a; font-weight: 700; font-family: monospace; }
        .pass-highlight { background-color: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 6px; font-size: 14px; }
        .btn-container { text-align: center; margin-top: 22px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); color: #ffffff !important; text-decoration: none; padding: 11px 26px; font-weight: 700; font-size: 13px; border-radius: 30px; }
        .footer { background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✚ Smart Hospital Management</h1>
          <p>Account Credential Reset Notice</p>
        </div>
        <div class="content">
          <div class="greeting">Hello ${userName},</div>
          <p style="font-size: 13px; line-height: 1.5; color: #475569;">
            Your account password has been updated successfully. Below are your active access credentials:
          </p>

          <div class="card">
            <div class="field">
              <span class="label">Account Holder:</span>
              <span class="value">${userName}</span>
            </div>
            <div class="field">
              <span class="label">Email Username:</span>
              <span class="value">${toEmail}</span>
            </div>
            <div class="field">
              <span class="label">System Role:</span>
              <span class="value">${formattedRole}</span>
            </div>
            <div class="field">
              <span class="label">Updated Password:</span>
              <span class="value pass-highlight">${newPassword}</span>
            </div>
          </div>

          <p style="font-size: 11px; color: #e11d48; font-weight: 600;">
            🔒 Security Notice: Please log in and keep your credentials confidential.
          </p>

          <div class="btn-container">
            <a href="${loginUrl}" class="btn">Sign In to MediSaaS Terminal</a>
          </div>
        </div>
        <div class="footer">
          Smart Hospital Management Software • Copyright © twinsCloud • Automated Security Notification
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: '🔑 Your MediSaaS Account Credentials & Updated Password',
    html: htmlContent
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 [USER MAIL SENT] Delivered to Target User ${toEmail}. MessageId: ${info.messageId}`);
      return { sent: true, method: 'SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [USER MAIL FAIL] Failed to send email to ${toEmail}: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
  return { sent: true, method: 'SIMULATED' };
}

/**
 * 2. Sends Security Alert Email to Hospital Administrator
 */
export async function sendHospitalAdminAlertEmail({ hospitalAdminEmail, staffName, staffEmail, staffRole, hospitalName }) {
  if (!hospitalAdminEmail) return;

  const transporter = createTransporter();
  const formattedRole = (staffRole || 'STAFF').replace(/_/g, ' ');
  const fromAddress = process.env.FROM_EMAIL || '"Smart Hospital Management Gateway" <support@twinscloud.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #334155; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 22px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
        .content { padding: 25px; }
        .alert-badge { display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-bottom: 12px; }
        .card { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin: 15px 0; }
        .field { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; }
        .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { color: #64748b; font-weight: 600; }
        .value { color: #0f172a; font-weight: 700; }
        .footer { background-color: #f8fafc; padding: 12px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛡️ Hospital Security Alert</h1>
        </div>
        <div class="content">
          <span class="alert-badge">STAFF PASSWORD RESET DETECTED</span>
          <p style="font-size: 13px; line-height: 1.5; color: #334155;">
            Dear Hospital Administrator, a password reset was performed for a member of your hospital staff at <strong>${hospitalName || 'Your Hospital'}</strong>:
          </p>

          <div class="card">
            <div class="field">
              <span class="label">Staff Name:</span>
              <span class="value">${staffName}</span>
            </div>
            <div class="field">
              <span class="label">Staff Email Username:</span>
              <span class="value">${staffEmail}</span>
            </div>
            <div class="field">
              <span class="label">Staff Role:</span>
              <span class="value">${formattedRole}</span>
            </div>
            <div class="field">
              <span class="label">Timestamp:</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
          </div>

          <p style="font-size: 11px; color: #64748b;">
            This is an automated compliance notification for your hospital node. No action is required if this reset was authorized.
          </p>
        </div>
        <div class="footer">
          Smart Hospital Management Software • Copyright © twinsCloud • Hospital Governance
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromAddress,
    to: hospitalAdminEmail,
    subject: `🛡️ Security Alert: Staff Password Reset - ${staffName} (${formattedRole})`,
    html: htmlContent
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 [HOSPITAL ADMIN ALERT SENT] Delivered to Hospital Admin ${hospitalAdminEmail}. MessageId: ${info.messageId}`);
      return { sent: true, method: 'SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [HOSPITAL ADMIN ALERT FAIL] Failed to send alert to ${hospitalAdminEmail}: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
  return { sent: true, method: 'SIMULATED' };
}

/**
 * 3. Sends Platform Audit Alert Email to Platform Super Admin
 */
export async function sendPlatformSuperAdminAlertEmail({ superAdminEmail, userName, userEmail, userRole, hospitalName }) {
  const recipient = superAdminEmail || process.env.ADMIN_EMAIL || 'olavel567@gmail.com';
  if (!recipient) return;

  const transporter = createTransporter();
  const formattedRole = (userRole || 'USER').replace(/_/g, ' ');
  const fromAddress = process.env.FROM_EMAIL || '"Smart Hospital Management Gateway" <support@twinscloud.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
        .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 22px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
        .content { padding: 25px; }
        .audit-badge { display: inline-block; background-color: #312e81; color: #a5b4fc; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-bottom: 12px; }
        .card { background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 15px 0; }
        .field { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; border-bottom: 1px dashed #334155; padding-bottom: 6px; }
        .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { color: #94a3b8; font-weight: 600; }
        .value { color: #38bdf8; font-weight: 700; }
        .footer { background-color: #0f172a; padding: 12px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 Platform Audit Event Log</h1>
        </div>
        <div class="content">
          <span class="audit-badge">PLATFORM-WIDE CREDENTIAL RECOVERY</span>
          <p style="font-size: 13px; line-height: 1.5; color: #cbd5e1;">
            Platform Operator Audit Notice: A credential recovery event was logged across the SaaS gateway:
          </p>

          <div class="card">
            <div class="field">
              <span class="label">Target Account:</span>
              <span class="value">${userName} (${userEmail})</span>
            </div>
            <div class="field">
              <span class="label">System Role:</span>
              <span class="value">${formattedRole}</span>
            </div>
            <div class="field">
              <span class="label">Hospital Tenant Node:</span>
              <span class="value">${hospitalName || 'Platform Core (Super Admin)'}</span>
            </div>
            <div class="field">
              <span class="label">Timestamp:</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div class="footer">
          Smart Hospital Management Software • Copyright © twinsCloud • Platform Audit Trail
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromAddress,
    to: recipient,
    subject: `🚨 Platform Audit: Password Reset Event - ${userName} (${formattedRole})`,
    html: htmlContent
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 [PLATFORM SUPER ADMIN ALERT SENT] Delivered to Super Admin ${recipient}. MessageId: ${info.messageId}`);
      return { sent: true, method: 'SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [SUPER ADMIN ALERT FAIL] Failed to send alert to ${recipient}: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
  return { sent: true, method: 'SIMULATED' };
}

/**
 * 4. Sends a high-priority audit email to Super Admin when a Hospital Admin resets their password
 */
export async function sendHospitalAdminResetSuperAdminAlert({
  superAdminEmail,
  hospitalName,
  adminName,
  adminUsername,
  adminPersonalEmail,
  licenseCode
}) {
  const recipient = superAdminEmail || process.env.ADMIN_EMAIL || 'olavel567@gmail.com';
  if (!recipient) return;

  const transporter = createTransporter();
  const fromAddress = process.env.FROM_EMAIL || '"Smart Hospital Security" <support@twinscloud.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
        .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.6); border: 1px solid #dc2626; }
        .header { background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); padding: 25px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
        .content { padding: 25px; }
        .badge { display: inline-block; background-color: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 15px; }
        .card { background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin: 15px 0; }
        .field { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; border-bottom: 1px dashed #334155; padding-bottom: 6px; }
        .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { color: #94a3b8; font-weight: 600; }
        .value { color: #f8fafc; font-weight: 700; font-family: monospace; }
        .license-box { color: #38bdf8; font-weight: 800; }
        .footer { background-color: #0f172a; padding: 14px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 PLATFORM SECURITY AUDIT ALERT</h1>
        </div>
        <div class="content">
          <span class="badge">HOSPITAL ADMINISTRATOR PASSWORD RESET</span>
          <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1; margin-top: 4px;">
            Platform Operator Audit Notice: A password reset operation was performed for the <strong>Hospital Administrator</strong> of <strong>${hospitalName}</strong>:
          </p>

          <div class="card">
            <div class="field">
              <span class="label">Hospital Node Name:</span>
              <span class="value" style="font-family: inherit; color: #38bdf8;">${hospitalName}</span>
            </div>
            <div class="field">
              <span class="label">Admin Account Name:</span>
              <span class="value" style="font-family: inherit;">${adminName}</span>
            </div>
            <div class="field">
              <span class="label">Admin Login Username:</span>
              <span class="value">${adminUsername}</span>
            </div>
            <div class="field">
              <span class="label">Admin Personal Email:</span>
              <span class="value">${adminPersonalEmail || 'N/A'}</span>
            </div>
            <div class="field">
              <span class="label">Hospital Access Code:</span>
              <span class="value license-box">${licenseCode || 'N/A'}</span>
            </div>
            <div class="field">
              <span class="label">Reset Timestamp:</span>
              <span class="value" style="font-family: inherit; color: #fbbf24;">${new Date().toLocaleString()}</span>
            </div>
          </div>

          <p style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
            This audit notification was generated automatically by the MediSaaS Platform Gateway security daemon.
          </p>
        </div>
        <div class="footer">
          Smart Hospital Management Software • Copyright © twinsCloud • Governance Audit Trail
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromAddress,
    to: recipient,
    subject: `🚨 CRITICAL AUDIT: Hospital Admin Password Reset - ${hospitalName} (${adminUsername})`,
    html: htmlContent
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 [SUPER ADMIN ADMIN-RESET ALERT SENT] Delivered to Super Admin ${recipient}. MessageId: ${info.messageId}`);
      return { sent: true, method: 'SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [SUPER ADMIN ADMIN-RESET ALERT FAIL] Failed to send alert to ${recipient}: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
  return { sent: true, method: 'SIMULATED' };
}

/**
 * 5. Sends a rich Welcome & Onboarding Email to newly onboarded Hospital / Clinic Tenants
 */
export async function sendTenantWelcomeEmail({
  toEmail,
  hospitalName,
  adminUsername,
  adminPassword,
  accessCode,
  planName,
  subscriptionExpiryDate,
  maxDoctors,
  maxReceptionists,
  maxPharmacists,
  maxStorage
}) {
  if (!toEmail) return;

  const transporter = createTransporter();
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173/';
  const fromAddress = process.env.FROM_EMAIL || '"Smart Hospital Management Gateway" <support@twinscloud.com>';

  const docLimitStr = maxDoctors === -1 ? 'Unlimited' : `${maxDoctors} Active Slots`;
  const recepLimitStr = maxReceptionists === -1 ? 'Unlimited' : `${maxReceptionists} Active Slots`;
  const pharmLimitStr = maxPharmacists === -1 ? 'Unlimited' : `${maxPharmacists} Active Slots`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #334155; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%); padding: 35px 25px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 12px; opacity: 0.95; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
        .content { padding: 30px; }
        .welcome-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
        .badge { display: inline-block; background-color: #ccfbf1; color: #0f766e; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px; }
        .section-title { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; tracking-wider: 1px; margin-top: 20px; margin-bottom: 8px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px; }
        .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 18px; }
        .field { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px; }
        .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { color: #64748b; font-weight: 600; }
        .value { color: #0f172a; font-weight: 700; font-family: monospace; }
        .code-box { background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 5px 12px; border-radius: 8px; font-size: 14px; font-weight: 800; }
        .pass-box { background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 5px 12px; border-radius: 8px; font-size: 14px; font-weight: 800; }
        .btn-container { text-align: center; margin-top: 25px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; font-weight: 800; font-size: 14px; border-radius: 35px; box-shadow: 0 4px 15px rgba(13,148,136,0.3); }
        .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✚ Smart Hospital Management</h1>
          <p>Official Hospital Onboarding Confirmation</p>
        </div>
        <div class="content">
          <span class="badge">🎉 SAAS TERMINAL ACTIVATED</span>
          <div class="welcome-title">Welcome, ${hospitalName}!</div>
          <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-top: 4px;">
            Your hospital tenant database has been registered on the MediSaaS platform. Below are your administrator login credentials and subscription details:
          </p>

          <div class="section-title">🔑 Administrator Login Credentials</div>
          <div class="card">
            <div class="field">
              <span class="label">Hospital Name:</span>
              <span class="value" style="font-family: inherit;">${hospitalName}</span>
            </div>
            <div class="field">
              <span class="label">Admin Login Username:</span>
              <span class="value">${adminUsername}</span>
            </div>
            <div class="field">
              <span class="label">Admin Password:</span>
              <span class="value pass-box">${adminPassword}</span>
            </div>
            <div class="field">
              <span class="label">Hospital Access Code (License):</span>
              <span class="value code-box">${accessCode}</span>
            </div>
          </div>

          <div class="section-title">📋 Subscribed Subscription Plan</div>
          <div class="card">
            <div class="field">
              <span class="label">Active Plan Tier:</span>
              <span class="value" style="color: #0d9488; font-family: inherit;">${planName || 'Standard Tier'}</span>
            </div>
            <div class="field">
              <span class="label">Subscription Expiry Date:</span>
              <span class="value" style="font-family: inherit;">${subscriptionExpiryDate}</span>
            </div>
            <div class="field">
              <span class="label">Doctor Slots Allowed:</span>
              <span class="value" style="font-family: inherit;">${docLimitStr}</span>
            </div>
            <div class="field">
              <span class="label">Receptionist Slots Allowed:</span>
              <span class="value" style="font-family: inherit;">${recepLimitStr}</span>
            </div>
            <div class="field">
              <span class="label">Pharmacist Slots Allowed:</span>
              <span class="value" style="font-family: inherit;">${pharmLimitStr}</span>
            </div>
            <div class="field">
              <span class="label">Cloud Database Storage:</span>
              <span class="value" style="font-family: inherit;">${maxStorage || 10} GB Storage</span>
            </div>
          </div>

          <p style="font-size: 11px; color: #64748b; line-height: 1.5;">
            🔒 <strong>Important Security Note:</strong> Keep your Hospital Access Code and Admin Password safe. You will need the Access Code when logging in for the first time to activate your hospital terminal.
          </p>

          <div class="btn-container">
            <a href="${loginUrl}" class="btn">Access Hospital Admin Gateway</a>
          </div>
        </div>
        <div class="footer">
          Smart Hospital Management Software • Copyright © twinsCloud • Multi-Tenant Enterprise Gateway
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: `🎉 Welcome to MediSaaS! Hospital Onboarded: ${hospitalName}`,
    html: htmlContent
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 [WELCOME MAIL SENT] Delivered welcome email to ${toEmail}. MessageId: ${info.messageId}`);
      return { sent: true, method: 'SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [WELCOME MAIL FAIL] Failed to send welcome email to ${toEmail}: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
  return { sent: true, method: 'SIMULATED' };
}
