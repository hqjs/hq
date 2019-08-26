import {
  HTTP_CODES,
  findExistingExtension,
  getModulePath,
  isDefaultFavicon,
  isInternal,
  isMap,
  isPolyfill,
  isTest,
  isVendor,
  resolvePackageFrom,
  resolvePackageMain,
} from '../utils.mjs';
import fs from 'fs-extra';
import path from 'path';

const pathMap = new Map;

export default () => async (ctx, next) => {
  ctx.originalPath = ctx.path;
  const current = pathMap.get(ctx.path);
  if (current !== undefined) {
    ctx.dirname = current.dirname;
    ctx.srcPath = current.srcPath;
    ctx.size = current.size;
    if (ctx.app.debug) console.log(
      'Resolve path',
      ctx.path,
      ctx.srcPath,
      ctx.dirname,
      ctx.size
    );
  } else {
    await resolvePath(ctx);
    if (ctx.app.debug) console.log(
      'Resolving path',
      ctx.path,
      ctx.srcPath,
      ctx.dirname,
      ctx.size
    );
    pathMap.set(ctx.path, {
      dirname: ctx.dirname,
      size: ctx.size,
      srcPath: ctx.srcPath,
    });
  }
  return next();
};

const resolveInternal = async ctx => {
  ctx.srcPath = `${ctx.app.hqroot}${ctx.path}`;
  ctx.dirname = path.dirname(ctx.path);
  const stats = ctx.path.endsWith('.map') ? { size: 0 } : await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolvePolyfill = async ctx => {
  try {
    const srcPath = await resolvePackageFrom(ctx.app.hqroot, ctx.path);
    ctx.srcPath = await fs.realpath(srcPath);
    const stats = await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
    ctx.path = getModulePath(ctx.srcPath);
    ctx.dirname = path.dirname(ctx.path);
  } catch {
    if (isMap(ctx.path)) {
      try {
        ctx.srcPath = await resolvePackageFrom(ctx.app.hqroot, ctx.path.slice(0, -4));
        await resolveMap(ctx);
      } catch {
        ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
      }
    } else ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
  }
};

const resolveVendor = async ctx => {
  try {
    const srcPath = await resolvePackageFrom(ctx.app.root, ctx.path);
    ctx.srcPath = await fs.realpath(srcPath);
    const stats = await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
    ctx.path = getModulePath(ctx.srcPath);
    ctx.dirname = path.dirname(ctx.path);
  } catch {
    if (isMap(ctx.path)) {
      try {
        ctx.srcPath = await resolvePackageFrom(ctx.app.root, ctx.path.slice(0, -4));
        await resolveMap(ctx);
      } catch {
        ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
      }
    } else ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
  }
};

const resolveSrc = async ctx => {
  try {
    const relPath = isTest(ctx.path) ?
      `.${ctx.path}` :
      `${ctx.app.src}${ctx.path}`;
    ctx.srcPath = path.resolve(ctx.app.root, relPath);
    ctx.srcPath = await fs.realpath(ctx.srcPath);
    const stats = await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
    if (stats.isDirectory()) {
      try {
        await resolveDirectory(ctx);
      } catch {
        ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
      }
    } else {
      ctx.dirname = path.dirname(ctx.path);
    }
  } catch {
    try {
      await resolveFile(ctx);
    } catch {
      if (isMap(ctx.path)) {
        ctx.srcPath = ctx.srcPath.slice(0, -4);
        await resolveMap(ctx);
      } else if (isDefaultFavicon(ctx.path)) await resolveFavicon(ctx);
      else ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
    }
  }
};

const resolveFavicon = async ctx => {
  ctx.srcPath = `${ctx.app.hqroot}/hqjs.png`;
  ctx.dirname = path.dirname(ctx.path);
  const stats = await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolveMap = async ctx => {
  try {
    const srcPath = await fs.realpath(ctx.srcPath);
    ctx.srcPath = `${srcPath}.map`;
    ctx.dirname = path.dirname(ctx.path);
    // TODO: resolve size from build here
    ctx.size = 0;
  } catch {
    ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
  }
};

const resolveFile = async ctx => {
  const ext = await findExistingExtension(ctx.srcPath);
  ctx.path += ext;
  ctx.srcPath += ext;
  ctx.dirname = path.dirname(ctx.path);
};

const resolveDirectory = async ctx => {
  const main = await resolvePackageMain(ctx.srcPath, { search: false });
  const srcPath = path.join(ctx.srcPath, main);
  const ext = await findExistingExtension(srcPath);
  const fileName = `${main}${ext}`;
  ctx.srcPath = path.join(ctx.srcPath, fileName);
  ctx.path = path.join(ctx.path, fileName);
  ctx.dirname = path.dirname(ctx.path);
};

const resolvePath = async ctx => {
  if (isInternal(ctx.path)) return resolveInternal(ctx);
  if (isPolyfill(ctx.path)) return resolvePolyfill(ctx);
  if (isVendor(ctx.path)) return resolveVendor(ctx);
  return resolveSrc(ctx);
};
