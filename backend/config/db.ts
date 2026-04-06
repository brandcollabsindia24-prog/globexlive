import mongoose from "mongoose"

function hideCredentials(uri: string): string {
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@")
}

async function openConnection(uri: string, label: string) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 12000,
    family: 4,
  })
  console.log(`MongoDB Connected (${label})`)
}

function printAtlasTroubleshooting() {
  console.error("MongoDB Atlas troubleshooting:")
  console.error("1) Atlas Network Access me current public IP allow karo (ya temporary 0.0.0.0/0)")
  console.error("2) Atlas Database Access user/password verify karo")
  console.error("3) Cluster paused to nahi hai, check karo")
  console.error("4) Local firewall/VPN DNS block to nahi kar raha")
}

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI
  const fallbackUri = process.env.MONGO_URI_FALLBACK
  const enableFallback = process.env.ENABLE_DB_FALLBACK === "true"

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in backend/.env")
  }

  try {
    await openConnection(mongoUri, "primary")
  } catch (primaryError) {
    console.error("DB connection failed (primary)")
    console.error("URI:", hideCredentials(mongoUri))
    printAtlasTroubleshooting()

    if (enableFallback && fallbackUri) {
      try {
        console.warn("Trying fallback MongoDB URI...")
        await openConnection(fallbackUri, "fallback")
        return
      } catch (fallbackError) {
        console.error("DB connection failed (fallback)", fallbackError)
      }
    }

    throw primaryError
  }
}