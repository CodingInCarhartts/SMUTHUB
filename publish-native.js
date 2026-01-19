import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const GRADLE_FILE = join(process.cwd(), 'SMUTHUB/app/build.gradle.kts');
const APK_SOURCE = join(
  process.cwd(),
  'SMUTHUB/app/build/outputs/apk/debug/app-debug.apk',
);
const APK_DEST = join(process.cwd(), 'SMUTHUB.apk');
const ASSETS_DIR = join(process.cwd(), 'SMUTHUB/app/src/main/assets');
const BUNDLE_SOURCE = join(process.cwd(), 'dist/main.lynx.bundle');
const BUNDLE_DEST = join(ASSETS_DIR, 'main.lynx.bundle');

// Configuration
const REPO = 'CodingInCarhartts/SMUTHUB';
const SUPABASE_URL =
  'https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/app_native_updates';
const SUPABASE_KEY = 'sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz';

function run(command, options = {}) {
  console.log(`> ${command}`);
  return execSync(command, { stdio: 'inherit', ...options });
}

function runWithOutput(command, options = {}) {
  console.log(`> ${command}`);
  return execSync(command, { encoding: 'utf8', ...options }).trim();
}

async function publish() {
  const customMsg = process.argv[2];
  const forceVersion = process.argv
    .find((arg) => arg.startsWith('--version='))
    ?.split('=')[1];

  console.log('🦁 Starting Native Update Process (GitHub Releases Mode)...\n');
  if (customMsg) {
    console.log(`📝 Release Notes: "${customMsg}"\n`);
  }

  // 1. Bump Versions
  console.log('📦 Version Bump:');
  let gradleContent = readFileSync(GRADLE_FILE, 'utf-8');

  // Bump Version Code
  const codeMatch = gradleContent.match(/versionCode = (\d+)/);
  if (!codeMatch)
    throw new Error('Could not find versionCode in build.gradle.kts');
  const oldCode = parseInt(codeMatch[1]);
  const newCode = oldCode + 1;
  gradleContent = gradleContent.replace(
    `versionCode = ${oldCode}`,
    `versionCode = ${newCode}`,
  );
  console.log(`   Version Code (Gradle): ${oldCode} -> ${newCode}`);

  // Bump Version Name
  const nameMatch = gradleContent.match(/versionName = "(\d+\.\d+\.\d+)"/);
  if (!nameMatch)
    throw new Error('Could not find versionName in build.gradle.kts');
  const oldVer = nameMatch[1];

  let newVer;
  if (forceVersion) {
    newVer = forceVersion;
  } else {
    const [major, minor, patch] = oldVer.split('.').map(Number);
    newVer = `${major}.${minor}.${patch + 1}`;
  }

  gradleContent = gradleContent.replace(
    `versionName = "${oldVer}"`,
    `versionName = "${newVer}"`,
  );
  console.log(`   Version Name (App):    ${oldVer} -> ${newVer}`);

  writeFileSync(GRADLE_FILE, gradleContent);
  console.log('✅ Updated build.gradle.kts');

  // 2. Build Lynx Bundle
  console.log('\n📦 Building Lynx Bundle...');
  try {
    run('npm run build');
    run(`mkdir -p "${ASSETS_DIR}"`);
    run(`cp "${BUNDLE_SOURCE}" "${BUNDLE_DEST}"`);
    console.log('✅ Lynx bundle built and copied to assets');
  } catch (e) {
    console.error('❌ Lynx Build Failed:', e.message);
    process.exit(1);
  }

  // 3. Build APK
  console.log('\n🔨 Building APK... (this may take a while)');
  try {
    const env = { ...process.env, JAVA_HOME: '/opt/android-studio/jbr' };
    run('./gradlew assembleDebug', {
      cwd: join(process.cwd(), 'SMUTHUB'),
      env,
    });
  } catch (e) {
    console.error('❌ Build Failed');
    process.exit(1);
  }

  // 3. Copy APK
  run(`cp "${APK_SOURCE}" "${APK_DEST}"`);
  console.log(`✅ Copied APK to ${APK_DEST}`);

  // 3.5 Manual Sign to ensure V1 signature (Fix for parsing error)
  const apksigner = '/home/yum/Android/Sdk/build-tools/36.1.0/apksigner';
  const keystore = join(process.cwd(), 'SMUTHUB/app/debug.keystore');
  console.log('\n🔐 Manually enforcing V1/V2 signatures...');
  try {
    run(
      `${apksigner} sign --ks "${keystore}" --ks-pass pass:android --key-pass pass:android --v1-signing-enabled true --v2-signing-enabled true --min-sdk-version 23 "${APK_DEST}"`,
    );
    console.log('✅ APK manually signed with V1+V2 schemes');
  } catch (e) {
    console.warn(
      '⚠️ Manual signing failed (apksigner not found?), relying on Gradle build:',
      e.message,
    );
  }

  // 4. Create GitHub Release
  const tagName = `native-v${newVer}`;
  const releaseTitle = `Native Update v${newVer}`;
  const releaseNotes = customMsg || `Native update v${newVer}`;

  console.log(`\n🚀 Creating GitHub Release: ${tagName}...`);
  try {
    // Delete existing tag/release if it exists (for retries)
    try {
      run(`gh release delete ${tagName} --yes --cleanup-tag`, {
        stdio: 'ignore',
      });
    } catch (e) {}

    run(
      `gh release create ${tagName} "${APK_DEST}#SMUTHUB.apk" --title "${releaseTitle}" --notes "${releaseNotes}"`,
    );
    console.log(`✅ GitHub Release created and APK uploaded.`);
  } catch (e) {
    console.error('❌ GitHub Release failed:', e.message);
    process.exit(1);
  }

  // 5. Commit and Push version bump
  console.log('\nrw Committing version bump...');
  try {
    run(`git add ${GRADLE_FILE}`);
    run(`git commit -m "🔖 native: bump version to ${newVer}"`);
    run('git push origin main');
    console.log('✅ Version bump pushed to repository');
  } catch (e) {
    console.warn('⚠️ Git push failed, but release was created:', e.message);
  }

  // 6. Update Supabase
  console.log(`\n📡 Registering update in Supabase (v${newVer})...`);
  const downloadUrl = `https://github.com/${REPO}/releases/download/${tagName}/SMUTHUB.apk`;

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
        version: newVer,
        download_url: downloadUrl,
        is_mandatory: false,
        release_notes: releaseNotes,
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

  console.log('\n🎉 Native Publish Complete!');
  console.log(`Download URL: ${downloadUrl}`);
}

publish();
