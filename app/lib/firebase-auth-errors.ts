import { FirebaseError } from "firebase/app";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use":
    "An account may already exist with this email. Try logging in or resetting your password.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/weak-password": "Please choose a stronger password with at least 6 characters.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/network-request-failed":
    "Network problem. Check your internet connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/user-disabled": "This account is disabled. Please contact support for help.",
};

export function firebaseAuthErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const code = error instanceof FirebaseError
    ? error.code
    : typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : null;

  return typeof code === "string" ? AUTH_ERROR_MESSAGES[code] ?? fallback : fallback;
}
