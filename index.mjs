import path from 'path';
import server from './server.mjs';

const PORT = 8080;

const ROOT = path.resolve();

const buildIndex = process.argv.indexOf('build');
const build = buildIndex !== -1;
const buildArg = build ? process.argv[buildIndex + 1] : null;
const verbose = process.argv.includes('--verbose');

server(ROOT, PORT, { build, buildArg, verbose });
