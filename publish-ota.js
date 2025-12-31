
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const UPDATE_FILE = join(process.cwd(), "src/services/update.ts");
const PACKAGE_FILE = join(process.cwd(), "package.json");
const BUNDLE_SOURCE = join(process.cwd(), "dist/main.lynx.bundle");
const BUNDLE_DEST = join(process.cwd(), "main.lynx.bundle");

// Configuration
const SUPABASE_URL = "https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/app_updates";
const SUPABASE_KEY = "sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz";

function run(command, options = {}) {
  console.log(`> ${command}`);
  return execSync(command, { stdio: 'inherit', ...options });
}

function runQuiet(command) {
  return execSync(command).toString().trim();
}

async function publish() {
  const customMsg = process.argv[2];
  console.log("🚀 Starting OTA Update Process (Commit Hash Mode)...\n");
  if (customMsg) {
    console.log(`📝 Release Notes: "${customMsg}"\n`);
  }

  // 1. Get display version from package.json (for human-readable display only)
  const pkg = JSON.parse(readFileSync(PACKAGE_FILE, "utf-8"));
  const displayVersion = pkg.version || "1.0.0";
  console.log(`📦 Display Version: ${displayVersion}`);

  // 2. Stage all source changes FIRST (before we know the hash)
  console.log("\n🔄 Staging source changes...");
  run("git add src");

  // 3. Create a temporary commit to get the hash
  const commitMsg = customMsg
    ? `🚀 ota: ${customMsg}`
    : `🚀 ota: bundle update`;
  
  try {
    run(`git commit -m "${commitMsg}" --allow-empty`);
  } catch (e) {
    console.log("ℹ️ No source changes to commit, proceeding with current HEAD.");
  }

  // 4. Get the commit hash
  const commitHash = runQuiet("git rev-parse --short HEAD");
  const fullCommitHash = runQuiet("git rev-parse HEAD");
  console.log(`✅ Commit Hash: ${commitHash} (${fullCommitHash})`);

  // 5. Inject commit hash into update.ts
  let tsContent = readFileSync(UPDATE_FILE, "utf-8");
  
  // Replace or add BUNDLE_COMMIT_HASH
  if (tsContent.includes("export const BUNDLE_COMMIT_HASH")) {
    tsContent = tsContent.replace(
      /export const BUNDLE_COMMIT_HASH = '[^']*';/,
      `export const BUNDLE_COMMIT_HASH = '${commitHash}';`
    );
  } else {
    // Add after BUNDLE_VERSION if it exists, otherwise at top of exports
    if (tsContent.includes("export const BUNDLE_VERSION")) {
      tsContent = tsContent.replace(
        /export const BUNDLE_VERSION = '[^']*';/,
        `export const BUNDLE_VERSION = '${displayVersion}';\nexport const BUNDLE_COMMIT_HASH = '${commitHash}';`
      );
    } else {
      // Add before UpdateService export
      tsContent = tsContent.replace(
        /export const UpdateService/,
        `export const BUNDLE_COMMIT_HASH = '${commitHash}';\n\nexport const UpdateService`
      );
    }
  }
  
  // Also update BUNDLE_VERSION to match package.json for display
  if (tsContent.includes("export const BUNDLE_VERSION")) {
    tsContent = tsContent.replace(
      /export const BUNDLE_VERSION = '[^']*';/,
      `export const BUNDLE_VERSION = '${displayVersion}';`
    );
  }
  
  writeFileSync(UPDATE_FILE, tsContent);
  console.log(`✅ Injected commit hash ${commitHash} into update.ts`);

  // 6. Build Lynx Bundle (now with correct hash embedded)
  console.log("\n📦 Building Lynx Bundle...");
  try {
    run("npm run build");
    run(`cp "${BUNDLE_SOURCE}" "${BUNDLE_DEST}"`);
    console.log("✅ Lynx bundle built and updated at root");
  } catch (e) {
    console.error("❌ Build Failed:", e.message);
    process.exit(1);
  }

  // 7. Amend the commit to include build artifacts and update.ts changes
  console.log("\n🔄 Amending commit with build artifacts...");
  try {
    run("git add src/services/update.ts");
    run("git add -f main.lynx.bundle");
    run(`git commit --amend --no-edit`);
    run("git push origin main --force-with-lease");
    console.log("✅ Pushed to repository");
  } catch (e) {
    console.error("❌ Git operations failed:", e.message);
    process.exit(1);
  }

  // 8. Get the FINAL commit hash (after amend)
  const finalCommitHash = runQuiet("git rev-parse HEAD");
  const finalShortHash = runQuiet("git rev-parse --short HEAD");
  const bundleUrl = `https://raw.githubusercontent.com/CodingInCarhartts/SMUTHUB/${finalCommitHash}/main.lynx.bundle`;

  // 9. Register in Supabase with commit_hash as primary identifier
  console.log(`\n📡 Registering OTA in Supabase (hash: ${finalShortHash})...`);

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
        version: displayVersion,
        commit_hash: finalShortHash,
        is_mandatory: false,
        release_notes: customMsg || `OTA update (${finalShortHash})`,
        download_url: bundleUrl
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
  console.log(`Commit Hash: ${finalShortHash}`);
  console.log(`Bundle URL: ${bundleUrl}`);
}

publish();
