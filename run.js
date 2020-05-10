#!/usr/bin/env node
const path = require('path');
const process = require('process');
const { spawn } = require('child_process');
const { version } = require('./package.json');

/* eslint-disable no-magic-numbers */

if (process.argv.includes('-v')) {
  console.log(version);
  process.exit(0);
}

const [ major, minor ] = process.version
  .slice(1)
  .split('.')
  .map(x => Number(x));

const supported = major > 12 ||
  (major === 12 && minor >= 10);

if (!supported) {
  console.error('Error: Usupported node version.\nPlease use node >= 12.10.0 to run hq.');
  process.exit(1);
}

const jsModules = major < 14;

const args = [ '--no-warnings' ];

if (jsModules) args.push('--experimental-modules');

const postArgs = [];
const buildIndex = process.argv.indexOf('build');
if (buildIndex !== -1) {
  postArgs.push('build');
  const buildArg = process.argv[buildIndex + 1];
  if (buildArg) postArgs.push(buildArg);
}
const verbose = process.argv.includes('--verbose');
if (verbose) postArgs.push('--verbose');

console.log(`(c) hqjs @ ${version}`);

const hq = spawn(
  process.argv0,
  [ ...args, path.resolve(__dirname, 'index.mjs'), ...postArgs ],
  {
    cwd: path.resolve(),
    stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ],
  },
);

hq.stdout.on('data', data => console.log(String(data)));

hq.stderr.on('data', data => console.error(String(data)));

hq.on('message', data => console.error(String(data)));
