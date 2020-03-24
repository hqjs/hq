#!/usr/bin/env node
const path = require('path');
const process = require('process');
const { spawn } = require('child_process');

/* eslint-disable no-magic-numbers */

const [ major, minor ] = process.version
  .slice(1)
  .split('.')
  .map(x => Number(x));

const jsonModules = major > 12 ||
  (major === 12 && minor >= 13);

const args = [
  '--experimental-modules',
  '--no-warnings',
  path.resolve(__dirname, 'index.mjs'),
];

if (jsonModules) args.splice(1, 0, '--experimental-json-modules');

const hq = spawn(
  process.argv0,
  args,
  {
    cwd: path.resolve(),
    stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ],
  },
);

hq.stdout.on('data', data => console.log(String(data)));

hq.stderr.on('data', data => console.error(String(data)));

hq.on('message', data => console.error(String(data)));
