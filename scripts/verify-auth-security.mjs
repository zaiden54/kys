#!/usr/bin/env node
// End-to-end security assertions for Better Auth. Exercises a running dev
// server plus a direct Lakebase Postgres connection for disposable-user cleanup.
import { neon } from "@neondatabase/serverless";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("FAIL [setup]: DATABASE_URL is required to verify auth security");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const createdEmails = [];

class VerificationFailure extends Error {}

function fail(step, message) {
  console.error(`FAIL [${step}]: ${message}`);
  process.exitCode = 1;
  throw new VerificationFailure(message);
}

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function deleteUsersByEmail(email) {
  await sql`delete from "user" where email = ${email}`;
}

async function postAuth(path, body) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify(body),
  });
  const rawBody = await response.text();
  let jsonBody;
  try {
    jsonBody = JSON.parse(rawBody);
  } catch {
    jsonBody = null;
  }
  return { url, response, rawBody, jsonBody };
}

async function main() {
  const email = uniqueEmail("verify-auth-security");
  const unknownEmail = uniqueEmail("verify-auth-security-unknown");
  const password = "correct-horse-battery-staple-security-1";
  const wrongPassword = "wrong-password-security-probe-1";
  createdEmails.push(email);

  const signUp = await postAuth("/api/auth/sign-up/email", {
    email,
    password,
    name: email.split("@")[0],
  });
  if (!signUp.response.ok) {
    fail("1", `sign-up failed with status ${signUp.response.status}: ${signUp.rawBody}`);
  }
  console.log("PASS [1] disposable test user created");

  const wrongPasswordResult = await postAuth("/api/auth/sign-in/email", {
    email,
    password: wrongPassword,
  });
  if (wrongPasswordResult.response.ok) {
    fail("2", "wrong-password sign-in unexpectedly succeeded");
  }
  console.log("PASS [2] wrong-password sign-in rejected");

  const unknownEmailResult = await postAuth("/api/auth/sign-in/email", {
    email: unknownEmail,
    password: wrongPassword,
  });
  if (unknownEmailResult.response.ok) {
    fail("3", "unknown-email sign-in unexpectedly succeeded");
  }
  console.log("PASS [3] unknown-email sign-in rejected");

  const wrongCode = wrongPasswordResult.jsonBody?.code;
  const unknownCode = unknownEmailResult.jsonBody?.code;
  const wrongBody = JSON.stringify(wrongPasswordResult.jsonBody);
  const unknownBody = JSON.stringify(unknownEmailResult.jsonBody);
  if (
    wrongPasswordResult.response.status !== unknownEmailResult.response.status ||
    typeof wrongCode !== "string" ||
    wrongCode !== unknownCode ||
    wrongBody !== unknownBody
  ) {
    fail(
      "4",
      `login failures differed: status ${wrongPasswordResult.response.status}/${unknownEmailResult.response.status}, body ${wrongBody}/${unknownBody}`,
    );
  }
  console.log("PASS [4] login failures have identical HTTP status and response body");

  const observedOutsidePostBody = [
    wrongPasswordResult.url,
    unknownEmailResult.url,
    wrongPasswordResult.rawBody,
    unknownEmailResult.rawBody,
  ].some((value) => value.includes(wrongPassword));
  if (observedOutsidePostBody) {
    fail("5", "wrong-password value appeared in a request URL or response body");
  }
  console.log("PASS [5] password appears only in the POST request body");

  const successfulSignIn = await postAuth("/api/auth/sign-in/email", { email, password });
  if (!successfulSignIn.response.ok) {
    fail(
      "6",
      `correct-password sign-in failed with status ${successfulSignIn.response.status}: ${successfulSignIn.rawBody}`,
    );
  }
  const setCookieValues =
    successfulSignIn.response.headers.getSetCookie?.() ??
    [successfulSignIn.response.headers.get("set-cookie")].filter(Boolean);
  const sessionCookie = setCookieValues.find((cookie) =>
    cookie.toLowerCase().includes("session_token="),
  );
  if (!sessionCookie) {
    fail("6", "successful sign-in response carried no session-token Set-Cookie header");
  }
  if (!/;\s*httponly(?:;|$)/i.test(sessionCookie) || !/;\s*path=\/(?:;|$)/i.test(sessionCookie)) {
    fail("6", `session cookie lacks HttpOnly or Path=/: ${sessionCookie}`);
  }
  if (BASE_URL.startsWith("https://")) {
    if (!/;\s*secure(?:;|$)/i.test(sessionCookie) || !/^__Secure-/i.test(sessionCookie)) {
      fail("6", `HTTPS session cookie lacks Secure or __Secure- prefix: ${sessionCookie}`);
    }
  } else if (/;\s*secure(?:;|$)/i.test(sessionCookie)) {
    fail("6", `HTTP session cookie unexpectedly has Secure: ${sessionCookie}`);
  }
  console.log("PASS [6] session cookie has protocol-appropriate security flags");
  if (BASE_URL.startsWith("http://")) {
    console.log("NOTE: Secure and __Secure- require confirmation on the HTTPS PR preview");
  }

  console.log("verify-auth-security: all assertions passed");
}

main()
  .catch((err) => {
    if (!(err instanceof VerificationFailure)) {
      console.error("FAIL [unexpected]:", err);
      process.exitCode = 1;
    }
  })
  .finally(async () => {
    for (const email of createdEmails) {
      try {
        await deleteUsersByEmail(email);
      } catch (cleanupErr) {
        console.error(`cleanup failed for ${email}:`, cleanupErr);
        process.exitCode = 1;
      }
    }
  });
