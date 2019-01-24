import { HTTP_CODES, findExistingExtension, isTest, isVendor, resolvePackageMain } from '../utils.mjs';
import fs from 'fs-extra';
import path from 'path';

const pathMap = new Map;

const scriptDir = path.dirname(import.meta.url.slice('file://'.length));

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

const resolvePath = async ctx => {
  if (ctx.path.includes('/hq-livereload.js')) {
    ctx.srcPath = `${scriptDir}/..${ctx.path}`;
    ctx.dirname = path.dirname(ctx.path);
    const stats = ctx.path.endsWith('.map') ? { size: 0 } : await fs.lstat(ctx.srcPath);
    ctx.size = stats.size;
  } else {
    let isDirectory = false;
    try {
      const relPath = isTest(ctx.path) || isVendor(ctx.path) ? `.${ctx.path}` : `${ctx.app.src}${ctx.path}`;
      ctx.srcPath = path.resolve(relPath);
      ctx.srcPath = await fs.realpath(ctx.srcPath);
      const stats = await fs.lstat(ctx.srcPath);
      ctx.size = stats.size;
      isDirectory = stats.isDirectory();
      if (isDirectory) {
        const main = await resolvePackageMain(ctx.srcPath, { search: false });
        ctx.srcPath = path.join(ctx.srcPath, main);
        ctx.path = path.join(ctx.path, main);
        ctx.dirname = path.dirname(ctx.path);
      } else {
        ctx.dirname = path.dirname(ctx.path);
      }
    } catch {
      try {
        const ext = await findExistingExtension(ctx.srcPath);
        if (isDirectory && ext === '') ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
        ctx.path += ext;
        ctx.srcPath += ext;
        ctx.dirname = path.dirname(ctx.path);
      } catch {
        if (path.extname(ctx.path).toLocaleLowerCase() === '.map') {
          const srcPath = await fs.realpath(ctx.srcPath.slice(0, -4));
          ctx.srcPath = `${srcPath}.map`;
          ctx.dirname = path.dirname(ctx.path);
          // TODO: resolve size from build here
          ctx.size = 0;
        } else if(ctx.path.endsWith('favicon.ico')) {
          ctx.srcPath = `${scriptDir}/../hqjs.png`;
          ctx.dirname = path.dirname(ctx.path);
          const stats = await fs.lstat(ctx.srcPath);
          ctx.size = stats.size;
        } else {
          ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
        }
      }
    }
  }
};
