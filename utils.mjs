import fs from 'fs-extra';
import path from 'path';

const WORKER_REXP = /\bworker\b/i;

export const WATCH_EXTENSIONS = [
  'html',
  'css',
  'sass',
  'less',
  'js',
  'jsx',
  'mjs',
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

export const isSource = ext => [
  '.html',
  '.css',
  '.sass',
  '.less',
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.coffee',
  '.map',
].includes(ext);

export const getResType = ext => {
  switch (ext) {
    case '.jsx':
    case '.ts':
    case '.coffee': return '.js';
    case '.sass':
    case '.less': return '.css';
    default: return ext;
  }
};

export const getLinkType = (ext, name) => {
  // TODO add other types https://w3c.github.io/preload/#as-attribute
  switch (ext) {
    case '.js':
    case '.jsx':
    case '.ts':
    case '.coffee':
    case '.mjs': return WORKER_REXP.test(name) ? 'worker' : 'script';
    case '.json': return 'script';
    case '.sass':
    case '.less':
    case '.css': return 'style';
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

export const findExistingExtension = async filepath => {
  if (filepath.endsWith('index') && await fs.pathExists(`${filepath}.html`)) return '.html';
  else if (await fs.pathExists(`${filepath}.js`)) return '.js';
  else if (await fs.pathExists(`${filepath}.jsx`)) return '.jsx';
  else if (await fs.pathExists(`${filepath}.mjs`)) return '.mjs';
  else if (await fs.pathExists(`${filepath}.json`)) return '.json';
  else if (await fs.pathExists(`${filepath}.ts`)) return '.ts';
  else if (await fs.pathExists(`${filepath}.coffee`)) return '.coffee';
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
