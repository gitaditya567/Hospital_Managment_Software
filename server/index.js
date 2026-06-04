import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { authRouter } from './routes/auth.js';
import { pharmacyRouter } from './routes/pharmacy.js';
import { hospitalRouter } from './routes/hospital.js';
import { superadminRouter } from './routes/superadmin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB locally
connectDB();

// Express Middlewares
app.use(cors());
app.use(express.json());

// API Routes mounting
app.use('/api/auth', authRouter);
app.use('/api/pharmacy', pharmacyRouter);
app.use('/api/hospital', hospitalRouter);
app.use('/api/superadmin', superadminRouter);

app.get('/', (req, res) => {
  res.json({
    status: 'MediSaaS API Node Online 🟢',
    db_status: 'Connected to local MongoDB instance',
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 MediSaaS REST Server running locally on Port: ${PORT}`);
  console.log(`🔗 API Endpoint: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
