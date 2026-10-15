
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { User, Book } = require("./models");

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing from server/.env");
    }

    const dataPath = path.join(
      __dirname,
      "../data/bookleaf_sample_data.json"
    );

    const rawData = fs.readFileSync(dataPath, "utf8");
    const data = JSON.parse(rawData);

    if (!Array.isArray(data.authors)) {
      throw new Error("Invalid seed data: expected an authors array.");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Remove existing sample author and book records.
    await Book.deleteMany({});
    await User.deleteMany({ role: "author" });

    const authorPasswordHash = await bcrypt.hash("Password123!", 10);

    for (const authorData of data.authors) {
      const { books = [], ...authorDetails } = authorData;

      const author = await User.create({
        name: authorDetails.name,
        email: authorDetails.email,
        passwordHash: authorPasswordHash,
        role: "author",
      });

      if (books.length > 0) {
        await Book.insertMany(
          books.map((book) => ({
            title: book.title,
            isbn: book.isbn,
            genre: book.genre,
            publicationDate: book.publication_date,
            status: book.status || "In Production",
            mrp: book.mrp ?? 0,
            copiesSold: book.total_copies_sold ?? 0,
            royaltyEarned: book.total_royalty_earned ?? 0,
            royaltyPaid: book.royalty_paid ?? 0,
            royaltyPending: book.royalty_pending ?? 0,
            platform: Array.isArray(book.available_on)
              ? book.available_on.join(", ")
              : "",
            author: author._id,
          }))
        );
      }
    }

    // Create the admin account if it doesn't already exist.
    const adminEmail = "admin@bookleaf.demo";
    const adminPassword = "Admin@123";

    const existingAdmin = await User.findOne({
      email: adminEmail,
    });

    if (!existingAdmin) {
      const adminPasswordHash = await bcrypt.hash(
        adminPassword,
        10
      );

      await User.create({
        name: "BookLeaf Admin",
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: "admin",
      });

      console.log("Admin account created successfully.");
    } else {
      console.log("Existing admin account preserved.");
    }

    console.log(`Seeded ${data.authors.length} authors successfully.`);
    console.log("Database seeding completed.");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

seedDatabase();
