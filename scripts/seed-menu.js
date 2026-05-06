const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const seedMenu = [
  {
    id: "masala-dosa",
    name: "Masala Dosa",
    description: "Crisp dosa with potato masala and chutney.",
    category: "meal",
    pricePaisa: 3000,
    available: true
  },
  {
    id: "chicken-Biryani",
    name: "Chicken Biryani",
    description: "Yummy Chicken Biryani",
    category: "meal",
    pricePaisa: 9000,
    available: true
  },
  {
    id: "samosa",
    name: "Samosa",
    description: "One hot samosa with green chutney.",
    category: "snack",
    pricePaisa: 1500,
    available: true
  },
  {
    id: "paneer-frankie",
    name: "Paneer Frankie",
    description: "Paneer tikka, onions, and mint sauce in a wrap.",
    category: "snack",
    pricePaisa: 7000,
    available: false
  },
  {
    id: "filter-coffee",
    name: "Filter Coffee",
    description: "Fresh South Indian filter coffee.",
    category: "drink",
    pricePaisa: 1500,
    available: true
  },
  {
    id: "lime-soda",
    name: "Fresh Lime Soda",
    description: "Sweet, salted, or mixed.",
    category: "drink",
    pricePaisa: 3500,
    available: true
  },
  {
    id: "chicken-noodles",
    name: "Chicken Noodles",
    description: "Yummy Chicken Noodles",
    category: "meal",
    pricePaisa: 8000,
    available: true
  },
  {
    id: "vada-pav",
    name: "Vada Pav",
    description: "Yummy Vada Pav",
    category: "snack",
    pricePaisa: 1500,
    available: true
  },
  {
    id: "chicken-triple",
    name: "Chicken Triple",
    description: "Yummy Chicken Triple",
    category: "meal",
    pricePaisa: 10000,
    available: true
  }
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function privateKeyFromEnv() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  return key ? key.replace(/\\n/g, "\n") : "";
}

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = privateKeyFromEnv();

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    });
  }

  return admin.credential.applicationDefault();
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

admin.initializeApp({
  credential: getCredential(),
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

async function main() {
  const batch = admin.firestore().batch();
  for (const item of seedMenu) {
    const { id, ...data } = item;
    batch.set(admin.firestore().collection("menuItems").doc(id), {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${seedMenu.length} menu items.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
