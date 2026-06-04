import mongoose from 'mongoose';

const platformActivitySchema = new mongoose.Schema({
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['hospital', 'license', 'plan', 'payment', 'system'], 
    required: true 
  },
  timestamp: { type: String, required: true }
}, { timestamps: true });

export const PlatformActivity = mongoose.model('PlatformActivity', platformActivitySchema);
