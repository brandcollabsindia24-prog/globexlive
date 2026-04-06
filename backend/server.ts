// import express from "express"
// import cors from "cors"
// import dotenv from "dotenv"
// import { connectDB } from "./config/db"
// import brandRoutes from "./routes/brandRoutes"

// dotenv.config()

// const app = express()

// app.use(cors())
// app.use(express.json())

// connectDB()

// app.use("/api/brand", brandRoutes)

// app.get("/", (req, res) => {
//   res.send("API Running")
// })

// app.listen(5000, () => {
//   console.log("Server running on port 5000")
// })



// import express from "express"
// import cors from "cors"
// import dotenv from "dotenv"
// import { connectDB } from "./config/db.js"
// import brandRoutes from "./routes/brandRoutes.js"

// dotenv.config()

// const app = express()

// app.use(cors())
// app.use(express.json())

// connectDB()

// app.use("/api/brand", brandRoutes)

// app.get("/", (req, res) => {
//   res.send("API Running")
// })

// app.listen(5000, () => {
//   console.log("Server running on port 5000")
// })











import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { connectDB } from "./config/db"
import brandRoutes from "./routes/brandRoutes"
import influencerRoutes from "./routes/influencerRoutes"
import campaignRoutes from "./routes/campaignRoutes"
import adminRoutes from "./routes/adminRoutes"
import contactRoutes from "./routes/contactRoutes"

dotenv.config()

const app = express()

const envOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

const defaultOrigins = [
  "http://localhost:4000",
  "http://127.0.0.1:4000",
]

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])]

const isLocalDevOrigin = (origin: string) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(origin)
}

// app.use(cors())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      callback(null, true)
      return
    }

    callback(new Error("Not allowed by CORS"))
  },
  credentials: true
}))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

const uploadsDir = path.join(process.cwd(), "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use("/uploads", express.static(uploadsDir))

// Database connect (configurable behavior via ALLOW_SERVER_WITHOUT_DB)
connectDB().catch((error) => {
  const allowWithoutDb = process.env.ALLOW_SERVER_WITHOUT_DB === "true"
  if (allowWithoutDb) {
    console.error("Warning: Database connection failed, but server is starting anyway")
    return
  }

  console.error("Fatal: Database connection failed. Set ALLOW_SERVER_WITHOUT_DB=true only for temporary local debugging.")
  process.exit(1)
})

// Routes
app.use("/api/brand", brandRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/influencer", influencerRoutes)
app.use("/api/influencers", influencerRoutes)
app.use("/api/campaigns", campaignRoutes)
app.use("/api/contacts", contactRoutes)

// Test route
app.get("/", (req, res) => {
  res.send("API Running")
})

// Server start
app.listen(5000, () => {
  console.log("Server running on port 5000")
})