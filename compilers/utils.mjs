// TODO: reimplement streaming-cache
import Cache from 'streaming-cache';
import browserslist from 'browserslist';
import fs from 'fs-extra';
import path from 'path';
import stream from 'stream';

const { Readable } = stream;

const cache = new Cache();

const getKey = ctx => ctx.stats.isSrc ?
  path.join(ctx.store.root, ctx.dpath) :
  path.join('./.dist/assets/', ctx.dpath);

export const getCache = ctx => {
  const key = getKey(ctx);
  return cache.get(key);
};

const setCache = ctx => {
  const key = getKey(ctx);
  return cache.set(key);
};

export const saveContent = async (content, ctx) => new Readable({
  read() {
    this.push(content);
    this.push(null);
  },
}).pipe(setCache(ctx));

export const save = async ctx => fs.createReadStream(ctx.srcPath).pipe(setCache(ctx));

export const getBrowsersList = ua => browserslist(
  `unreleased ${ua.name} versions, ${ua.name} ${ua.ver}`,
  { ignoreUnknownVersions: true },
);

export const getInputSourceMap = async (srcPath, code) => {
  const [ , mapPath = null ] = code.match(/\/\/#\s*sourceMappingURL=(.*)/) || [];
  try {
    if (!mapPath) {
      // TODO: test with absolute/relative paths
      const mapData = await fs.readFile(`${srcPath}.map`, { encoding: 'utf8' });
      return JSON.parse(mapData);
    } else if (mapPath.startsWith('data:application/json;charset=utf-8;base64,')) {
      const [ , data64 ] = mapPath.split(',');
      const mapData = atob(data64);
      return JSON.parse(mapData);
    } else {
      const mapData = await fs.readFile(mapPath, { encoding: 'utf8' });
      return JSON.parse(mapData);
    }
  } catch (err) {
    return false;
  }
};

export const getProjectModulePath = (root, modName) =>
  path.join(root, 'node_modules', modName);

export const getScriptExtensionByAttrs = attrs => {
  if (!attrs) return '.js';
  if (attrs.type) switch (attrs.type) {
    case 'application/coffeescript':
    case 'text/coffeescript': return '.coffee';
    case 'application/typescript':
    case 'text/typescript': return '.ts';
    case 'application/jsx':
    case 'text/jsx': return '.jsx';
    default: return '.js';
  }
  if (attrs.lang) switch (attrs.lang) {
    case 'coffeescript': return '.coffee';
    case 'typescript': return '.ts';
    case 'jsx': return '.jsx';
    default: return '.js';
  }
  return '.js';
};

export const getStyleExtensionByAttrs = attrs => {
  if (!attrs) return '.css';
  if (attrs.type) switch (attrs.type) {
    case 'text/scss': return '.scss';
    case 'text/sass': return '.sass';
    case 'text/less': return '.less';
    default: return '.css';
  }
  if (attrs.lang) switch (attrs.lang) {
    case 'scss': return '.scss';
    case 'sass': return '.sass';
    case 'less': return '.less';
    default: return '.css';
  }
  return '.css';
};
