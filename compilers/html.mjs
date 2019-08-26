import { getScriptExtensionByAttrs, getStyleExtensionByAttrs } from './utils.mjs';
import compileCSS from './css.mjs';
import compileJS from './js.mjs';
import posthtml from 'posthtml';

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
  const { html } = await posthtml([
    tree => {
      const promises = [];
      tree.match({ tag: 'script' }, node => {
        if (node.attrs && node.attrs.src != null) {
          node.attrs = {
            ...node.attrs,
            type: 'module',
          };
          return node;
        } else {
          const ext = getScriptExtensionByAttrs(node.attrs);
          const nodeContent = node.content.join('');
          // TODO: check if sourcemaps can be usefull for inline scripts
          promises.push(compileJS({
            ...ctx,
            path: `${ctx.path}-${scriptIndex++}${ext}`,
            stats: {
              ...ctx.stats,
              ext,
            },
          }, nodeContent, false, { skipSM: true }).then(({ code }) => {
            node.content = [ code ];
          }));
          return node;
        }
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
  ])
    .process(inputContent, options);
  return { code: html };
};
