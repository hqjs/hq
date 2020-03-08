import cssnano from 'cssnano';
import { getBrowsersList } from './utils.mjs';
import less from 'postcss-less-engine';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';
import { readPlugins } from '../utils.mjs';
import sass from 'postcss-node-sass';

export const modulesCache = new Map;

// TODO: refactor
/* eslint-disable max-statements */
export default async (ctx, content, sourceMap, { skipSM = false, useModules = modulesCache.has(ctx.srcPath) } = {}) => {
  const cssPlugins = await readPlugins(ctx, '.postcssrc');

  const { ua } = ctx.store;
  // const replaced = await replaceRelativePath(ctx);
  const plugins = [
    ...cssPlugins,
    postcssPresetEnv({
      browsers: getBrowsersList(ua),
      features: {
        calc: false,
        customProperties: false,
        prev: sourceMap,
      },
    }),
  ];
  if (ctx.app.production) {
    plugins.push(cssnano({
      preset: [
        'default', {
          reduceInitial: false,
          reduceTransforms: false,
        },
      ],
    }));
  }
  const options = { from: `${ctx.originalPath}.map*` };
  if (!skipSM) options.map = {
    annotation: `${ctx.path}.map`,
    inline: false,
  };
  if (ctx.stats.ext === '.scss') {
    const { default: syntaxSCSS } = await import('postcss-scss');
    options.syntax = syntaxSCSS;
    plugins.unshift(sass());
  } else if (ctx.stats.ext === '.sass') {
    const { default: syntaxSASS } = await import('postcss-sass');
    options.syntax = syntaxSASS;
    plugins.unshift(sass());
  } else if (ctx.stats.ext === '.less') {
    const { default: syntaxLESS } = await import('postcss-less');
    options.syntax = syntaxLESS;
    options.parser = less.parser;
    plugins.unshift(less());
  }
  if (useModules) {
    const [{ default: cssModules }, { default: crypto }] = await Promise.all([
      import('postcss-modules'),
      import('crypto'),
    ]);
    plugins.push(cssModules({
      generateScopedName(name) {
        const hash = crypto
          .createHash('md5')
          .update(ctx.srcPath)
          .digest('hex');
        return `${name}_${hash}`;
      },
      getJSON(cssFileName, json) {
        modulesCache.set(ctx.srcPath, json);
      },
    }));
  }
  const { css, map } = await postcss(plugins)
    .process(content, options);
  return { code: css, map };
};
/* eslint-enable max-statements */
