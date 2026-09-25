// Interactive Ziina setup: verifies the API token, creates a strong webhook secret,
// optionally registers the webhook, and writes the values into .env.
// Usage: npm run ziina:setup
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import crypto from "node:crypto";
import fs from "node:fs";

const BASE = "https://api-v2.ziina.com/api";
const rl = createInterface({ input: stdin, output: stdout });
const ask = async (q, def) => (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def || "";
const yes = async (q, def = "n") => /^y/i.test(await ask(`${q} (y/n)`, def));

function readEnv() {
  const text = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : fs.readFileSync(".env.example", "utf8");
  const get = (k) => text.match(new RegExp(`^${k}="?([^"\\n]*)"?`, "m"))?.[1] ?? "";
  return { text, get };
}

function updateEnv(values) {
  let { text } = readEnv();
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}="${v}"`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(".env", text);
}

async function call(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

try {
  console.log("\n=== Ziina setup ===\n");
  const env = readEnv();

  // 1. Token
  const existing = env.get("ZIINA_API_TOKEN");
  let token = await ask(existing ? "API token (Enter to keep the current one)" : "API token");
  if (!token) token = existing;
  if (!token) throw new Error("An API token is required.");

  // Payment-only tokens get 401 on /account, so verify by reading a non-existent intent:
  // "not found" (400/404) means the token is accepted.
  const probe = await call(token, "GET", "/payment_intent/00000000-0000-0000-0000-000000000000");
  if (probe.status === 401 || probe.status === 403) {
    throw new Error("Token rejected (401/403). Create a new token and copy it fully.");
  }
  const acc = await call(token, "GET", "/account");
  console.log(`✓ Token works${acc.ok ? ` — account: ${acc.data.display_name ?? acc.data.ziiname ?? acc.data.account_id}` : ""}`);

  // 2. Test mode + a test payment intent (no money moves in test mode)
  const testMode = await yes("Use TEST mode for now? (recommended until everything is verified)", "y");
  if (await yes("Create a small test payment link to confirm the write permission?", "y")) {
    const pi = await call(token, "POST", "/payment_intent", {
      amount: 200,
      currency_code: "AED",
      message: "Setup test",
      test: true,
    });
    if (!pi.ok) {
      throw new Error(
        `Creating a payment intent failed (${pi.status}): ${pi.data.message ?? JSON.stringify(pi.data)}. ` +
          "Make sure the token has the write_payment_intents permission.",
      );
    }
    console.log(`✓ Test link created (no charge): ${pi.data.redirect_url}`);
  }

  // 3. Webhook secret
  let secret = env.get("ZIINA_WEBHOOK_SECRET");
  if (!secret || secret === "random-hmac-secret" || secret.length < 32) {
    secret = crypto.randomBytes(32).toString("hex");
    console.log("✓ Generated a new webhook secret.");
  } else {
    console.log("✓ Keeping the existing webhook secret.");
  }

  updateEnv({ ZIINA_API_TOKEN: token, ZIINA_TEST_MODE: String(testMode), ZIINA_WEBHOOK_SECRET: secret });
  console.log("✓ Saved to .env.");

  // 4. Webhook registration
  const appUrl = (await ask("\nPublic app URL (https://...) — leave empty to skip webhook registration", env.get("APP_URL")))
    .replace(/\/$/, "");
  const isPublic = /^https:\/\//.test(appUrl) && !/localhost|127\.0\.0\.1|example\.com/.test(appUrl);
  if (!isPublic) {
    console.log("\nSkipped webhook registration: it needs a real public https URL.");
    console.log("Register it later from the Settings page once the app is deployed (or tunnelled).\n");
  } else {
    const url = `${appUrl}/api/webhooks/ziina`;
    console.log(`\nWebhook URL: ${url}`);
    console.log("⚠ Ziina allows ONE webhook per account. Registering replaces any existing one");
    console.log("  (e.g. from a Shopify/WooCommerce plugin or another system).");
    if (await yes("Register it now?", "n")) {
      // Check the endpoint is reachable first (it should answer 401 for an unsigned request).
      const probe = await fetch(url, { method: "POST", body: "{}" }).catch((e) => ({ status: 0, e }));
      if (probe.status !== 401) {
        console.log(`⚠ The app did not answer as expected at ${url} (status ${probe.status}).`);
        console.log("  Make sure it is running there with the NEW .env (restart it), then try again.");
      } else {
        const wh = await call(token, "POST", "/webhook", { url, secret });
        if (!wh.ok) throw new Error(`Webhook registration failed (${wh.status}): ${wh.data.message ?? JSON.stringify(wh.data)}`);
        updateEnv({ APP_URL: appUrl });
        console.log("✓ Webhook registered.");
      }
    }
  }
  console.log("\nDone. Restart the app so it picks up the new .env.\n");
} catch (e) {
  console.error(`\n✗ ${e.message}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
}
