import { getScriptExtensionByAttrs, getStyleExtensionByAttrs } from './utils.mjs';
import compileCSS from './css.mjs';
import compileJS from './js.mjs';
import posthtml from 'posthtml';
import { readPlugins } from '../utils.mjs';

const PUBLIC_URL = '%PUBLIC_URL%';

export default async (ctx, content) => {
  const insertLR = ctx.path.includes('index.html');
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
    tree => {
      const promises = [];
      tree.match({ tag: 'script' }, node => {
        if (node.attrs && node.attrs.src != null) node.attrs.src = node.attrs.src.replace(PUBLIC_URL, '');
        if (
          node.attrs &&
          node.attrs.src != null &&
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
        const [ protocol, host ] = ctx.store.baseURI.split(':');
        tree.match({ tag: 'body' }, node => ({
          ...node,
          content: [
            ...node.content,
            {
              attrs: { src: `${protocol}:${host}:${ctx.app.port}/hq-livereload.js` },
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
        const [ nodeContent ] = node.content;
        promises.push(compileCSS({
          ...ctx,
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
