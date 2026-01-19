import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const UPDATE_FILE = join(process.cwd(), 'src/services/update.ts');
const PACKAGE_FILE = join(process.cwd(), 'package.json');
const BUNDLE_SOURCE = join(process.cwd(), 'dist/main.lynx.bundle');
const BUNDLE_DEST = join(process.cwd(), 'main.lynx.bundle');

// Configuration
const SUPABASE_URL =
  'https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/app_updates';
const SUPABASE_KEY = 'sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz';

function run(command, options = {}) {
  console.log(`> ${command}`);
  return execSync(command, { stdio: 'inherit', ...options });
}

function runQuiet(command) {
  return execSync(command).toString().trim();
}

async function publish() {
  const customMsg = process.argv[2];
  console.log('🚀 Starting OTA Update Process (Commit Hash Mode)...\n');
  if (customMsg) {
    console.log(`📝 Release Notes: "${customMsg}"\n`);
  }

  // 1. Bump version in package.json
  const pkg = JSON.parse(readFileSync(PACKAGE_FILE, 'utf-8'));
  const oldVersion = pkg.version || '1.0.0';
  const versionParts = oldVersion.split('.');
  versionParts[2] = parseInt(versionParts[2] || 0) + 1;
  const newVersion = versionParts.join('.');
  pkg.version = newVersion;
  writeFileSync(PACKAGE_FILE, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✅ Version Bump: ${oldVersion} -> ${newVersion}`);

  // 2. Stage all source changes FIRST (before we know the hash)
  console.log('\n🔄 Staging source changes...');
  run('git add src');
  run('git add package.json');

  // 3. Create a temporary commit to get the hash
  const commitMsg = customMsg
    ? `🚀 ota: ${customMsg}`
    : `🚀 ota: bundle update`;

  try {
    run(`git commit -m "${commitMsg}" --allow-empty`);
  } catch (e) {
    console.log('ℹ️ No source changes to commit, proceeding with current HEAD.');
  }

  // 4. Get the commit hash
  const commitHash = runQuiet('git rev-parse --short HEAD');
  const fullCommitHash = runQuiet('git rev-parse HEAD');
  console.log(`✅ Commit Hash: ${commitHash} (${fullCommitHash})`);

  // 5. Inject commit hash into update.ts
  let tsContent = readFileSync(UPDATE_FILE, 'utf-8');

  // Replace or add BUNDLE_COMMIT_HASH
  if (tsContent.includes('export const BUNDLE_COMMIT_HASH')) {
    tsContent = tsContent.replace(
      /export const BUNDLE_COMMIT_HASH = '[^']*';/,
      `export const BUNDLE_COMMIT_HASH = '${commitHash}';`,
    );
  } else {
    // Add after BUNDLE_VERSION if it exists, otherwise at top of exports
    if (tsContent.includes('export const BUNDLE_VERSION')) {
      tsContent = tsContent.replace(
        /export const BUNDLE_VERSION = '[^']*';/,
        `export const BUNDLE_VERSION = '${newVersion}';\nexport const BUNDLE_COMMIT_HASH = '${commitHash}';`,
      );
    } else {
      // Add before UpdateService export
      tsContent = tsContent.replace(
        /export const UpdateService/,
        `export const BUNDLE_COMMIT_HASH = '${commitHash}';\n\nexport const UpdateService`,
      );
    }
  }

  // Also update BUNDLE_VERSION to match package.json for display
  if (tsContent.includes('export const BUNDLE_VERSION')) {
    tsContent = tsContent.replace(
      /export const BUNDLE_VERSION = '[^']*';/,
      `export const BUNDLE_VERSION = '${newVersion}';`,
    );
  }

  writeFileSync(UPDATE_FILE, tsContent);
  console.log(`✅ Injected commit hash ${commitHash} into update.ts`);

  // 6. Build Lynx Bundle (now with correct hash embedded)
  console.log('\n📦 Building Lynx Bundle...');
  try {
    run('npm run build');
    run(`cp "${BUNDLE_SOURCE}" "${BUNDLE_DEST}"`);
    console.log('✅ Lynx bundle built and updated at root');
  } catch (e) {
    console.error('❌ Build Failed:', e.message);
    process.exit(1);
  }

  // 7. Amend the commit to include build artifacts and update.ts changes
  console.log('\n🔄 Amending commit with build artifacts...');
  try {
    run('git add src/services/update.ts');
    run('git add -f main.lynx.bundle');
    run(`git commit --amend --no-edit`);
    run('git push origin main --force-with-lease');
    console.log('✅ Pushed to repository');
  } catch (e) {
    console.error('❌ Git operations failed:', e.message);
    process.exit(1);
  }

  // 8. Use the hash that was EMBEDDED in the bundle (pre-amend hash)
  // This is critical: the bundle contains `commitHash`, not the final amended hash
  const bundleUrl = `https://raw.githubusercontent.com/CodingInCarhartts/SMUTHUB/${runQuiet('git rev-parse HEAD')}/main.lynx.bundle`;

  // 9. Register in Supabase with the EMBEDDED commit_hash (not the amended one)
  console.log(
    `\n📡 Registering OTA in Supabase (embedded hash: ${commitHash})...`,
  );

  try {
    const response = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        version: newVersion,
        commit_hash: commitHash,
        is_mandatory: false,
        release_notes: customMsg || `OTA update (${commitHash})`,
        download_url: bundleUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Supabase error: ${response.status} ${await response.text()}`,
      );
    }
    console.log('✅ Supabase registered successfully.');
  } catch (error) {
    console.error('❌ Failed to register in Supabase:', error);
    process.exit(1);
  }

  console.log('\n🎉 OTA Publish Complete!');
  console.log(`Commit Hash: ${commitHash}`);
  console.log(`Bundle URL: ${bundleUrl}`);
}

publish();
