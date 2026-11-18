import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
await mongoose.connect(process.env.MONGO_URI, {
  dbName: 'main'
});    console.log('✅ MongoDB Atlas Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};