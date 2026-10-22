const { spawnSync } = require('node:child_process');

const value = process.env.EXPO_PUBLIC_API_BASE_URL;
let apiUrl;
try { apiUrl = new URL(value); } catch { /* Report a useful build error below. */ }
if (!apiUrl || apiUrl.protocol !== 'https:') {
  console.error('Set EXPO_PUBLIC_API_BASE_URL to the HTTPS Render API URL before building.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--max-workers', '2'], {
  stdio: 'inherit',
  // Hosting variables are authoritative; do not bake a laptop LAN URL into the website.
  env: { ...process.env, EXPO_NO_DOTENV: '1' },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
