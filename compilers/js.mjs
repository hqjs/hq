import { getBrowsersList, getInputSourceMap, saveContent } from './utils.mjs';
import CoffeeScript from 'coffeescript';
import babel from '@babel/core';
import babelDecoratorMetadata from '@hqjs/babel-plugin-add-decorators-metadata';
import babelMinifyDeadCode from 'babel-plugin-minify-dead-code-elimination';
import babelPresetEnv from '@babel/preset-env';
import babelPresetFlow from '@babel/preset-flow';
import babelPresetReact from '@babel/preset-react';
import babelTransformClassProperties from '@babel/plugin-proposal-class-properties';
import babelTransformCssImport from '@hqjs/babel-plugin-transform-css-imports';
import babelTransformDecorators from '@babel/plugin-proposal-decorators';
import babelTransformDefine from '@hqjs/babel-plugin-transform-define';
import babelTransformExportDefault from '@babel/plugin-proposal-export-default-from';
import babelTransformExportNamespace from '@babel/plugin-proposal-export-namespace-from';
import babelTransformJsonImport from '@hqjs/babel-plugin-transform-json-imports';
import babelTransformMixedImports from '@hqjs/babel-plugin-transform-mixed-imports';
import babelTransformModules from '@hqjs/babel-plugin-transform-modules';
import babelTransformNameImports from '@hqjs/babel-plugin-transform-name-imports';
import babelTransformNamedImportToDestruct from '@hqjs/babel-plugin-transform-named-import-to-destructure';
import babelTransformParameterDecorators from 'babel-plugin-transform-function-parameter-decorators';
import babelTransformPaths from '@hqjs/babel-plugin-transform-paths';
import babelTransformTypescript from '@hqjs/babel-plugin-transform-typescript';
import babelTypeMetadata from '@hqjs/babel-plugin-add-type-metadata';
import fs from 'fs-extra';
import patchAngularCompiler from '@hqjs/babel-plugin-patch-angular-fesm5-compiler';

const getBabelSetup = ctx => {
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
    [ babelTransformClassProperties, { loose: true }],
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
  if (ctx.path.endsWith('compiler/fesm5/compiler.js')) {
    plugins.unshift(patchAngularCompiler);
  }
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
    plugins.unshift(babelTransformTypescript, babelTypeMetadata, babelDecoratorMetadata);
  } else {
    presets.push([
      babelPresetReact,
      { development: true },
    ], babelPresetFlow);
  }

  return { plugins, presets };
};

export default async ctx => {
  const { ua } = ctx.store;
  const { plugins, presets } = getBabelSetup(ctx);
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
  const mapBuildPromise = saveContent(JSON.stringify(map), { path: `${ctx.path}.map`, stats, store: ctx.store });
  stats.build.set(ua, mapBuildPromise);
  // ctx.set('SourceMap', `${ctx.path}.map`);
  return saveContent(codeSM, ctx);
};
