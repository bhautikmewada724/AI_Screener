import mongoose from 'mongoose';

/**
 * Establish a connection to MongoDB using the URI defined in the environment.
 */
const connectDB = async () => {
  const { MONGO_URI } = process.env;

  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not defined. Please set it in backend/.env');
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connection established');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

export default connectDB;

