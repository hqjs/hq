import fs from 'fs-extra';
import http from 'http';
import os from 'os';
import path from 'path';

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const intfs of Object.values(interfaces)) {
    for (const intf of intfs) {
      if (intf.family == 'IPv4' && !intf.internal) return intf;
    }
  }
}

const { address: LOCAL_IP } = getLocalIP();

const WORKER_REXP = /\bworker\b/i;

export const HTTP_CODES = {
  INTERNAL_SERVER_ERROR: 500,
  NOT_ACCEPTABLE: 406,
  NOT_FOUND: 404,
  NOT_MODIFIED: 304,
  OK: 200,
};

export const WATCH_EXTENSIONS = [
  'pug',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'jsx',
  'es6',
  'mjs',
  'vue',
  'svelte',
  'json',
  'ts',
  'coffee',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
];

export const isTest = filePath => filePath.startsWith('/test/');

export const isVendor = filePath => filePath.startsWith('/node_modules/');

export const isPolyfill = filePath => filePath.startsWith('/node_modules/core-js/');

export const isSource = ext => [
  '.pug',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.js',
  '.jsx',
  '.mjs',
  '.es6',
  '.vue',
  '.svelte',
  '.ts',
  '.coffee',
  '.map',
].includes(ext);

export const getResType = ext => {
  switch (ext) {
    case '.jsx':
    case '.ts':
    case '.es6':
    case '.vue':
    case '.svelte':
    case '.coffee': return '.js';
    case '.scss':
    case '.sass':
    case '.less': return '.css';
    case '.pug': return '.html';
    default: return ext;
  }
};

/* eslint-disable complexity */
export const getLinkType = (ext, name) => {
  // TODO add other types https://w3c.github.io/preload/#as-attribute
  switch (ext) {
    case '.js':
    case '.jsx':
    case '.es6':
    case '.vue':
    case '.svelte':
    case '.ts':
    case '.coffee':
    case '.mjs': return WORKER_REXP.test(name) ? 'worker' : 'script';
    case '.json': return 'script';
    case '.scss':
    case '.sass':
    case '.less':
    case '.css': return 'style';
    case '.pug':
    case '.html': return 'document';
    case '.woff':
    case '.woff2': return 'font';
    case '.gif':
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.svg':
    case '.webp': return 'image';
    default: return '';
  }
};
/* eslint-enable complexity */

export const findExistingExtension = async filepath => {
  if (filepath.endsWith('index') && await fs.pathExists(`${filepath}.html`)) return '.html';
  else if (await fs.pathExists(`${filepath}.jsx`)) return '.jsx';
  else if (await fs.pathExists(`${filepath}.vue`)) return '.vue';
  else if (await fs.pathExists(`${filepath}.svelte`)) return '.svelte';
  else if (await fs.pathExists(`${filepath}.mjs`)) return '.mjs';
  else if (await fs.pathExists(`${filepath}.json`)) return '.json';
  else if (await fs.pathExists(`${filepath}.ts`)) return '.ts';
  else if (await fs.pathExists(`${filepath}.coffee`)) return '.coffee';
  else if (await fs.pathExists(`${filepath}.es6`)) return '.es6';
  else if (await fs.pathExists(`${filepath}.js`)) return '.js';
  else if (await fs.pathExists(filepath)) return '';
  else if (!filepath.endsWith('index') && await fs.pathExists(`${filepath}.html`)) return '.html';
  else throw new Error(`File ${filepath} not found`);
};

export const getPackageJSONDir = async dir => {
  let dirPath = dir;
  while (dirPath !== '/' && !await fs.pathExists(`${dirPath}/package.json`)) {
    dirPath = path.join(dirPath, '..');
  }
  if (!await fs.pathExists(`${dirPath}/package.json`)) return null;
  return dirPath;
};

export const readPackageJSON = async (dir, { search = true } = {}) => {
  const dirPath = search ? await getPackageJSONDir(dir) : dir;
  try {
    return JSON.parse(await fs.readFile(`${dirPath}/package.json`, { encoding: 'utf8' }));
  } catch {
    return {};
  }
};

export const resolvePackageMain = async (dir, { search = false } = {}) => {
  const dirPath = search ? await getPackageJSONDir(dir) : dir;
  const packageJSON = await readPackageJSON(dirPath, { search: false });
  return packageJSON.module || packageJSON.main || `index${await findExistingExtension(`${dirPath}/index`)}`;
};

export const getServer = ({ app, host, port }) => new Promise((resolve, reject) => {
  const server = http.createServer(app.callback());
  server.unref();
  server.on('error', reject);
  server.listen(port, host, () => {
    console.log(`Start time: ${process.uptime().toFixed(1)} s`);
    console.log(`Visit http://localhost:${port}\nor http://${LOCAL_IP}:${port} within local network`);
    import('./compilers/html.mjs');
    resolve(server);
  });
}).catch(() => getServer({ app, host, port: port + 1 }));

export const getSrc = async root => {
  const [packageJSON, rootHTML, srcHTML, srcExists] = await Promise.all([
    readPackageJSON(root),
    fs.pathExists(path.join(root, './index.html')),
    fs.pathExists(path.join(root, 'src/index.html')),
    fs.pathExists(path.join(root, 'src')),
  ]);
  return packageJSON.module ?
    path.dirname(packageJSON.module) :
    srcHTML ?
      'src' :
      rootHTML ?
        '.' :
        srcExists ?
          'src' :
          packageJSON.main ?
            path.dirname(packageJSON.main) :
            '.';
};
