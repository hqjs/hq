import { HTTP_CODES, findExistingExtension, isPolyfill, isTest, isVendor, resolvePackageMain } from '../utils.mjs';
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

const resolveLivereload = async ctx => {
  ctx.srcPath = `${ctx.app.hqroot}${ctx.path}`;
  ctx.dirname = path.dirname(ctx.path);
  const stats = ctx.path.endsWith('.map') ? { size: 0 } : await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolveFavicon = async ctx => {
  ctx.srcPath = `${ctx.app.hqroot}/hqjs.png`;
  ctx.dirname = path.dirname(ctx.path);
  const stats = await fs.lstat(ctx.srcPath);
  ctx.size = stats.size;
};

const resolveMap = async ctx => {
  const srcPath = await fs.realpath(ctx.srcPath.slice(0, -4));
  ctx.srcPath = `${srcPath}.map`;
  ctx.dirname = path.dirname(ctx.path);
  // TODO: resolve size from build here
  ctx.size = 0;
};

const resolveFile = async (ctx, isDirectory) => {
  const ext = await findExistingExtension(ctx.srcPath);
  if (isDirectory && ext === '') ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
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
  if (ctx.path.includes('/hq-livereload.js')) return resolveLivereload(ctx);
  let isDirectory = false;
  try {
    const relPath = isPolyfill(ctx.path) ?
      `${ctx.app.hqroot}${ctx.path}` :
      isTest(ctx.path) || isVendor(ctx.path) ?
        `.${ctx.path}` :
        `${ctx.app.src}${ctx.path}`;
    // realpath throws if file does not exists that's why we change srcPath
    ctx.srcPath = path.resolve(ctx.app.root, relPath);
    ctx.srcPath = await fs.realpath(ctx.srcPath);
    const stats = await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
    isDirectory = stats.isDirectory();
    if (isDirectory) {
      await resolveDirectory(ctx);
      return null;
    }
    ctx.dirname = path.dirname(ctx.path);
    return null;
  } catch {
    try {
      await resolveFile(ctx, isDirectory);
      return null;
    } catch {
      if (path.extname(ctx.path).toLocaleLowerCase() === '.map') return resolveMap(ctx);
      if (ctx.path.endsWith('favicon.ico')) return resolveFavicon(ctx);
      return ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
    }
  }
};
