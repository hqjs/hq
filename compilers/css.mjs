import cssnano from 'cssnano';
import { getBrowsersList } from './utils.mjs';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';
import { readPlugins } from '../utils.mjs';

export const modulesCache = new Map;

const preprocess = async (ctx, content, sourceMap, { skipSM }) => {
  const preOptions = { from: `${ctx.originalPath}.map*` };
  const prePlugins = [ root => {
    root.walkAtRules('import', rule => {
      if (!rule.params.startsWith('"/')) rule.params = `".${ctx.dirname}/${rule.params.slice(1)}`;
      else rule.params = `"${ctx.app.src}${rule.params.slice(1)}`;
    });
  } ];
  if (ctx.stats.ext === '.scss') {
    const { default: scssSyntax } = await import('postcss-scss');
    preOptions.syntax = scssSyntax;
  } else if (ctx.stats.ext === '.sass') {
    const { default: sassSyntax } = await import('postcss-sass');
    preOptions.syntax = sassSyntax;
  } else if (ctx.stats.ext === '.less') {
    const { default: less } = await import('postcss-less');
    preOptions.parser = less.parser;
  }
  if (ctx.stats.ext === '.less') {
    const { default: lessSyntax } = await import('postcss-less');
    preOptions.syntax = lessSyntax;
  }
  if (!skipSM) preOptions.map = {
    annotation: `${ctx.path}.map`,
    inline: false,
    prev: sourceMap,
  };
  const { css, map } = await postcss(prePlugins)
    .process(content, preOptions);

  return { css, map };
};

const precompile = async (ctx, content, sourceMap) => {
  // FIXME: use source map during sass/less compilation
  if (ctx.stats.ext === '.scss' || ctx.stats.ext === '.sass') {
    const { default: sass } = await import('node-sass');
    const result = await new Promise((resolve, reject) => sass.render({
      data: content,
      indentedSyntax: ctx.stats.ext === '.sass',
      sourceMap: true,
      sourceMapContents: true,
    }, (err, res) => err ? reject(err) : resolve(res)));
    const css = result.css.toString();
    const map = result.map ? JSON.parse(result.map.toString()) : '';
    return { css, map };
  } else if (ctx.stats.ext === '.less') {
    const { default: less } = await import('less');
    const result = await less.render(content, { sourceMap: { sourceMapFullFilename: `${ctx.path}.map` } });
    const { css } = result;
    const map = result.map ? JSON.parse(result.map.toString()) : '';
    return { css, map };
  } else {
    return { css: content, map: sourceMap };
  }
};

const compile = async (ctx, content, sourceMap, { skipSM, useModules }) => {
  const cssPlugins = await readPlugins(ctx, '.postcssrc');

  const { ua } = ctx.store;
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
    prev: sourceMap,
  };

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

export default async (ctx, content, sourceMap, { skipSM = false, useModules = modulesCache.has(ctx.srcPath) } = {}) => {
  const { css: preContent, map: preMap } = await preprocess(ctx, content, sourceMap, { skipSM });
  const { css: precompContent, map: precompMap } = await precompile(ctx, preContent, preMap);
  return compile(ctx, precompContent, precompMap, { skipSM, useModules });
};
