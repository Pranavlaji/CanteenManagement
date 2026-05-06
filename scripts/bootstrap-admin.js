/* eslint-disable no-console */
const admin = require("firebase-admin");

const uid = process.argv[2];

if (!uid) {
  console.error("Usage: node scripts/bootstrap-admin.js <firebase-auth-uid>");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
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
