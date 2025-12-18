const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Staff = require('../models/Staff');

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

const seedManager = async () => {
  try {
    await connectDB();

    // Check if manager already exists
    const existingManager = await Staff.findOne({ role: 'manager' });

    if (existingManager) {
      console.log('Manager already exists:');
      console.log(`  Name: ${existingManager.name}`);
      console.log(`  Phone: ${existingManager.phone}`);
      console.log(`  Email: ${existingManager.email}`);
      console.log(`  Role: ${existingManager.role}`);
      console.log('\nTo create a new manager, please delete the existing one first or modify this script.');
      process.exit(0);
    }

    // Manager data
    const managerData = {
      name: 'Admin Manager',
      phone: '+923001234567',
      email: 'manager@glamourpro.com',
      password: 'Admin@123', // Will be hashed by pre-save hook
      role: 'manager',
      hireDate: new Date(),
      referralCommission: 0,
      paidLeaves: 0,
      specialization: 'Massage & Spa',
      status: 'Active',
      dailyWage: 0,
      biometric_emp_id: '1', // Biometric employee ID for attendance system
      annualPaidLeavesQuota: 12, // Annual paid leaves quota
      monthlySalary: null // Can be set later or configured per month
    };

    // Create manager
    const manager = await Staff.create(managerData);

    console.log('Manager created successfully:');
    console.log(`  Name: ${manager.name}`);
    console.log(`  Phone: ${manager.phone}`);
    console.log(`  Email: ${manager.email}`);
    console.log(`  Role: ${manager.role}`);
    console.log(`  Biometric Employee ID: ${manager.biometric_emp_id}`);
    console.log(`  Annual Paid Leaves Quota: ${manager.annualPaidLeavesQuota}`);
    console.log(`  Password: ${managerData.password}`);
    console.log('\n⚠️  IMPORTANT: Please change the default password after first login!');
    console.log('\nLogin credentials:');
    console.log(`  Phone: ${managerData.phone}`);
    console.log(`  Password: ${managerData.password}`);

    process.exit(0);
  } catch (error) {
    console.error('Error creating manager:', error);
    process.exit(1);
  }
};

seedManager();

