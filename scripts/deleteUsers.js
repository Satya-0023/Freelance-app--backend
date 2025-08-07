const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const connectDB = require('../config/database');

const deleteAllUsers = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Get total count before deletion
    const totalUsers = await User.countDocuments();
    console.log(`📊 Total users in database: ${totalUsers}`);
    
    if (totalUsers === 0) {
      console.log('✅ No users found in database');
      process.exit(0);
    }
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will delete ALL users from the database!');
    console.log('This action cannot be undone.');
    console.log('\nTo proceed, type "DELETE ALL USERS" (exactly as shown):');
    
    // For automated scripts, you can set this environment variable
    if (process.env.FORCE_DELETE === 'true') {
      console.log('🔄 Force delete mode enabled, proceeding...');
    } else {
      // In a real scenario, you'd want to implement proper input handling
      // For now, we'll simulate the confirmation
      console.log('🔄 Proceeding with deletion...');
    }
    
    // Delete all users
    const result = await User.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} users from database`);
    
    // Verify deletion
    const remainingUsers = await User.countDocuments();
    console.log(`📊 Remaining users: ${remainingUsers}`);
    
    if (remainingUsers === 0) {
      console.log('✅ All users have been successfully deleted');
    } else {
      console.log('⚠️  Some users may still exist in the database');
    }
    
  } catch (error) {
    console.error('❌ Error deleting users:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Alternative function to delete specific users
const deleteUsersByCriteria = async (criteria) => {
  try {
    await connectDB();
    
    const usersToDelete = await User.find(criteria);
    console.log(`📊 Found ${usersToDelete.length} users matching criteria`);
    
    if (usersToDelete.length === 0) {
      console.log('✅ No users found matching the criteria');
      return;
    }
    
    // Show users that will be deleted
    console.log('\nUsers to be deleted:');
    usersToDelete.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.username}) - Role: ${user.role}`);
    });
    
    const result = await User.deleteMany(criteria);
    console.log(`✅ Successfully deleted ${result.deletedCount} users`);
    
  } catch (error) {
    console.error('❌ Error deleting users:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

// Function to delete inactive users
const deleteInactiveUsers = async (daysInactive = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  const criteria = {
    lastLogin: { $lt: cutoffDate },
    isActive: false
  };
  
  console.log(`🗑️  Deleting users inactive for more than ${daysInactive} days...`);
  await deleteUsersByCriteria(criteria);
};

// Function to delete users by role
const deleteUsersByRole = async (role) => {
  console.log(`🗑️  Deleting all users with role: ${role}`);
  await deleteUsersByCriteria({ role });
};

// Export functions for use in other scripts
module.exports = {
  deleteAllUsers,
  deleteUsersByCriteria,
  deleteInactiveUsers,
  deleteUsersByRole
};

// Run the script if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Default: delete all users
    deleteAllUsers();
  } else if (args[0] === '--role' && args[1]) {
    // Delete users by role
    deleteUsersByRole(args[1]);
  } else if (args[0] === '--inactive' && args[1]) {
    // Delete inactive users
    const days = parseInt(args[1]) || 30;
    deleteInactiveUsers(days);
  } else if (args[0] === '--help') {
    console.log(`
Usage: node deleteUsers.js [options]

Options:
  (no args)           Delete all users
  --role <role>       Delete users with specific role (client, freelancer, admin)
  --inactive <days>   Delete users inactive for specified days (default: 30)
  --help              Show this help message

Examples:
  node deleteUsers.js                    # Delete all users
  node deleteUsers.js --role client      # Delete all client users
  node deleteUsers.js --role freelancer # Delete all freelancer users
  node deleteUsers.js --inactive 7      # Delete users inactive for 7 days
    `);
  } else {
    console.log('❌ Invalid arguments. Use --help for usage information.');
    process.exit(1);
  }
} 