import mongoose from 'mongoose';

const subscriptionInvoiceSchema = new mongoose.Schema({
  hospitalName: { type: String, required: true },
  planName: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Paid', 'Failed', 'Pending'], 
    default: 'Pending' 
  },
  date: { type: String, required: true },
  method: { 
    type: String, 
    enum: ['Manual Invoice', 'Stripe', 'Razorpay'], 
    default: 'Manual Invoice' 
  }
}, { timestamps: true });

export const SubscriptionInvoice = mongoose.model('SubscriptionInvoice', subscriptionInvoiceSchema);
