import compileCSS, { modulesCache } from './css.mjs';
import {
  getBrowsersList,
  getInputSourceMap,
  getProjectModulePath,
  getScriptExtensionByAttrs,
  getStyleExtensionByAttrs,
  saveContent,
} from './tools.mjs';
import {
  isAngularCompiler,
  isPolyfill,
  isWorker,
  pathToURL,
  readPackageJSON,
  urlToPath,
} from '../utils.mjs';
import babel from '@babel/core';
import babelMinifyDeadCode from 'babel-plugin-minify-dead-code-elimination';
import babelPresetEnv from '@babel/preset-env';
import babelPresetFlow from '@babel/preset-flow';
import babelPresetMinify from 'babel-preset-minify';
import babelPresetReact from '@babel/preset-react';
// import babelSyntaxAsyncGenerators from '@babel/plugin-syntax-async-generators';
// import babelSyntaxDynamicImport from '@babel/plugin-syntax-dynamic-import';
// import babelSyntaxJsonString from '@babel/plugin-syntax-json-strings';
// import babelSyntaxNullishCoalescing from '@babel/plugin-syntax-nullish-coalescing-operator';
// import babelSyntaxNumericSeparator from '@babel/plugin-syntax-numeric-separator';
// import babelSyntaxObjectRestSpread from '@babel/plugin-syntax-object-rest-spread';
// import babelSyntaxOptionalCatch from '@babel/plugin-syntax-optional-catch-binding';
// import babelSyntaxOptionalChaining from '@babel/plugin-syntax-optional-chaining';
// import babelSyntaxTopLevelAwait from '@babel/plugin-syntax-top-level-await';
// import babelSyntaxTypescript from '@babel/plugin-syntax-typescript';
import babelTransforAssetsImport from 'babel-plugin-transform-assets-import-to-string';
import babelTransformClassProperties from '@babel/plugin-proposal-class-properties';
import babelTransformDecorators from '@babel/plugin-proposal-decorators';
import babelTransformExportDefault from '@babel/plugin-proposal-export-default-from';
import babelTransformPrivateMethods from '@babel/plugin-proposal-private-methods';
import babelTransformTypescriptConstEnum from 'babel-plugin-const-enum';
// import babelTransformUnicodePropertyRegex from '@babel/plugin-proposal-unicode-property-regex';
import crypto from 'crypto';
import fs from 'fs-extra';
import hqDecoratorMetadata from '@hqjs/babel-plugin-add-decorators-metadata';
import hqExposeGlobalToWindow from '@hqjs/babel-plugin-expose-global-to-window';
import hqPatchAngularCompiler from '@hqjs/babel-plugin-patch-angular-fesm5-compiler';
import hqSupportNodejsGlobals from '@hqjs/babel-plugin-support-nodejs-globals';
import hqTransformCssImport from '@hqjs/babel-plugin-transform-css-imports';
import hqTransformDefine from '@hqjs/babel-plugin-transform-define';
import hqTransformExportAll from '@hqjs/babel-plugin-transform-export-all';
import hqTransformJsonImport from '@hqjs/babel-plugin-transform-json-imports';
import hqTransformMixedImports from '@hqjs/babel-plugin-transform-mixed-imports';
import hqTransformModules from '@hqjs/babel-plugin-transform-modules';
import hqTransformNameImports from '@hqjs/babel-plugin-transform-name-imports';
import hqTransformNamedExportToDestruct from '@hqjs/babel-plugin-transform-named-export-to-destructure';
import hqTransformNamedImportToDestruct from '@hqjs/babel-plugin-transform-named-import-to-destructure';
import hqTransformNamespaceImports from '@hqjs/babel-plugin-transform-namespace-imports';
import hqTransformParameterDecorators from '@hqjs/babel-plugin-transform-parameter-decorators';
import hqTransformPaths from '@hqjs/babel-plugin-transform-paths';
import hqTransformTypescript from '@hqjs/babel-plugin-transform-typescript';
import hqTypeMetadata from '@hqjs/babel-plugin-add-type-metadata';
import path from 'path';
import querystring from 'querystring';
import url from 'url';

const CSS_MODULES_REX = /import\s+[*a-zA-Z_,{}\s]+\s+from\s+['"]{1}([^'"]+\.(css|sass|scss|less))['"]{1}/gm;
const CSS_REQUIRE_MODULES_REX = /=\s*require\s*\(\s*['"]{1}([^'"]+\.(css|sass|scss|less))['"]{1}/gm;

const getPrePlugins = (ctx, skipHQTrans, skipPoly) => {
  const isTSX = ctx.stats.ext === '.tsx';
  const isTS = ctx.stats.ext === '.ts';
  const tsOptions = { legacy: isTS || isTSX };

  if (!isTS && !isTSX) tsOptions.decoratorsBeforeExport = true;

  const prePlugins = [
    [ babelTransforAssetsImport, { extensions: [ '.gif', '.jpeg', '.jpg', '.png', '.svg', '.txt' ] }],
    babelTransformExportDefault,
    [ babelTransformDecorators, tsOptions ],
    hqTransformParameterDecorators,
    [ babelTransformClassProperties, { loose: true }],
    [ babelTransformPrivateMethods, { loose: true }],
    [ hqTransformDefine, {
      // TODO: make it conditional
      'import.meta': { url: querystring.escape(ctx.dpath) },
      'process.env.NODE_ENV': ctx.app.production ? 'production' : 'development',
      'typeof window': 'object',
    }],
    [ babelMinifyDeadCode, { keepClassName: true, keepFnArgs: true, keepFnName: true }],
    [ hqTransformNamespaceImports, { include: [ 'react', 'react-dom' ] }],
    hqTransformNamedExportToDestruct,
    hqTransformExportAll,
  ];

  if (ctx.module) {
    prePlugins.push(hqTransformModules);
  }

  if (isTS || isTSX) {
    prePlugins.unshift(
      babelTransformTypescriptConstEnum,
      [ hqTransformTypescript, {
        allowNamespaces: true,
        isTSX,
        jsxPragma: 'React',
        removeUnusedImports: !skipHQTrans,
      }],
      hqTypeMetadata,
      hqDecoratorMetadata,
    );
  }

  if (!skipPoly) {
    prePlugins.unshift(hqSupportNodejsGlobals);
  }

  return prePlugins;
};

const getPlugins = (ctx, skipHQTrans, styleMaps, browser) => {
  if (skipHQTrans) return [];

  const { major: vueVersion } = ctx.app.dependencies.vue;
  const vue = vueVersion === 3 ?
    'vue/dist/vue.esm-browser.js' :
    'vue/dist/vue.esm.js';

  const plugins = [
    [ hqTransformPaths, {
      baseURI: '', // ctx.store.baseURI,
      dirname: ctx.dirname,
    }],
    [ hqTransformNameImports, { browser, empty: '/hq-empty-module.js', resolve: { vue } }],
    [ hqTransformCssImport, { styleMaps }],
    [ hqTransformJsonImport, { dirname: ctx.stats.dirname, root: path.resolve(ctx.app.root, ctx.app.src) }],
    hqExposeGlobalToWindow,
  ];

  if (!ctx.app.build) {
    plugins.splice(1, 0, hqTransformMixedImports);
    plugins.splice(4, 0, [ hqTransformNamedImportToDestruct, {
      baseURI: '', // ctx.store.baseURI,
      map: '.map*',
    }]);
  }

  if (isAngularCompiler(ctx.dpath)) {
    plugins.unshift(hqPatchAngularCompiler);
  }

  return plugins;
};

const getPresets = (ctx, skipPoly) => {
  const { ua } = ctx.store;
  const isTSX = ctx.stats.ext === '.tsx';
  const isTS = ctx.stats.ext === '.ts';

  const targets = ua.target === 'module' ?
    { esmodules: true } :
    ua.target === 'nomodule' ?
      { esmodules: false } :
      { browsers: getBrowsersList(ua) };

  const presets = [
    [ babelPresetEnv, {
      bugfixes: true,
      corejs: skipPoly ? undefined : { proposals: true, version: 3 },
      ignoreBrowserslistConfig: false,
      loose: true,
      modules: false,
      shippedProposals: true,
      targets,
      useBuiltIns: skipPoly ? false : 'usage',
    }],
  ];
  if (isTSX) {
    presets.push([
      babelPresetReact,
      { development: !ctx.app.production, runtime: 'classic' },
    ]);
  }
  if (!isTS && !isTSX) {
    presets.push([
      babelPresetReact,
      { development: !ctx.app.production, runtime: 'classic' },
    ], babelPresetFlow);
  }

  return presets;
};

const getPostPresets = (ctx, skipHQTrans) => {
  if (skipHQTrans) return [];

  const postPresets = [];

  if (ctx.app.production) {
    postPresets.push([ babelPresetMinify, {
      builtIns: false,
      deadcode: false,
      evaluate: false, // FIXME: https://github.com/babel/minify/issues/986
      mangle: false,
      typeConstructors: !isPolyfill(ctx.dpath),
    }]);
  }

  return postPresets;
};

const getBabelSetup = (ctx, skipHQTrans, styleMaps, browser) => {
  const skipPoly = isPolyfill(ctx.dpath) || isWorker(ctx.dpath) || !ctx.module;

  return {
    plugins: getPlugins(ctx, skipHQTrans, styleMaps, browser),
    postPresets: getPostPresets(ctx, skipHQTrans),
    prePlugins: getPrePlugins(ctx, skipHQTrans, skipPoly),
    presets: getPresets(ctx, skipPoly),
  };
};

const precompileCoffee = async (ctx, content, sourceMap) => {
  const { default: CoffeeScript } = await import('coffeescript');
  const inputContent = CoffeeScript.compile(content, {
    header: false,
    inlineMap: true,
    sourceMap,
  });
  const inputSourceMap = await getInputSourceMap(ctx.srcPath, inputContent);
  return { inputContent, inputSourceMap };
};

/* eslint-disable max-statements, max-depth */
// TODO: refactor
const precompileVue = async (ctx, content) => {
  const hash = crypto.createHash('md5')
    .update(ctx.dpath)
    .digest('hex');
  const { major: vueVersion } = ctx.app.dependencies.vue;
  if (vueVersion === 3) {
    const { default: Vue } = await import(getProjectModulePath(
      ctx.app.root,
      '@vue/compiler-sfc/dist/compiler-sfc.cjs.js',
    ));
    const { descriptor, errors } = Vue.parse(content, { filename: ctx.dpath, needMap: true });
    if (errors && errors.length > 0) {
      console.error(JSON.stringify(errors));
    }
    let code = '';
    let sourceMap;
    if (descriptor.script || descriptor.scriptSetup) {
      const script = Vue.compileScript(descriptor);
      code += script.content.replace('export default', 'const __vue_component__ =');
      sourceMap = script.map;
    } else code += 'const __vue_component__ = {};';

    let hasScoped = false;
    let hasCSSModules = false;
    if (descriptor.styles) {
      for (const [ index, style ] of descriptor.styles.entries()) {
        // TODO: use postcss config
        const styleCode = await Vue.compileStyleAsync({
          filename: ctx.dpath,
          id: `data-v-${hash}`,
          modules: style.module != null,
          preprocessLang: style.lang,
          scoped: style.scoped != null,
          source: style.content,
        });
        if (styleCode.errors && styleCode.errors.length > 0) {
          console.error(JSON.stringify(styleCode.errors));
        }
        if (style.scoped) hasScoped = true;
        if (style.module) {
          if (!hasCSSModules) {
            code += '\n__vue_component__.__cssModules = {}';
            hasCSSModules = true;
          }
          const moduleName = typeof style.module === 'string' ? style.module : '$style';
          code += `\n__vue_component__.__cssModules[${JSON.stringify(moduleName)}] = ${JSON.stringify(styleCode.modules)}`;
        }
        code += `
          const __vue_style__${index} = document.createElement('style');
          __vue_style__${index}.textContent = \`${styleCode.code}\`;
          document.body.appendChild(__vue_style__${index});
        `;
      }
      if (hasScoped) {
        code += `\n__vue_component__.__scopeId = "data-v-${hash}"`;
      }
    }

    if (descriptor.template) {
      const templateCode = Vue.compileTemplate({
        compilerOptions: {
          scopeId: hasScoped ?
            `data-v-${hash}` :
            null,
        },
        filename: ctx.dpath,
        preprocessLang: descriptor.template.lang,
        source: descriptor.template.content,
        transformAssetUrls: false,
      });
      if (templateCode.errors && templateCode.errors.length > 0) {
        console.error(JSON.stringify(templateCode.errors));
      }
      code += `\n${templateCode.code}\n`;
      code += '\n__vue_component__.render = render';
      code += `\n__vue_component__.__file = ${JSON.stringify(ctx.dpath)}`;
      code += '\nexport default __vue_component__';
    }
    return { inputContent: code, inputSourceMap: sourceMap };
  } else {
    // TODO: use compiler from repository
    const { default: Vue } = await import('@vue/component-compiler');
    const compiler = Vue.createDefaultCompiler();
    const descriptor = compiler.compileToDescriptor(ctx.path, content);
    const res = Vue.assemble(compiler, ctx.path, descriptor);
    return { inputContent: res.code, inputSourceMap: res.map };
  }
};
/* eslint-enable max-statements, max-depth */

const precompileSvelte = async (ctx, content) => {
  let scriptIndex = 0;
  let styleIndex = 0;
  // TODO: check svelte version from project package.json
  // TODO: check and add necessary compiller options for svelte version 2
  const { default: svelte } = await import(getProjectModulePath(ctx.app.root, 'svelte/compiler.js'));
  const pre = await svelte.preprocess(content, {
    // TODO: support script preprocessors, do not transform imports
    script({ content: scriptContent, attributes }) {
      const ext = getScriptExtensionByAttrs(attributes);
      if (![ '.ts', '.tsx', '.coffee', '.jsx' ].includes(ext)) return null;
      // TODO: check if sourcemaps can be usefull for inline scripts
      const index = ++scriptIndex;
      return compileJS({
        ...ctx,
        dpath: `${ctx.dpath}-${index}${ext}`,
        path: `${ctx.path}-${index}${ext}`,
        stats: {
          ...ctx.stats,
          ext,
        },
      }, scriptContent, false, { skipHQTrans: true, skipSM: true });
    },
    style({ content: styleContent, attributes }) {
      const ext = getStyleExtensionByAttrs(attributes);
      if (![ '.sass', '.scss', '.less' ].includes(ext)) return null;
      const index = ++styleIndex;
      return compileCSS({
        ...ctx,
        dpath: `${ctx.dpath}$${index}${ext}`,
        path: `${ctx.path}$${index}${ext}`,
        stats: {
          ...ctx.stats,
          ext,
        },
      }, styleContent, false, { skipSM: true });
    },
  });
  const res = svelte.compile(pre.code, {
    filename: ctx.dpath,
    format: 'esm',
    name: path.basename(ctx.dpath, '.svelte'),
  });
  const inputContent = res.js.code;
  const inputSourceMap = res.js.map;
  inputSourceMap.sources[0] = `${ctx.path}.map*`;
  return { inputContent, inputSourceMap };
};

const precompile = async (ctx, content, sourceMap) => {
  if (ctx.stats.ext === '.coffee') return precompileCoffee(ctx, content, sourceMap);
  if (ctx.stats.ext === '.vue') return precompileVue(ctx, content);
  if (ctx.stats.ext === '.svelte') return precompileSvelte(ctx, content);
  return { inputContent: content, inputSourceMap: sourceMap };
};

// TODO: it is more accurate, but slower
// const getStyleImports = async (ctx, content) => {
//   const { baseURI } = ctx.store;
//   const styleExtensions = [
//     '.css',
//     '.scss',
//     '.sass',
//     '.less',
//     '.CSS',
//     '.SCSS',
//     '.SASS',
//     '.LESS',
//   ];

//   const notRequire = (t, nodePath) => {
//     const [ arg ] = nodePath.node.arguments;
//     return nodePath.node.callee.name !== 'require' ||
//       !t.isStringLiteral(arg) ||
//       nodePath.scope.hasBinding('require');
//   };

//   // TODO: check if we need to transform dynamic css imports to modules
//   const notImport = (t, nodePath) => {
//     const [ arg ] = nodePath.node.arguments;
//     return nodePath.node.callee.type !== 'Import' ||
//       !t.isStringLiteral(arg) ||
//       nodePath.scope.hasBinding('import');
//   };

//   const isLocalImport = modName =>
//     modName.startsWith(baseURI) ||
//     modName.startsWith('/') ||
//     modName.startsWith('.') ||
//     (
//       !modName.startsWith('http://') &&
//       !modName.startsWith('https://')
//     );

//   const isStyleImport = modName => styleExtensions.some(ext => modName.endsWith(ext));

//   const isTSX = ctx.stats.ext === '.tsx';
//   const isTS = ctx.stats.ext === '.ts';

//   const presets = [];

//   if (isTSX) {
//     presets.push([
//       babelPresetReact,
//       { development: !ctx.app.production, runtime: 'classic' },
//     ]);
//   }
//   if (!isTS && !isTSX) {
//     presets.push([
//       babelPresetReact,
//       { development: !ctx.app.production, runtime: 'classic' },
//     ], babelPresetFlow);
//   }

//   const styleImports = [];
//   const plugins = [
//     babelSyntaxAsyncGenerators,
//     babelSyntaxDynamicImport,
//     babelSyntaxJsonString,
//     babelSyntaxNullishCoalescing,
//     babelSyntaxNumericSeparator,
//     babelSyntaxObjectRestSpread,
//     babelSyntaxOptionalCatch,
//     babelSyntaxOptionalChaining,
//     babelSyntaxTopLevelAwait,
//     [ babelTransformClassProperties, { loose: true }],
//     [ babelTransformPrivateMethods, { loose: true }],
//     babelTransformUnicodePropertyRegex,
//     ({ types: t }) => ({
//       visitor: {
//         CallExpression(nodePath) {
//           if (notRequire(t, nodePath) && notImport(t, nodePath)) return;
//           const { node } = nodePath;
//           const [ arg ] = node.arguments;
//           const { value: modName } = arg;

//           const variableDecl = nodePath.findParent(p => p.isVariableDeclaration());
//           if (!variableDecl) return;

//           if (isLocalImport(modName) && isStyleImport(modName)) styleImports.push(modName);
//         },
//         ImportDeclaration(nodePath) {
//           const { node } = nodePath;
//           const { value: modName } = node.source;
//           if (node.specifiers.length === 0) return;

//           if (isLocalImport(modName) && isStyleImport(modName)) styleImports.push(modName);
//         },
//       },
//     }),
//   ];

//   if (isTS || isTSX) {
//     plugins.push(babelSyntaxTypescript);
//   }

//   await babel.transformAsync(content, {
//     ast: true,
//     babelrc: false,
//     code: false,
//     comments: true,
//     compact: false,
//     configFile: false,
//     filename: ctx.dpath,
//     plugins,
//     presets,
//     sourceMaps: false,
//   });

//   return styleImports;
// };

const compileCSSModules = async (ctx, content) => {
  // const cssModules = await getStyleImports(ctx, content);
  // const extensions = cssModules.map(name => path.extname(name));

  const styleImports = [
    ...Array.from(content.matchAll(CSS_MODULES_REX)),
    ...Array.from(content.matchAll(CSS_REQUIRE_MODULES_REX)),
  ];
  const cssModules = styleImports.map(([ , filename ]) =>
    urlToPath(querystring.unescape(url.resolve(`${querystring.escapedname(ctx.dirname)}/`, filename))));
  const extensions = styleImports.map(([ ,, ext ]) => ext);

  const styleBuilds = cssModules
    .map(async (filename, index) => {
      const fileSrcPath = path.resolve(ctx.app.root, ctx.app.src, filename.slice(1));
      const dpath = pathToURL(filename);
      const { ua } = ctx.store;
      if (ctx.app.table.isDirty(fileSrcPath, ua)) {
        const styleContent = await fs.readFile(fileSrcPath, { encoding: 'utf-8' });
        const { code, map } = await compileCSS({
          ...ctx,
          dpath,
          originalPath: querystring.escape(dpath),
          path: querystring.escape(dpath),
          srcPath: fileSrcPath,
          stats: { ...ctx.stats, ext: `.${extensions[index]}` },
        }, styleContent, false, { skipSM: ctx.app.build, useModules: true });
        const styleModules = modulesCache.get(fileSrcPath);
        return { code, map, styleModules };
      } else {
        const styleModules = modulesCache.get(fileSrcPath);
        return { styleModules };
      }
    });
  const styles = await Promise.allSettled(styleBuilds);
  return styles
    .filter(({ status }) => status === 'fulfilled')
    .map(({ value: { code, map, styleModules } }, index) => {
      const filename = cssModules[index];
      const dpath = pathToURL(filename);
      const fileSrcPath = path.resolve(ctx.app.root, ctx.app.src, filename.slice(1));
      const { ua } = ctx.store;
      if (ctx.app.table.isDirty(fileSrcPath, ua)) {
        const stats = ctx.app.table.touch(fileSrcPath);
        const styleBuildPromise = saveContent(code, {
          dpath,
          path: querystring.escape(dpath),
          stats,
          store: ctx.store,
        });
        stats.build.set(ua, styleBuildPromise);
        if (map) {
          const mapStats = ctx.app.table.touch(`${fileSrcPath}.map`);
          // TODO: add map byte length here
          const mapBuildPromise = saveContent(JSON.stringify(map), {
            dpath: `${dpath}.map`,
            path: `${querystring.escape(dpath)}.map`,
            stats: mapStats,
            store: ctx.store,
          });
          mapStats.build.set(ua, mapBuildPromise);
        }
      }
      return styleModules;
    })
    .reduce((res, val, index) => {
      const filename = cssModules[index];
      res[filename] = val;
      return res;
    }, {});
};

const compileJS = async (ctx, content, sourceMap, { skipHQTrans = false, skipSM = false } = {}) => {
  const { inputContent, inputSourceMap } = await precompile(ctx, content, sourceMap);
  const styleMaps = await compileCSSModules(ctx, content);
  const { browser } = await readPackageJSON(path.resolve(ctx.app.root, urlToPath(ctx.dirname).slice(1)));

  const { plugins, postPresets, prePlugins, presets } = getBabelSetup(ctx, skipHQTrans, styleMaps, browser);

  const { ast } = await babel.transformAsync(inputContent, {
    ast: true,
    babelrc: false,
    code: false,
    comments: true,
    compact: false,
    configFile: false,
    extends: ctx.app.babelrc,
    filename: ctx.dpath,
    inputSourceMap,
    plugins: prePlugins,
    presets,
    sourceFileName: `${ctx.path}.map*`,
    sourceMaps: !skipSM,
  });

  const { code, map } = await babel.transformFromAstAsync(ast, inputContent, {
    ast: false,
    babelrc: false,
    code: true,
    comments: true,
    compact: false,
    configFile: false,
    filename: ctx.dpath,
    inputSourceMap,
    plugins,
    presets: postPresets,
    sourceFileName: `${ctx.path}.map*`,
    sourceMaps: !skipSM,
  });

  const codeSM = skipSM ? code : `${code}\n//# sourceMappingURL=${ctx.dpath}.map`;
  return { code: codeSM, map };
};

export default compileJS;
