import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Supabase config (hardcoded for developer convenience, matches src/services/supabase.ts)
const SUPABASE_URL = 'https://exymyvbkjsttqsnifedq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz';

async function publish() {
  console.log('\n🚀 SMUTHUB Update Publisher\n');

  // 1. Get current version
  const updateTsPath = path.resolve('src/services/update.ts');
  const updateTsContent = fs.readFileSync(updateTsPath, 'utf8');
  const versionMatch = updateTsContent.match(/export const APP_VERSION = '(.+)';/);
  const currentVersion = versionMatch ? versionMatch[1] : 'unknown';
  
  console.log(`Current version: ${currentVersion}`);

  // 2. Prompt for new values
  const nextPatch = currentVersion.split('.').map((n, i) => i === 2 ? parseInt(n) + 1 : n).join('.');
  const version = await question(`New version [${nextPatch}]: `) || nextPatch;
  const notes = await question('Release notes: ') || 'Performance improvements and bug fixes.';
  const mandatoryInput = await question('Is update mandatory? (y/N): ');
  const isMandatory = mandatoryInput.toLowerCase() === 'y';

  console.log('\nSummary of update:');
  console.log(`- Version: ${version}`);
  console.log(`- Notes: ${notes}`);
  console.log(`- Mandatory: ${isMandatory}\n`);

  const confirm = await question('Proceed with publishing? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  // 3. Update src/services/update.ts
  console.log(`Updating ${updateTsPath}...`);
  const newContent = updateTsContent.replace(
    /export const APP_VERSION = '.+';/,
    `export const APP_VERSION = '${version}';`
  );
  fs.writeFileSync(updateTsPath, newContent);

  // 4. Push to Supabase
  console.log('Pushing to Supabase...');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_updates`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        version,
        release_notes: notes,
        is_mandatory: isMandatory
      })
    });

    if (!response.ok) {
        throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
    }
    console.log('✅ Supabase updated.');
  } catch (e) {
    console.error('❌ Failed to update Supabase:', e.message);
    process.exit(1);
  }

  // 5. Git Commit & Push
  console.log('Committing and pushing to Git...');
  try {
    execSync('git add .');
    execSync(`git commit -m "chore: release v${version}"`);
    execSync('git push origin main');
    console.log('✅ Git updated and pushed.');
  } catch (e) {
    console.warn('⚠️ Git update failed (or nothing to commit), please push manually.');
  }

  console.log('\n✨ Update successfully published!\n');
  rl.close();
}

publish();
