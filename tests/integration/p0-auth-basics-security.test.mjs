import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { firebaseAuthErrorMessage } from "../../app/lib/firebase-auth-errors.ts";
import {
  EmailVerificationRequiredError,
  requireVerifiedEmail,
} from "../../app/lib/firebase-admin.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("signup persists a bounded display name and requests verification", async () => {
  const contents = await source("app/signup/page.tsx");
  const create = contents.indexOf("createUserWithEmailAndPassword");
  const profile = contents.indexOf("updateProfile(userCredential.user", create);
  const verification = contents.indexOf("sendEmailVerification(userCredential.user)", profile);
  const redirect = contents.indexOf('router.replace("/verify-email")', verification);
  assert.ok(create >= 0 && profile > create && verification > profile && redirect > verification);
  assert.match(contents, /trimmedName\.length > 100/);
  assert.match(contents, /maxLength=\{100\}/);
  assert.match(contents, /syncResponse\.ok/);
  assert.doesNotMatch(contents, /alert\(|console\.error|error\.message/);
});

test("login and signup are Enter-enabled forms with duplicate-submit locks", async () => {
  for (const path of ["app/login/page.tsx", "app/signup/page.tsx"]) {
    const contents = await source(path);
    assert.match(contents, /<form[^>]+onSubmit=/);
    assert.match(contents, /type="submit"/);
    assert.match(contents, /if \(isSubmitting\) return/);
    assert.match(contents, /disabled=\{isSubmitting\}/);
  }
});

test("login routes unverified users to verification and preserves verified continuation", async () => {
  const contents = await source("app/login/page.tsx");
  const signIn = contents.indexOf("signInWithEmailAndPassword");
  const verifiedCheck = contents.indexOf("credential.user.emailVerified", signIn);
  const verifyRedirect = contents.indexOf('router.replace("/verify-email")', verifiedCheck);
  const projects = contents.indexOf('authenticatedFetch("/api/projects"', verifyRedirect);
  assert.ok(signIn >= 0 && verifiedCheck > signIn && verifyRedirect > verifiedCheck && projects > verifyRedirect);
  assert.match(contents, /firebaseAuthErrorMessage/);
});

test("verification supports resend cooldown, reload, token refresh, and pending state", async () => {
  const contents = await source("app/verify-email/page.tsx");
  assert.match(contents, /sendEmailVerification\(user\)/);
  assert.match(contents, /RESEND_COOLDOWN_SECONDS\s*=\s*60/);
  assert.match(contents, /resending \|\| cooldown > 0/);
  assert.match(contents, /await reload\(user\)/);
  assert.match(contents, /if \(!user\.emailVerified\)/);
  assert.match(contents, /await user\.getIdToken\(true\)/);
  assert.match(contents, /authenticatedFetch\("\/api\/projects"\)/);
  assert.match(contents, /projectsData\.projects\?\.length === 0 \? "\/onboarding" : "\/dashboard"/);
  assert.match(contents, /signOut\(auth\)/);
});

test("forgot password uses Firebase hosted reset without account enumeration", async () => {
  const contents = await source("app/forgot-password/page.tsx");
  assert.match(contents, /sendPasswordResetEmail\(auth, email\.trim\(\)\)/);
  assert.match(contents, /GENERIC_SUCCESS_MESSAGE/);
  assert.match(contents, /auth\/user-not-found/);
  assert.doesNotMatch(contents, /confirmPasswordReset|passwordResetCode|resetToken/);
  assert.doesNotMatch(contents, /console\.|error\.message/);
});

test("friendly Firebase errors never return raw provider messages", () => {
  assert.equal(firebaseAuthErrorMessage({ code: "auth/invalid-credential" }), "Incorrect email or password.");
  assert.equal(
    firebaseAuthErrorMessage({ code: "auth/network-request-failed" }),
    "Network problem. Check your internet connection and try again.",
  );
  assert.equal(
    firebaseAuthErrorMessage({ code: "auth/too-many-requests" }),
    "Too many attempts. Please wait a moment and try again.",
  );
  assert.equal(firebaseAuthErrorMessage(new Error("provider internal detail")), "Something went wrong. Please try again.");
});

test("normal customer auth requires verified email while explicit internal exceptions remain narrow", async () => {
  assert.doesNotThrow(() => requireVerifiedEmail({ email_verified: true }));
  assert.throws(
    () => requireVerifiedEmail({ email_verified: false }),
    EmailVerificationRequiredError,
  );
  assert.throws(
    () => requireVerifiedEmail({ email_verified: undefined }),
    EmailVerificationRequiredError,
  );

  const helper = await source("app/lib/firebase-admin.ts");
  const userSync = await source("app/api/user/sync/route.ts");
  const boss = await source("app/api/internal/boss/entitlements/route.ts");
  const webhook = await source("app/api/billing/webhook/route.ts");
  assert.match(helper, /verifyFirebaseIdTokenAllowUnverified/);
  assert.match(helper, /requireVerifiedEmail\(token\)/);
  assert.match(userSync, /verifyFirebaseIdTokenAllowUnverified/);
  assert.match(boss, /verifyFirebaseIdTokenAllowUnverified/);
  assert.doesNotMatch(webhook, /verifyFirebaseIdToken|email_verified/);
});

test("dashboard greeting uses displayName with a UID-free fallback", async () => {
  const contents = await source("app/dashboard/page.tsx");
  assert.match(contents, /if \(!user\.emailVerified\)/);
  assert.match(contents, /router\.replace\("\/verify-email"\)/);
  assert.match(contents, /user\.displayName\?\.trim\(\)\.slice\(0, 100\)/);
  assert.match(contents, /Welcome, \{customerName \|\| "there"\}/);
  assert.doesNotMatch(contents, /Welcome, \{user\.uid\}/);
});
