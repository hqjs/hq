import { getBrowsersList, getInputSourceMap, saveContent } from './utils.mjs';
import CoffeeScript from 'coffeescript';
import babel from '@babel/core';
import babelMinifyDeadCode from 'babel-plugin-minify-dead-code-elimination';
import babelPresetEnv from '@babel/preset-env';
import babelPresetFlow from '@babel/preset-flow';
import babelPresetReact from '@babel/preset-react';
import babelPresetTypescript from '@babel/preset-typescript';
import babelTransformClassProperties from '@babel/plugin-proposal-class-properties';
import babelTransformCssImport from '@hqjs/babel-plugin-transform-css-imports';
import babelTransformDecorators from '@babel/plugin-proposal-decorators';
import babelTransformDefine from 'babel-plugin-transform-define';
import babelTransformExportDefault from '@babel/plugin-proposal-export-default-from';
import babelTransformExportNamespace from '@babel/plugin-proposal-export-namespace-from';
import babelTransformJsonImport from '@hqjs/babel-plugin-transform-json-imports';
import babelTransformMixedImports from '@hqjs/babel-plugin-transform-mixed-imports';
import babelTransformModules from '@hqjs/babel-plugin-transform-modules';
import babelTransformNameImports from '@hqjs/babel-plugin-transform-name-imports';
import babelTransformNamedImportToDestruct from '@hqjs/babel-plugin-transform-named-import-to-destructure';
import babelTransformParameterDecorators from 'babel-plugin-transform-function-parameter-decorators';
import babelTransformPaths from '@hqjs/babel-plugin-transform-paths';
import fs from 'fs-extra';

export default async ctx => {
  const { ua } = ctx.store;
  const isTS = ctx.stats.ext === '.ts';
  const tsOptions = { legacy: isTS };
  if (!isTS) tsOptions.decoratorsBeforeExport = true;
  const plugins = [
    babelTransformMixedImports,
    babelTransformExportDefault,
    babelTransformExportNamespace,
    [ babelTransformPaths, {
      baseURI: ctx.store.baseURI,
      dirname: ctx.dirname,
    }],
    [ babelTransformDecorators, tsOptions ],
    babelTransformParameterDecorators,
    [ babelTransformClassProperties, { loose: false }],
    [ babelTransformDefine, {
      // TODO make it conditional
      'import.meta': { url: ctx.path },
      'process.env.NODE_ENV': 'development',
      'typeof window': 'object',
    }],
    babelMinifyDeadCode,
    babelTransformNameImports,
    babelTransformNamedImportToDestruct,
    babelTransformCssImport,
    [ babelTransformJsonImport, { dirname: ctx.stats.dirname }],
    babelTransformModules,
  ];
  const presets = [
    [ babelPresetEnv, {
      ignoreBrowserslistConfig: false,
      loose: true,
      modules: false,
      shippedProposals: true,
      targets: { browsers: getBrowsersList(ua) },
      // useBuiltIns: 'usage',
    }],
  ];
  if (isTS) {
    presets.push(babelPresetTypescript);
  } else {
    presets.push([
      babelPresetReact,
      { development: true },
    ], babelPresetFlow);
  }
  let content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  let inputSourceMap = await getInputSourceMap(ctx.srcPath, content);
  if (ctx.stats.ext === '.coffee') {
    content = CoffeeScript.compile(content, {
      header: false,
      inlineMap: true,
      sourceMap: inputSourceMap,
    });
    inputSourceMap = await getInputSourceMap(ctx.srcPath, content);
  }
  const { code, map } = await babel.transform(content, {
    ast: false,
    babelrc: false,
    comments: true,
    compact: false,
    configFile: false,
    extends: ctx.app.babelRC,
    filename: ctx.path,
    inputSourceMap,
    plugins,
    presets,
    sourceFileName: ctx.path,
    sourceMaps: true,
  });

  const codeSM = `${code}\n//# sourceMappingURL=${ctx.path}.map`;
  const stats = ctx.app.table.touch(`${ctx.srcPath}.map`);
  // TODO add map byte length here
  const mapBuildPromise = saveContent(JSON.stringify(map), { path: `${ctx.path}.map`, store: ctx.store, stats });
  stats.build.set(ua, mapBuildPromise);
  // ctx.set('SourceMap', `${ctx.path}.map`);
  return saveContent(codeSM, ctx);
};
