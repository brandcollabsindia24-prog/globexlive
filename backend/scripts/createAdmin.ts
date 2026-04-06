import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const createAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    const adminEmail = "admin@yourapp.com";
    const adminPassword = "Admin@123";

    const adminExists = await Admin.findOne({ email: adminEmail.toLowerCase() });

    if (adminExists) {
      console.log("Admin already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await Admin.create({
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin created successfully");
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    process.exit(0);
  } catch (err: any) {
    console.error("Error creating admin:", err.message);
    process.exit(1);
  }
};

void createAdmin();
