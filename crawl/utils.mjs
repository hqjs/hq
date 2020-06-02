import fs from 'fs-extra';
import nodeFetch from 'node-fetch';
import path from 'path';

/* eslint-disable no-magic-numbers */

const packageCache = new Map;
const scriptNameCache = new Map;

export const getBundleName = src => {
  const dirname = path.dirname(src);
  const ext = path.extname(src);
  const basename = path.basename(src, ext);
  return `${dirname}bundle-${basename}.js`;
};

export const getDirectoryScriptName = (root, src) => {
  try {
    const packagePath = path.resolve(root, src.slice(1), 'package.json');
    const packageJSON = packageCache.get(packagePath) ||
      JSON.parse(fs.readFileSync(packagePath, { encoding: 'utf-8' }));
    packageCache.set(packagePath, packageJSON);
    const main = packageJSON.module ||
      (typeof packageJSON.browser === 'string' && packageJSON.browser) ||
      packageJSON.main;
    const fullPath = path.resolve(src, main.startsWith('/') ? main.slice(1) : main);
    return changeScriptExt(fullPath);
  } catch {
    return path.resolve(src, 'index.js');
  }
};

export const getScriptName = (root, src) => {
  const [ url ] = src.split('?')[0].split('#');
  const fsPath = path.resolve(root, url.slice(1));
  if (scriptNameCache.has(fsPath)) return scriptNameCache.get(fsPath);
  try {
    const stats = fs.lstatSync(fsPath);
    const isDirectory = stats.isDirectory();
    if (isDirectory) {
      const res = getDirectoryScriptName(root, url);
      scriptNameCache.set(fsPath, res);
      return res;
    } else {
      const res = changeScriptExt(url);
      scriptNameCache.set(fsPath, res);
      return res;
    }
  } catch {
    const res = changeScriptExt(url);
    scriptNameCache.set(fsPath, res);
    return res;
  }
};

export const changeScriptExt = src => {
  if (src.endsWith('.js') || src.endsWith('.mjs')) return src;
  if (src.endsWith('.jsx')) return `${src.slice(0, -4)}.js`;
  if (src.endsWith('.es6')) return `${src.slice(0, -4)}.js`;
  if (src.endsWith('.ts')) return `${src.slice(0, -3)}.js`;
  if (src.endsWith('.tsx')) return `${src.slice(0, -4)}.js`;
  if (src.endsWith('.coffee')) return `${src.slice(0, -7)}.js`;
  if (src.endsWith('.vue')) return `${src.slice(0, -4)}.js`;
  if (src.endsWith('.svelte')) return `${src.slice(0, -7)}.js`;
  return `${src}.js`;
};

export const changeStyleExt = src => {
  if (src.endsWith('.css')) return src;
  if (src.endsWith('.scss')) return `${src.slice(0, -5)}.css`;
  if (src.endsWith('.sass')) return `${src.slice(0, -5)}.css`;
  if (src.endsWith('.less')) return `${src.slice(0, -5)}.css`;
  return `${src}.css`;
};

export const fetch = (url, options) => nodeFetch(url, { timeout: 60000, ...options })
  .catch(() => nodeFetch(url, { timeout: 60000, ...options }));
