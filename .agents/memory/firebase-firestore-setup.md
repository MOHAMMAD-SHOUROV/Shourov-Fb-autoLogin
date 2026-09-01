---
name: Firestore setup
description: Firebase Admin SDK setup constraints for this project
---

The Firebase Admin service-account credential can authenticate successfully while Firestore requests still fail if the Google Cloud Firestore API or database has not been enabled for the credential's project.

**Why:** The first Firestore request returned `PERMISSION_DENIED` until the project owner created the Firestore database in Firebase Console.

**How to apply:** When setting up a new environment, enable Cloud Firestore in the Firebase project before testing application routes. Keep the service-account JSON only in Replit Secrets.