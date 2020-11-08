import {
  HTTP_CODES,
  findExistingExtension,
  getModulePath,
  isCertificate,
  isDefaultFavicon,
  isInternal,
  isMap,
  isPolyfill,
  isTest,
  isVendor,
  resolvePackageFrom,
  resolvePackageMain,
  urlToPath,
} from '../utils.mjs';
import fs from 'fs-extra';
import path from 'path';
import querystring from 'querystring';

const pathMap = new Map;

const humanReadableSize = size => size < 1024 ?
  `${size}b` :
  size < 1024 * 1024 ?
    `${(size / 1024).toFixed(1)}Kb` :
    `${(size / 1024 / 1024).toFixed(2)}Mb`;

export default () => async (ctx, next) => {
  ctx.dpath = querystring.unescape(ctx.path);
  ctx.module = ctx.query['hq_type'] !== 'nomodule';
  const current = pathMap.get(ctx.dpath);
  if (current !== undefined) {
    ctx.dirname = current.dirname;
    ctx.srcPath = current.srcPath;
    ctx.size = current.size;
  } else {
    await resolvePath(ctx);
    pathMap.set(ctx.dpath, {
      dirname: ctx.dirname,
      size: ctx.size,
      srcPath: ctx.srcPath,
    });
  }
  if (ctx.app.verbose) {
    const resolvedPath = isMap(ctx.dpath) ? 'virtual' : `${ctx.srcPath} ${humanReadableSize(ctx.size)}`;
    console.log(`🔎  RESOLVE    ${ctx.path}: ${resolvedPath}`);
  }
  return next();
};

const resolveInternal = async ctx => {
  ctx.srcPath = path.join(ctx.app.hqroot, urlToPath(ctx.dpath).slice(1));
  ctx.dirname = path.dirname(ctx.dpath);
  const stats = isMap(ctx.dpath) ? { size: 0 } : await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolvePolyfill = async ctx => {
  try {
    const srcPath = await resolvePackageFrom(ctx.app.hqroot, ctx.dpath, ctx.app.hqroot);
    ctx.srcPath = await fs.realpath(srcPath);
    const stats = await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
    ctx.dpath = getModulePath(ctx.srcPath);
    ctx.dirname = path.dirname(ctx.dpath);
  } catch {
    if (isMap(ctx.dpath)) {
      try {
        ctx.srcPath = await resolvePackageFrom(ctx.app.hqroot, ctx.dpath.slice(0, -4), ctx.app.hqroot);
        ctx.dpath = getModulePath(ctx.srcPath);
        await resolveMap(ctx);
      } catch {
        ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
      }
    } else ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
  }
};

const resolveVendor = async ctx => {
  try {
    const srcPath = await resolvePackageFrom(ctx.app.root, ctx.dpath, ctx.app.hqroot);
    ctx.srcPath = await fs.realpath(srcPath);
    const stats = await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
    ctx.dpath = getModulePath(ctx.srcPath);
    ctx.dirname = path.dirname(ctx.dpath);
  } catch {
    if (isMap(ctx.dpath)) {
      try {
        ctx.srcPath = await resolvePackageFrom(ctx.app.root, ctx.dpath.slice(0, -4), ctx.app.hqroot);
        ctx.dpath = getModulePath(ctx.srcPath);
        await resolveMap(ctx);
      } catch {
        ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
      }
    } else ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
  }
};

const resolveSrc = async ctx => {
  let isDirectory = false;
  try {
    const relPath = isTest(ctx.dpath) ?
      `.${urlToPath(ctx.dpath)}` :
      path.join(ctx.app.src, urlToPath(ctx.dpath).slice(1));
    ctx.srcPath = path.resolve(ctx.app.root, relPath);
    ctx.srcPath = await fs.realpath(ctx.srcPath);
    const stats = await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
    isDirectory = stats.isDirectory();
    if (isDirectory) {
      await resolveDirectory(ctx);
    } else {
      ctx.dirname = path.dirname(ctx.dpath);
    }
  } catch {
    if (isDirectory) ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
    try {
      await resolveFile(ctx);
    } catch {
      if (isMap(ctx.dpath)) {
        const srcPath = ctx.srcPath.slice(0, -4);
        const ext = await findExistingExtension(srcPath);
        ctx.srcPath = `${srcPath}${ext}`;
        ctx.dpath = `${ctx.dpath.slice(0, -4)}${ext}`;
        await resolveMap(ctx);
      } else if (isDefaultFavicon(ctx.dpath)) await resolveFavicon(ctx);
      else ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
    }
  }
};

const resolveFavicon = async ctx => {
  ctx.srcPath = `${ctx.app.hqroot}/hqjs.png`;
  ctx.dirname = path.dirname(ctx.dpath);
  const stats = await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolveMap = async ctx => {
  ctx.srcPath = `${ctx.srcPath}.map`;
  ctx.dpath = `${ctx.dpath}.map`;
  ctx.dirname = path.dirname(ctx.dpath);
  // TODO: resolve size from build here
  ctx.size = 0;
};

const resolveFile = async ctx => {
  const ext = await findExistingExtension(ctx.srcPath);
  ctx.dpath += ext;
  ctx.srcPath += ext;
  ctx.dirname = path.dirname(ctx.dpath);
  const stats = await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolveDirectory = async ctx => {
  const main = await resolvePackageMain(ctx.srcPath, { search: false });
  const srcPath = path.join(ctx.srcPath, main);
  const ext = await findExistingExtension(srcPath);
  const fileName = `${main}${ext}`;
  ctx.srcPath = path.join(ctx.srcPath, fileName);
  ctx.dpath = path.join(ctx.dpath, fileName);
  ctx.dirname = path.dirname(ctx.dpath);
  const stats = await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolvePath = async ctx => {
  if (isCertificate(ctx.dpath, ctx.app)) return ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
  if (isInternal(ctx.dpath)) return resolveInternal(ctx);
  if (isPolyfill(ctx.dpath)) return resolvePolyfill(ctx);
  if (isVendor(ctx.dpath)) return resolveVendor(ctx);
  return resolveSrc(ctx);
};
