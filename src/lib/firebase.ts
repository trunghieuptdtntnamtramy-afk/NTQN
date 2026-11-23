import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
const WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/chat.messages.create",
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
];

WORKSPACE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// In-memory only OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export function initAuth(
  onUserChange: (user: User | null, accessToken: string | null) => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
      onUserChange(null, null);
    } else if (!isSigningIn) {
      onUserChange(user, cachedAccessToken);
    }
  });
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string | null }> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken ?? null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function logout(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (!user.uid || !user.email) return;
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, "users", user.uid);
  const displayName = (user.displayName || user.email.split("@")[0] || "Học sinh").slice(0, 120);
  const email = user.email.slice(0, 254);
  const photoURL = user.photoURL ? user.photoURL.slice(0, 500) : "";

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        role: "student",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}
