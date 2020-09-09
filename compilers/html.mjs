import { getScriptExtensionByAttrs, getStyleExtensionByAttrs } from './utils.mjs';
import { readPlugins, resolvePackageFrom } from '../utils.mjs';
import compileCSS from './css.mjs';
import compileJS from './js.mjs';
import fs from 'fs-extra';
import posthtml from 'posthtml';

const PUBLIC_URL = '%PUBLIC_URL%';

export default async (ctx, content) => {
  const insertLR = ctx.dpath.includes('index.html') && !ctx.app.production;
  const inputContent = content;
  const isPug = ctx.stats.ext === '.pug';
  const options = isPug ?
    {
      parser: (await import('posthtml-pug')).default({
        compileDebug: false,
        filename: ctx.srcPath,
        locals: {},
        pretty: true,
      }),
    } :
    undefined;
  let scriptIndex = 0;
  let styleIndex = 0;
  const htmlPlugins = await readPlugins(ctx, '.posthtmlrc');
  const plugins = [
    ...htmlPlugins,
    tree => {
      tree.match({ tag: 'link' }, node => {
        if (node.attrs && node.attrs.href != null) node.attrs.href = node.attrs.href.replace(PUBLIC_URL, '');
        return node;
      });
    },
    /* eslint-disable complexity */
    tree => {
      const promises = [];
      tree.match({ tag: 'script' }, node => {
        if (node.attrs && node.attrs.src != null) node.attrs.src = node.attrs.src.replace(PUBLIC_URL, '');
        if (node.attrs && node.attrs.src != null && node.attrs.src.startsWith('/node_modules/')) {
          node.attrs.src = `${node.attrs.src}?hq_type=nomodule`;
        }
        if (
          node.attrs &&
          node.attrs.src != null &&
          !node.attrs.src.startsWith('/') &&
          !node.attrs.src.startsWith('.') &&
          !node.attrs.src.startsWith('https://') &&
          !node.attrs.src.startsWith('http://')
        ) {
          promises.push(resolvePackageFrom(ctx.app.root, `/node_modules/${node.attrs.src}`, ctx.app.hqroot)
            .then(modulePath => fs.pathExists(modulePath).then(exists => {
              if (exists) {
                node.attrs.src = `/node_modules/${node.attrs.src}`;
                if (!('module' in node.attrs)) node.attrs.src = `${node.attrs.src}?hq_type=nomodule`;
              } else {
                node.attrs = {
                  ...node.attrs,
                  src: `./${node.attrs.src}`,
                  type: 'module',
                };
              }
            }))
            .catch(() => {
              node.attrs = {
                ...node.attrs,
                src: `./${node.attrs.src}`,
                type: 'module',
              };
            }));
          return node;
        }
        if (
          node.attrs &&
          node.attrs.src != null &&
          !('nomodule' in node.attrs) &&
          (
            node.attrs.src.startsWith(ctx.origin) ||
            node.attrs.src.startsWith('/') ||
            node.attrs.src.startsWith('.') ||
            !node.attrs.src.startsWith('http')
          )
        ) {
          node.attrs = {
            ...node.attrs,
            type: 'module',
          };
          return node;
        }
        if (!node.attrs || node.attrs.src == null) {
          const ext = getScriptExtensionByAttrs(node.attrs);
          const worker = node.attrs && node.attrs.type === 'text/js-worker' ? 'worker-' : '';
          const nodeContent = node.content.join('');
          // TODO: check if sourcemaps can be usefull for inline scripts
          promises.push(compileJS({
            ...ctx,
            dpath: `${ctx.dpath}-${worker}${scriptIndex++}${ext}`,
            path: `${ctx.path}-${worker}${scriptIndex++}${ext}`,
            stats: {
              ...ctx.stats,
              ext,
            },
          }, nodeContent, false, { skipSM: true }).then(({ code }) => {
            node.content = [ code ];
          }));
          return node;
        }
        if (node.attrs && node.attrs.src && !('defer' in node.attrs) && !('async' in node.attrs)) {
          node.attrs.defer = '';
        }
        return node;
      });
      return Promise.all(promises).then(() => tree);
    },
    tree => {
      if (insertLR) {
        tree.match({ tag: 'body' }, node => ({
          ...node,
          content: [
            ...node.content,
            {
              attrs: {
                async: true,
                src: '/hq-livereload.js',
                type: 'module',
              },
              tag: 'script',
            },
          ],
        }));
      }
    },
    tree => {
      const promises = [];
      tree.match({ tag: 'style' }, node => {
        const ext = getStyleExtensionByAttrs(node.attrs);
        const nodeContent = node.content.join('');
        promises.push(compileCSS({
          ...ctx,
          dpath: `${ctx.dpath}$${styleIndex++}${ext}`,
          path: `${ctx.path}$${styleIndex++}${ext}`,
          stats: {
            ...ctx.stats,
            ext,
          },
        }, nodeContent, false, { skipSM: true }).then(({ code }) => {
          node.content = [ code ];
        }));
        return node;
      });
      return Promise.all(promises).then(() => tree);
    },
  ];
  if (ctx.app.production) {
    const { default: htmlnano } = await import('htmlnano');
    plugins.push(htmlnano({
      collapseAttributeWhitespace: true,
      collapseBooleanAttributes: { amphtml: false },
      collapseWhitespace: 'conservative',
      custom: [],
      deduplicateAttributeValues: true,
      mergeScripts: true,
      mergeStyles: true,
      minifyCss: false,
      minifyJs: false,
      minifyJson: {},
      minifySvg: {
        plugins: [
          { collapseGroups: false },
          { convertShapeToPath: false },
        ],
      },
      removeComments: 'safe',
      removeEmptyAttributes: true,
      removeRedundantAttributes: false,
      removeUnusedCss: false,
    }));
  }
  const { html } = await posthtml(plugins)
    .process(inputContent, options);
  return { code: html };
};
