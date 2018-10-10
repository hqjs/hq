import { getBrowsersList, getInputSourceMap, saveContent } from './utils.mjs';
import cssnano from 'cssnano';
import fs from 'fs-extra';
import less from 'postcss-less-engine';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';
import sass from 'postcss-node-sass';

export default async ctx => {
  const { ua } = ctx.store;
  const content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  const inputSourceMap = await getInputSourceMap(ctx.srcPath, content);
  // const replaced = await replaceRelativePath(ctx);
  const plugins = [
    postcssPresetEnv({
      browsers: getBrowsersList(ua),
      features: {
        calc: false,
        customProperties: false,
        prev: inputSourceMap,
      },
    }),
    cssnano({ preset: 'advanced' }),
  ];
  const options = {
    from: undefined,
    map: {
      annotation: `${ctx.path}.map`,
      inline: false,
    },
  };
  if (ctx.stats.ext === '.scss' || ctx.stats.ext === '.sass') {
    plugins.unshift(sass());
  } else if (ctx.stats.ext === '.less') {
    plugins.unshift(less());
    options.parser = less.parser;
  }
  const { css, map } = await postcss(plugins)
    .process(content, options);
  const stats = ctx.app.table.touch(`${ctx.srcPath}.map`);
  // TODO add map byte length here
  const mapBuildPromise = saveContent(JSON.stringify(map), { path: `${ctx.path}.map`, stats, store: ctx.store });
  stats.build.set(ua, mapBuildPromise);
  return saveContent(css, ctx);
};
