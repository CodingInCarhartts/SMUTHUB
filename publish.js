import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const UPDATE_FILE = join(process.cwd(), "src/services/update.ts");
const SUPABASE_URL = "https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/app_updates";
const SUPABASE_KEY = "sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz";

async function publish() {
  const content = readFileSync(UPDATE_FILE, "utf-8");
  const versionMatch = content.match(/export const APP_VERSION = '(\d+\.\d+\.(\d+))'/);

  if (!versionMatch) {
    console.error("Could not find APP_VERSION in src/services/update.ts");
    process.exit(1);
  }

  const oldVersion = versionMatch[1];
  const patch = parseInt(versionMatch[2]) + 1;
  const newVersion = oldVersion.replace(/\.\d+$/, `.${patch}`);

  console.log(`🚀 Bumping version: ${oldVersion} -> ${newVersion}`);

  // 1. Update file locally
  const newContent = content.replace(
    `export const APP_VERSION = '${oldVersion}'`,
    `export const APP_VERSION = '${newVersion}'`
  );
  writeFileSync(UPDATE_FILE, newContent);

  // 2. Push to Supabase
  console.log(`📡 Notifying Supabase of new version ${newVersion}...`);
  try {
    const response = await fetch(SUPABASE_URL, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        version: newVersion,
        is_mandatory: false,
        release_notes: "Automated update via CLI"
      })
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} ${await response.text()}`);
    }
    console.log("✅ Supabase update successful.");
  } catch (error) {
    console.error("❌ Failed to update Supabase:", error);
    process.exit(1);
  }
}

publish();
