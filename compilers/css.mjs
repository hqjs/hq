import { getBrowsersList, getInputSourceMap, saveContent } from './utils.mjs';
import cssnano from 'cssnano';
import fs from 'fs-extra';
import postcss from 'postcss';
import postcssPreetEnv from 'postcss-preset-env';

export default async ctx => {
  const { ua } = ctx.store;
  const content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  const inputSourceMap = await getInputSourceMap(ctx.srcPath, content);
  // const replaced = await replaceRelativePath(ctx);
  const plugins = [
    postcssPreetEnv({
      browsers: getBrowsersList(ua),
      features: {
        calc: false,
        customProperties: false,
        prev: inputSourceMap,
      },
    }),
    cssnano({ preset: 'advanced' }),
  ];
  const { css, map } = await postcss(plugins)
    .process(content, {
      from: undefined,
      map: {
        annotation: `${ctx.path}.map`,
        inline: false,
      },
    });
  const stats = ctx.app.table.touch(`${ctx.srcPath}.map`);
  // TODO add map byte length here
  const mapBuildPromise = saveContent(JSON.stringify(map), { path: `${ctx.path}.map`, stats, store: ctx.store });
  stats.build.set(ua, mapBuildPromise);
  return saveContent(css, ctx);
};
