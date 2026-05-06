const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const uid = process.argv[2];

if (!uid) {
  console.error("Usage: node scripts/bootstrap-admin.js <firebase-auth-uid>");
  process.exit(1);
}

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
  await admin.auth().setCustomUserClaims(uid, { role: "admin" });
  await admin.firestore().collection("users").doc(uid).set({
    role: "admin",
    roleDisplay: "admin",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`Admin claim set for ${uid}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
