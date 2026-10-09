#!/usr/bin/env node
/**
 * Generate api/astrology/tz_lookup_data.php from the `tz-lookup` npm package
 * (CC0-1.0 / public domain) so the PHP API resolves coordinates → IANA zone
 * with exactly the same quadtree the browser and Node server use.
 *
 *   node scripts/build-tz-lookup-table.mjs
 *
 * AstroEngine::timeZoneIdForCoordinates() is a line-for-line port of the
 * tz-lookup decoder; this file only carries its data (U = quadtree string,
 * T = zone name table).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve('tz-lookup/package.json'));
const version = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')).version;
const source = readFileSync(resolve(packageDir, 'tz.js'), 'utf8');

const start = source.indexOf('var U=');
const end = source.indexOf(';if(W=+W');
if (start < 0 || end < 0) {
  throw new Error('Unrecognised tz-lookup layout; update this generator.');
}
// eslint-disable-next-line no-new-func
const { U, T } = new Function(`${source.slice(start, end)}; return { U, T };`)();
if (typeof U !== 'string' || !Array.isArray(T) || T.length < 300) {
  throw new Error('tz-lookup data extraction failed.');
}

const phpString = value => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lines = [
  '<?php',
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' * Rebuild with: node scripts/build-tz-lookup-table.mjs',
  ' *',
  ` * Coordinate → IANA time-zone quadtree from the tz-lookup npm package v${version}`,
  ' * (CC0-1.0, public domain). Decoded by AstroEngine::timeZoneIdForCoordinates().',
  ' */',
  'return [',
  `    'version' => '${version}',`,
  `    'zones' => [`,
  ...T.map(zone => `        ${phpString(zone)},`),
  '    ],',
  `    'tree' => ${phpString(U)},`,
  '];',
  ''
];
const out = resolve(root, 'api', 'astrology', 'tz_lookup_data.php');
writeFileSync(out, lines.join('\n'));
console.log(`Wrote ${relative(root, out)} (tz-lookup ${version}, ${T.length} zones, ${U.length} tree chars)`);
