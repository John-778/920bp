/**
 * Build the iOS app with xcodebuild. macOS only.
 *
 * Mirrors scripts/gradle.mjs for the other platform: it checks the toolchain,
 * runs `pod install` when the Pods are missing, and then builds.
 *
 * Usage:
 *   node scripts/xcode.mjs simulator   # unsigned .app for the iOS Simulator
 *   node scripts/xcode.mjs archive     # signed .xcarchive (needs a Team)
 *
 * The simulator build needs no Apple account and no certificates, so it is
 * the fastest way to confirm the project compiles. Putting the app on a
 * physical iPhone needs a signing Team - set DEVELOPMENT_TEAM, or pick one in
 * Xcode under the App target -> Signing & Capabilities.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(root, 'ios', 'App');
const workspace = join(appDir, 'App.xcworkspace');

if (process.platform !== 'darwin') {
  console.error(
    'iOS builds need macOS: xcodebuild and CocoaPods do not run on ' +
      `${process.platform}.\n` +
      'Options:\n' +
      '  - build on a Mac (see README section 8), or\n' +
      '  - push the repo and run the "iOS build" GitHub Actions workflow,\n' +
      '    which builds this project on a macOS runner.'
  );
  process.exit(1);
}

if (!existsSync(workspace)) {
  console.error(`No Xcode workspace at ${workspace}. Run:  npx cap add ios`);
  process.exit(1);
}

const run = (cmd, args, opts = {}) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) {
    console.error(`Could not start ${cmd}: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
};

// Pods are gitignored and are not resolvable on Windows, so a fresh clone
// always needs this once.
if (!existsSync(join(appDir, 'Pods'))) {
  run('pod', ['install'], { cwd: appDir });
}

const mode = process.argv[2] || 'simulator';

if (mode === 'simulator') {
  run('xcodebuild', [
    '-workspace', workspace,
    '-scheme', 'App',
    '-configuration', 'Debug',
    '-sdk', 'iphonesimulator',
    '-derivedDataPath', join(root, 'ios', 'build'),
    'CODE_SIGNING_ALLOWED=NO',
    'build',
  ]);
  console.log(
    '\nBuilt: ios/build/Build/Products/Debug-iphonesimulator/App.app\n' +
      'Run it with:  xcrun simctl install booted <that path> ' +
      '&& xcrun simctl launch booted com.vidulbhosale.buspass'
  );
} else if (mode === 'archive') {
  const archive = join(root, 'ios', 'build', 'App.xcarchive');
  run('xcodebuild', [
    '-workspace', workspace,
    '-scheme', 'App',
    '-configuration', 'Release',
    '-destination', 'generic/platform=iOS',
    '-archivePath', archive,
    'archive',
  ]);
  console.log(
    `\nArchived: ${archive}\n` +
      'Export an .ipa from Xcode (Window -> Organizer) or with ' +
      '`xcodebuild -exportArchive`.'
  );
} else {
  console.error(`Unknown mode "${mode}". Use "simulator" or "archive".`);
  process.exit(1);
}
