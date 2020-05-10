import { HTTP_CODES, isInternal } from '../utils.mjs';
import { getCache, getInputSourceMap, save, saveContent } from '../compilers/utils.mjs';
import fs from 'fs-extra';

const buildSource = async ctx => {
  const content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  const inputSourceMap = await getInputSourceMap(ctx.srcPath, content);
  let res;
  // TODO: make dynamic extension resolver
  // TODO: move to utils
  switch (ctx.stats.ext) {
    case '.js':
    case '.jsx':
    case '.es6':
    case '.vue':
    case '.svelte':
    case '.mjs':
    case '.ts':
    case '.tsx': {
      const { default: compileJS } = await import('../compilers/js.mjs');
      res = await compileJS(ctx, content, inputSourceMap, { skipSM: isInternal(ctx.dpath) || ctx.app.build });
      break;
    }
    case '.css':
    case '.scss':
    case '.sass':
    case '.less': {
      const { default: compileCSS } = await import('../compilers/css.mjs');
      res = await compileCSS(ctx, content, inputSourceMap, { skipSM: ctx.app.build });
      break;
    }
    case '.pug':
    case '.html': {
      const { default: compileHTML } = await import('../compilers/html.mjs');
      res = await compileHTML(ctx, content);
      break;
    }
    // default: {
    //   const { default: compileReplace } = await import('../compilers/replace.mjs');
    //   res = await replace(ctx, content);
    //   break;
    // }
    default: return save(ctx);
  }
  const { code, map } = res;
  if (map) {
    const { ua } = ctx.store;
    const stats = ctx.app.table.touch(`${ctx.srcPath}.map`);
    // TODO: add map byte length here
    const mapBuildPromise = saveContent(JSON.stringify(map), {
      dpath: `${ctx.dpath}.map`,
      path: `${ctx.path}.map`,
      stats,
      store: ctx.store,
    });
    stats.build.set(ua, mapBuildPromise);
  }
  return saveContent(code, ctx);
};

const makeBuild = ctx => ctx.stats.isSrc ?
  buildSource(ctx) :
  save(ctx);

const getBuild = async ctx => {
  const { ext } = ctx.stats;
  const { ua } = ctx.store;
  if (ext === '.map') {
    const { build: srcBuild } = ctx.app.table.get(ctx.srcPath.slice(0, -4)) || {};
    if (srcBuild) await srcBuild.get(ua);
  }
  const { build } = ctx.stats;
  const isDirty = build.isDirty(ua);
  if (isDirty) {
    if (ext === '.map') ctx.throw(HTTP_CODES.NOT_FOUND, `File ${ctx.dpath} not found`);
    if (ctx.app.verbose) console.log(`🛠️   BUILD      ${ctx.path}: ${ua.name} ${ua.ver} for ${ua.target}`);
    const buildPromise = makeBuild(ctx);
    build.set(ua, buildPromise);
    return buildPromise;
  } else {
    if (ctx.app.verbose) console.log(`⚙️   CACHE      ${ctx.path}: ${ua.name} ${ua.ver} for ${ua.target}`);
    return build.get(ua);
  }
};

export default () => async (ctx, next) => {
  const { build } = ctx.stats;
  const { ua } = ctx.store;
  try {
    await getBuild(ctx);
    if (ctx.app.verbose) console.log(`🚀  SEND       ${ctx.path}`);
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
