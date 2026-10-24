import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";

const start = async () => {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    console.error("Missing MONGODB_URI or JWT_SECRET. Copy .env.example to .env first.");
    process.exit(1);
  }
  await connectDB();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API running on port ${port}`));
};
start().catch((err) => { console.error(err.message); process.exit(1); });
