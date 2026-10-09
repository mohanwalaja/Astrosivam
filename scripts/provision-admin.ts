import { db } from '../server/db/store.js';

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => arg !== '--promote-existing' && arg !== '--help')) {
  console.error('Usage: npm run provision:admin [-- --promote-existing]');
  process.exit(2);
}
if (args.has('--help')) {
  console.log('Provision a Node-backed administrator using ASTROSIVAM_ADMIN_* environment variables.');
  console.log('Pass --promote-existing only after verifying ownership of an existing account.');
  process.exit(0);
}

const email = process.env.ASTROSIVAM_ADMIN_EMAIL?.trim();
const name = process.env.ASTROSIVAM_ADMIN_NAME?.trim();
const password = process.env.ASTROSIVAM_ADMIN_PASSWORD;
if (!email || !name || !password) {
  console.error('Set ASTROSIVAM_ADMIN_EMAIL, ASTROSIVAM_ADMIN_NAME, and ASTROSIVAM_ADMIN_PASSWORD in the trusted server environment.');
  process.exit(2);
}

try {
  const admin = db.provisionAdminAccount({
    name,
    email,
    password,
    mobile: process.env.ASTROSIVAM_ADMIN_MOBILE,
    country: process.env.ASTROSIVAM_ADMIN_COUNTRY
  }, args.has('--promote-existing'));
  console.log(`Administrator account provisioned for ${admin.email}. The password was not displayed.`);
} catch (error: any) {
  console.error(error?.message || 'Administrator provisioning failed.');
  process.exitCode = 1;
}
