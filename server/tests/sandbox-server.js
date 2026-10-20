// Local sandbox: serves the built client (client/dist) + API against a throwaway in-memory database.
// Usage: npm run build (in client), then `node tests/sandbox-server.js` in server. Never touches real data.
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.TZ = 'Asia/Kolkata';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'sandbox-secret';
process.env.RATE_LIMIT_PER_SEC = '1000';
delete process.env.SMTP_HOST;

const PORT = Number(process.env.SANDBOX_PORT) || 5055;

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replSet.getUri('medisaas_sandbox');

const mongoose = (await import('mongoose')).default;
await mongoose.connect(process.env.MONGODB_URI);
const { app } = await import('../app.js');
const { Plan } = await import('../models/Plan.js');
const { User } = await import('../models/User.js');
const { SystemSetting } = await import('../models/SystemSetting.js');

await Plan.insertMany([
  { id: 'plan-basic', name: 'Basic Plan', price: 9999, maxDoctors: 2, maxReceptionists: 1, maxPharmacists: 1, maxStorage: 10, durationMonths: 12 },
  { id: 'plan-pro', name: 'Pro Plan', price: 24999, maxDoctors: 10, maxReceptionists: 5, maxPharmacists: 3, maxStorage: 100, durationMonths: 12 },
  { id: 'plan-enterprise', name: 'Enterprise Plan', price: 59999, maxDoctors: -1, maxReceptionists: -1, maxPharmacists: -1, maxStorage: 500, durationMonths: 12 }
]);
await SystemSetting.create({ platformName: 'Smart Hospital Management Software', supportEmail: 'support@twinscloud.com', trialDays: 14 });
await new User({ name: 'Super Operator', email: 'root@sandbox.test', password: 'RootPass#123', role: 'SUPER_ADMIN', isActivated: true }).save();

app.listen(PORT, () => {
  console.log(`SANDBOX READY http://127.0.0.1:${PORT}  (super admin: root@sandbox.test / RootPass#123)`);
});

const shutdown = async () => {
  mongoose.connection.removeAllListeners('disconnected');
  await mongoose.disconnect();
  await replSet.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
