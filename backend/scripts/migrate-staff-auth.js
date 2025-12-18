const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Staff = require('../models/Staff');
const bcrypt = require('bcryptjs');

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

const migrateStaffAuth = async () => {
  try {
    await connectDB();

    // Find all staff without password or role
    const staffMembers = await Staff.find({
      $or: [
        { password: { $exists: false } },
        { role: { $exists: false } }
      ]
    });

    if (staffMembers.length === 0) {
      console.log('No staff members need migration. All staff have password and role.');
      process.exit(0);
    }

    console.log(`Found ${staffMembers.length} staff members to migrate.`);

    // Default password for existing staff
    const defaultPassword = 'Temp@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    let updatedCount = 0;

    for (const staff of staffMembers) {
      const updateData = {};

      // Add role if missing (default to therapist)
      if (!staff.role) {
        updateData.role = 'therapist';
      }

      // Add password if missing
      if (!staff.password) {
        updateData.password = hashedPassword;
      }

      // Update staff
      if (Object.keys(updateData).length > 0) {
        await Staff.findByIdAndUpdate(staff._id, updateData);
        updatedCount++;
        console.log(`  - Updated: ${staff.name} (${staff.phone})`);
      }
    }

    console.log(`\nMigration completed: ${updatedCount} staff members updated.`);
    console.log(`\n⚠️  IMPORTANT: Default password for all migrated staff is: ${defaultPassword}`);
    console.log('Please inform staff to change their password on first login.');

    process.exit(0);
  } catch (error) {
    console.error('Error migrating staff:', error);
    process.exit(1);
  }
};

migrateStaffAuth();







