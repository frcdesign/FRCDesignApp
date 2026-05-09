import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
    initializeApp({
        credential: applicationDefault(),
        projectId: "frc-design-lib"
    });
}

export const DB = getFirestore();
