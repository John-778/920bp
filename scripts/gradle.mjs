/**
 * Run the Android Gradle wrapper with a known-good toolchain.
 *
 * Capacitor 7 / AGP 8.7 want JDK 21. If a JDK 21 is sitting in the usual
 * places this picks it up automatically, so `npm run android:apk` works
 * without the developer exporting JAVA_HOME by hand. Set JAVA_HOME or
 * ANDROID_HOME yourself to override either choice.
 *
 * Usage: node scripts/gradle.mjs assembleDebug
 */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'android');

if (!existsSync(androidDir)) {
  console.error('No android/ project yet. Run:  npx cap add android');
  process.exit(1);
}

/** First path that exists, or null. */
const firstExisting = (paths) => paths.find((p) => p && existsSync(p)) || null;

const javaHome =
  process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin'))
    ? process.env.JAVA_HOME
    : firstExisting([
        join(homedir(), 'AppData', 'Local', 'Android', 'tools', 'jdk21'),
        'C:/Program Files/Android/Android Studio/jbr',
        'C:/Program Files/Eclipse Adoptium/jdk-21',
        '/usr/lib/jvm/java-21-openjdk',
        '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home',
      ]);

const androidHome =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  firstExisting([
    join(homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk'),
    join(homedir(), 'Android', 'Sdk'),
  ]);

if (!androidHome) {
  console.error(
    'Android SDK not found. Install it (Android Studio, or the command line tools)\n' +
      'and set ANDROID_HOME to its location.'
  );
  process.exit(1);
}

// Gradle accepts forward slashes here on every platform, which avoids
// having to escape Windows separators.
const sdkDir = androidHome.split(String.fromCharCode(92)).join('/');
writeFileSync(join(androidDir, 'local.properties'), 'sdk.dir=' + sdkDir + String.fromCharCode(10));

const env = { ...process.env, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome };
if (javaHome) env.JAVA_HOME = javaHome;

// Run the Gradle wrapper's main class directly rather than gradlew.bat.
// cmd.exe /c mangles a quoted path containing spaces, and this project's
// path does contain them; going straight to Java sidesteps the shell and
// behaves identically on every platform.
const wrapperJar = join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.jar');
if (!existsSync(wrapperJar)) {
  console.error(`Gradle wrapper not found at ${wrapperJar}`);
  process.exit(1);
}

const javaBin = javaHome
  ? join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';

const args = process.argv.slice(2);
if (args.length === 0) args.push('assembleDebug');

console.log(`JAVA_HOME   = ${javaHome || '(system default)'}`);
console.log(`ANDROID_SDK = ${androidHome}`);
console.log(`gradle      = ${args.join(' ')}
`);

const child = spawn(
  javaBin,
  ['-Xmx2g', '-classpath', wrapperJar, 'org.gradle.wrapper.GradleWrapperMain', ...args],
  { cwd: androidDir, env, stdio: 'inherit', shell: false }
);

child.on('error', (error) => {
  console.error('Could not start Gradle:', error.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
