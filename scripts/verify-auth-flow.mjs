#!/usr/bin/env node
// End-to-end assertion script for Plan 01-02's tracer. Exercises a running
// dev server (BASE_URL, default http://localhost:3000) plus a direct Neon
// connection (DATABASE_URL) to prove the register -> sign-in -> protected
// home route path, and the duplicate/concurrent registration edges.
import { neon } from "@neondatabase/serverless";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("FAIL [setup]: DATABASE_URL is required to verify DB state");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const createdEmails = [];

function fail(step, message) {
  console.error(`FAIL [${step}]: ${message}`);
  process.exit(1);
}

function cookieHeaderFromSetCookie(setCookieValues) {
  return setCookieValues.map((c) => c.split(";")[0]).join("; ");
}

async function countUsersByEmail(email) {
  const rows = await sql`select id from "user" where email = ${email}`;
  return rows.length;
}

async function deleteUsersByEmail(email) {
  await sql`delete from "user" where email = ${email}`;
}

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signUp(email, password) {
  return fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    // Better Auth's CSRF check requires an Origin header matching a trusted
    // origin (baseURL). Browsers send this automatically; a bare Node fetch
    // does not, so it is set explicitly here.
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password, name: email.split("@")[0] }),
  });
}

async function main() {
  const password = "correct-horse-battery-staple-1";

  // 1. Anonymous GET / redirects to /login.
  const anonRes = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  if (anonRes.status < 300 || anonRes.status >= 400) {
    fail("1", `expected a 3xx redirect for anonymous GET /, got ${anonRes.status}`);
  }
  const location = anonRes.headers.get("location") || "";
  if (!location.endsWith("/login")) {
    fail("1", `expected redirect Location to end with /login, got "${location}"`);
  }
  console.log("PASS [1] anonymous GET / redirects to /login");

  // 2. Fresh sign-up succeeds and returns a session cookie.
  const email1 = uniqueEmail("verify-auth");
  createdEmails.push(email1);
  const signUpRes = await signUp(email1, password);
  if (!signUpRes.ok) {
    fail("2", `sign-up failed with status ${signUpRes.status}: ${await signUpRes.text()}`);
  }
  const setCookie1 = signUpRes.headers.getSetCookie?.() ?? [];
  if (setCookie1.length === 0) {
    fail("2", "sign-up response carried no Set-Cookie header");
  }
  const cookieHeader1 = cookieHeaderFromSetCookie(setCookie1);
  console.log("PASS [2] fresh sign-up succeeds and returns a session cookie");

  // 3. Authenticated GET / returns 200 and renders the registered email.
  const homeRes = await fetch(`${BASE_URL}/`, { headers: { cookie: cookieHeader1 } });
  if (homeRes.status !== 200) {
    fail("3", `expected 200 for authenticated GET /, got ${homeRes.status}`);
  }
  const homeBody = await homeRes.text();
  if (!homeBody.includes(email1)) {
    fail("3", "authenticated home page body did not contain the registered email");
  }
  console.log("PASS [3] authenticated GET / renders the registered email");

  // 4. Duplicate registration for the same email fails; exactly one row survives.
  const dupRes = await signUp(email1, password);
  if (dupRes.ok) {
    fail("4", "duplicate sign-up unexpectedly succeeded");
  }
  const count1 = await countUsersByEmail(email1);
  if (count1 !== 1) {
    fail("4", `expected exactly 1 user row for ${email1}, found ${count1}`);
  }
  console.log("PASS [4] duplicate sign-up rejected, exactly one user row exists");

  // 5. Concurrent sign-up race for a new email: exactly one success, one
  //    failure, and exactly one surviving user row (DB unique constraint).
  const email2 = uniqueEmail("verify-auth-race");
  createdEmails.push(email2);
  const settled = await Promise.allSettled([signUp(email2, password), signUp(email2, password)]);
  const httpResponses = settled.map((r) => (r.status === "fulfilled" ? r.value : null));
  const successCount = httpResponses.filter((r) => r && r.ok).length;
  const failureCount = httpResponses.filter((r) => !r || !r.ok).length;
  if (successCount !== 1 || failureCount !== 1) {
    fail(
      "5",
      `expected exactly one success and one failure, got ${successCount} success / ${failureCount} failure`,
    );
  }
  const count2 = await countUsersByEmail(email2);
  if (count2 !== 1) {
    fail("5", `expected exactly 1 user row for ${email2} after concurrent sign-up, found ${count2}`);
  }
  console.log("PASS [5] concurrent sign-up race resolves to exactly one account");

  console.log("verify-auth-flow: all assertions passed");
}

main()
  .catch((err) => {
    console.error("FAIL [unexpected]:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // 6. Clean up every user row this script created so repeated runs stay clean.
    for (const email of createdEmails) {
      try {
        await deleteUsersByEmail(email);
      } catch (cleanupErr) {
        console.error(`cleanup failed for ${email}:`, cleanupErr);
      }
    }
  });
