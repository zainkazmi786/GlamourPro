const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
require('dotenv').config();

// Migration function
const migratePayments = async () => {
  try {
    console.log('Starting payment migration...');
    
    // Find all appointments
    const appointments = await Appointment.find({});
    console.log(`Found ${appointments.length} appointments to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const appointment of appointments) {
      try {
        // Check if appointment already has payments
        if (appointment.payment_ids && appointment.payment_ids.length > 0) {
          console.log(`Appointment ${appointment._id} already has payments, skipping...`);
          continue;
        }
        
        // Map paymentMethod: 'online' -> 'bank_transfer', 'cash' -> 'cash'
        const paymentType = appointment.paymentMethod === 'online' ? 'bank_transfer' : 'cash';
        
        // Create payment record
        const paymentData = {
          appointment_id: appointment._id,
          status: appointment.paymentStatus || 'pending',
          type: paymentType,
          amount: appointment.totalPrice || 0,
          discount: appointment.membershipDiscount || 0,
          payable_amount: (appointment.totalPrice || 0) - (appointment.membershipDiscount || 0),
          notes: `Migrated from appointment payment fields`
        };
        
        const payment = await Payment.create(paymentData);
        
        // Update appointment with payment_id
        appointment.payment_ids = [payment._id];
        await appointment.save();
        
        migratedCount++;
        console.log(`Migrated appointment ${appointment._id} - Created payment ${payment._id}`);
      } catch (error) {
        errorCount++;
        console.error(`Error migrating appointment ${appointment._id}:`, error.message);
      }
    }
    
    console.log(`\nMigration completed!`);
    console.log(`Successfully migrated: ${migratedCount} appointments`);
    console.log(`Errors: ${errorCount} appointments`);
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await migratePayments();
    console.log('Migration script completed successfully');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration script failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { migratePayments };

