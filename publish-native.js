
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const GRADLE_FILE = join(process.cwd(), "SMUTHUB/app/build.gradle.kts");
const UPDATE_FILE = join(process.cwd(), "src/services/update.ts");
const APK_SOURCE = join(process.cwd(), "SMUTHUB/app/build/outputs/apk/debug/app-debug.apk");
const APK_DEST = join(process.cwd(), "SMUTHUB.apk");

// Configuration
const SUPABASE_URL = "https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/app_native_updates";
// Note: Using the same key as found in existing publish.js
const SUPABASE_KEY = "sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz";
const REPO_URL = "https://github.com/CodingInCarhartts/SMUTHUB";

function run(command, options = {}) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit', ...options });
}

async function publish() {
  console.log("🦁 Starting Native Update Process...\n");

  // 1. Bump Versions
  console.log("📦 Version Bump:");
  let gradleContent = readFileSync(GRADLE_FILE, "utf-8");
  
  // Bump Version Code
  const codeMatch = gradleContent.match(/versionCode = (\d+)/);
  if (!codeMatch) throw new Error("Could not find versionCode in build.gradle.kts");
  const oldCode = parseInt(codeMatch[1]);
  const newCode = oldCode + 1;
  gradleContent = gradleContent.replace(`versionCode = ${oldCode}`, `versionCode = ${newCode}`);
  console.log(`   Version Code (Gradle): ${oldCode} -> ${newCode}`);

  // Bump Version Name
  const nameMatch = gradleContent.match(/versionName = "(\d+\.\d+\.(\d+))"/);
  if (!nameMatch) throw new Error("Could not find versionName in build.gradle.kts");
  const oldVer = nameMatch[1];
  const oldPatch = parseInt(nameMatch[2]);
  const newVer = oldVer.replace(/\.\d+$/, `.${oldPatch + 1}`);
  gradleContent = gradleContent.replace(`versionName = "${oldVer}"`, `versionName = "${newVer}"`);
  console.log(`   Version Name (App):    ${oldVer} -> ${newVer}`);

  // Confirm
  // In a real interactive script we might ask, but here we proceed or use a flag? 
  // For automation we proceed.

  writeFileSync(GRADLE_FILE, gradleContent);
  console.log("✅ Updated build.gradle.kts");

  // Update src/services/update.ts
  let tsContent = readFileSync(UPDATE_FILE, "utf-8");
  tsContent = tsContent.replace(
    /export const APP_VERSION = '[\d\.]+';/,
    `export const APP_VERSION = '${newVer}';`
  );
  writeFileSync(UPDATE_FILE, tsContent);
  console.log("✅ Updated src/services/update.ts");

  // 2. Build APK
  console.log("\n🔨 Building APK... (this may take a while)");
  try {
    const env = { ...process.env, JAVA_HOME: "/opt/android-studio/jbr" };
    run("./gradlew assembleDebug", { cwd: join(process.cwd(), "SMUTHUB"), env });
  } catch (e) {
    console.error("❌ Build Failed");
    process.exit(1);
  }

  // 3. Copy APK
  run(`cp "${APK_SOURCE}" "${APK_DEST}"`);
  console.log(`✅ Copied APK to ${APK_DEST}`);

  // 4. Commit and Push
  console.log("\nrw Committing and pushing...");
  try {
    run("git add -f SMUTHUB/app/build.gradle.kts src/services/update.ts SMUTHUB.apk");
    run(`git commit -m "🔖 native: release v${newVer} (code ${newCode})"`);
    run("git push origin main");
    console.log("✅ Pushed to repository");
  } catch (e) {
    console.error("❌ Git operations failed:", e.message);
    process.exit(1);
  }

  // 5. Update Supabase
  console.log(`\n📡 Registering update in Supabase (v${newVer})...`);
  const downloadUrl = `https://raw.githubusercontent.com/CodingInCarhartts/SMUTHUB/main/SMUTHUB.apk`;

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
        download_url: downloadUrl,
        is_mandatory: false,
        release_notes: `Native update v${newVer}`
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

  console.log("\n🎉 Native Publish Complete!");
}

publish();
