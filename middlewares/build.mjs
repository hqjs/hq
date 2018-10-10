import { getCache, save } from '../compilers/utils.mjs';
import HTTP_CODES from 'http-status-codes';

const buildSource = async ctx => {
  // TODO make dynamic extension resolver
  switch (ctx.stats.ext) {
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.ts': {
      const { default: compileJS } = await import('../compilers/js.mjs');
      return compileJS(ctx);
    }
    case '.css':
    case '.scss':
    case '.sass':
    case '.less': {
      const { default: compileCSS } = await import('../compilers/css.mjs');
      return compileCSS(ctx);
    }
    case '.html': {
      const { default: compileHTML } = await import('../compilers/html.mjs');
      return compileHTML(ctx);
    }
    // default: {
    //   const { default: compileReplace } = await import('../compilers/replace.mjs');
    //   return replace(ctx);
    // }
    default: return save(ctx);
  }
};

const makeBuild = ctx => ctx.stats.isSrc ?
  buildSource(ctx) :
  save(ctx);

const getBuild = async ctx => {
  const { build, ext } = ctx.stats;
  const { ua } = ctx.store;
  const isDirty = build.isDirty(ua);
  if (isDirty) {
    if (ext === '.map') ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.path} not found`);
    if (ctx.app.debug) console.log('Building', ctx.path, ua);
    const buildPromise = makeBuild(ctx);
    build.set(ua, buildPromise);
    return buildPromise;
  } else {
    if (ctx.app.debug) console.log('Skip building', ctx.path);
    return build.get(ua);
  }
};

export default () => async (ctx, next) => {
  const { build } = ctx.stats;
  const { ua } = ctx.store;
  try {
    await getBuild(ctx);
    if (ctx.app.debug) console.log('Sending', ctx.path);
    ctx.type = ctx.stats.type;
    ctx.body = getCache(ctx);
  } catch (err) {
    build.setDirty(ua);
    ctx.body = err.message;
    ctx.throw(HTTP_CODES.INTERNAL_SERVER_ERROR, err);
    return null;
  }
  return next();
};
