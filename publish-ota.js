
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const UPDATE_FILE = join(process.cwd(), "src/services/update.ts");
const BUNDLE_SOURCE = join(process.cwd(), "dist/main.lynx.bundle");
const BUNDLE_DEST = join(process.cwd(), "main.lynx.bundle");

// Configuration
const SUPABASE_URL = "https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/app_updates";
const SUPABASE_KEY = "sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz";

function run(command, options = {}) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit', ...options });
}

async function publish() {
  const customMsg = process.argv[2];
  console.log("🚀 Starting OTA Update Process...\n");
  if (customMsg) {
    console.log(`📝 Release Notes: "${customMsg}"\n`);
  }

  // 1. Get Current Version & Bump
  let tsContent = readFileSync(UPDATE_FILE, "utf-8");
  const versionMatch = tsContent.match(/export const APP_VERSION = '(\d+\.\d+\.(\d+))'/);
  if (!versionMatch) throw new Error("Could not find APP_VERSION in update.ts");
  
  const oldVer = versionMatch[1];
  const oldPatch = parseInt(versionMatch[2]);
  const newVer = oldVer.replace(/\.\d+$/, `.${oldPatch + 1}`);
  
  tsContent = tsContent.replace(
    `export const APP_VERSION = '${oldVer}';`,
    `export const APP_VERSION = '${newVer}';`
  );
  
  writeFileSync(UPDATE_FILE, tsContent);
  console.log(`✅ Version Bump: ${oldVer} -> ${newVer}`);

  // 2. Build Lynx Bundle
  console.log("\n📦 Building Lynx Bundle...");
  try {
    run("npm run build");
    run(`cp "${BUNDLE_SOURCE}" "${BUNDLE_DEST}"`);
    console.log("✅ Lynx bundle built and updated at root");
  } catch (e) {
    console.error("❌ Build Failed:", e.message);
    process.exit(1);
  }

  // 3. Commit and Push
  console.log("\n🔄 Committing and pushing...");
  try {
    run("git add src/services/update.ts main.lynx.bundle");
    const commitMsg = customMsg 
      ? `🚀 ota: ${customMsg} (v${newVer})`
      : `🚀 ota: bundle update v${newVer}`;
    run(`git commit -m "${commitMsg}"`);
    run("git push origin main");
    console.log("✅ Pushed to repository");
  } catch (e) {
    console.error("❌ Git operations failed:", e.message);
    process.exit(1);
  }

  // 4. Update Supabase
  console.log(`\n📡 Registering OTA in Supabase (v${newVer})...`);
  const bundleUrl = `https://raw.githubusercontent.com/CodingInCarhartts/SMUTHUB/main/main.lynx.bundle`;

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
        version: newVer,
        download_url: bundleUrl,
        is_mandatory: false,
        release_notes: customMsg || `OTA update v${newVer}`
      })
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} ${await response.text()}`);
    }
    console.log("✅ Supabase registered successfully.");
  } catch (error) {
    console.error("❌ Failed to register in Supabase:", error);
    process.exit(1);
  }

  console.log("\n🎉 OTA Publish Complete!");
  console.log(`The app will now detect v${newVer} and download it from:\n${bundleUrl}`);
}

publish();
