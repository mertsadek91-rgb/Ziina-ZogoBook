// Interactive Zoho Books setup: exchanges a Self Client grant code for a refresh token,
// lists organizations, verifies access, and writes the values into .env.
// Usage: npm run zoho:setup
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs";

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (q, def) => (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def || "";

const DCS = ["com", "eu", "in", "com.au", "jp", "ca", "sa", "com.cn"];

function updateEnv(values) {
  const path = ".env";
  let text = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : fs.readFileSync(".env.example", "utf8");
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}="${v}"`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(path, text);
}

try {
  console.log("\n=== Zoho Books setup ===\n");
  let dc = await ask(`Data center (${DCS.join(" | ")})`, "com");
  if (!DCS.includes(dc)) throw new Error(`Unknown data center: ${dc}`);

  const clientId = await ask("Client ID");
  const clientSecret = await ask("Client Secret");
  const code = await ask("Generated code (from the Self Client 'Generate Code' tab)");
  if (!clientId || !clientSecret || !code) throw new Error("Client ID, Client Secret and code are required.");

  const tokenRes = await fetch(
    `https://accounts.zoho.${dc}/oauth/v2/token?` +
      new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code }),
    { method: "POST" },
  );
  const token = await tokenRes.json();
  if (!token.access_token) {
    const hint =
      token.error === "invalid_code"
        ? "The code is expired or already used — generate a new one (it is valid for a few minutes and only once)."
        : token.error === "invalid_client"
          ? "Wrong Client ID/Secret, or the data center does not match your Zoho account."
          : "";
    throw new Error(`Token exchange failed: ${token.error ?? JSON.stringify(token)}. ${hint}`);
  }
  if (!token.refresh_token) {
    throw new Error("No refresh_token returned. Generate a new code from the Self Client and try again.");
  }
  // Zoho tells us the real API domain (e.g. https://www.zohoapis.sa).
  const apiDomain = token.api_domain ?? `https://www.zohoapis.${dc}`;
  const detectedDc = apiDomain.replace(/^https:\/\/www\.zohoapis\./, "");
  if (DCS.includes(detectedDc) && detectedDc !== dc) {
    console.log(`\nNote: your account is on the "${detectedDc}" data center — using that.`);
    dc = detectedDc;
  }
  console.log("\n✓ Refresh token obtained.");

  const orgRes = await fetch(`${apiDomain}/books/v3/organizations`, {
    headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` },
  });
  const orgData = await orgRes.json();
  if (orgData.code !== 0) throw new Error(`Could not list organizations: ${orgData.message}`);
  const orgs = orgData.organizations ?? [];
  if (!orgs.length) throw new Error("No Zoho Books organizations found for this user.");

  console.log("\nOrganizations:");
  orgs.forEach((o, i) => console.log(`  ${i + 1}) ${o.name}  (id: ${o.organization_id}, currency: ${o.currency_code})`));
  const pick = orgs.length === 1 ? 1 : Number(await ask("Choose organization number", "1"));
  const org = orgs[pick - 1];
  if (!org) throw new Error("Invalid choice.");

  // Quick permission check on the modules the app uses.
  const checks = [
    ["items", "/items?per_page=1"],
    ["contacts", "/contacts?per_page=1"],
    ["invoices", "/invoices?per_page=1"],
    ["customer payments", "/customerpayments?per_page=1"],
    ["chart of accounts", "/chartofaccounts?per_page=1"],
  ];
  console.log("");
  let allOk = true;
  for (const [name, path] of checks) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${apiDomain}/books/v3${path}${sep}organization_id=${org.organization_id}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` },
    });
    const d = await r.json().catch(() => ({}));
    const ok = d.code === 0;
    allOk &&= ok;
    console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${d.message ?? r.status}`}`);
  }

  updateEnv({
    ZOHO_DC: dc,
    ZOHO_CLIENT_ID: clientId,
    ZOHO_CLIENT_SECRET: clientSecret,
    ZOHO_REFRESH_TOKEN: token.refresh_token,
    ZOHO_ORG_ID: org.organization_id,
  });
  console.log(`\n✓ Saved to .env (organization: ${org.name}).`);
  if (!allOk) console.log("⚠ Some modules failed — regenerate the code with all the scopes listed in the README.");
  console.log("Restart the app (npm run dev) and open Settings to confirm the connection.\n");
} catch (e) {
  console.error(`\n✗ ${e.message}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
}
