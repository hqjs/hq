import posthtml from 'posthtml';
import compileJS from './js.mjs';
import compileCSS from './css.mjs';

const getScriptExtensionByType = node => {
  if (node.attrs == null || node.attrs.type) return '.js';
  switch (node.attrs.type) {
    case 'application/coffeescript':
    case 'text/coffeescript': return '.coffee';
    case 'application/typescript':
    case 'text/typescript': return '.ts';
    default: return '.js';
  }
};

const getStyleExtensionByType = node => {
  if (node.attrs == null || node.attrs.type) return '.css';
  switch (node.attrs.type) {
    case 'text/scss': return '.scss';
    case 'text/sass': return '.sass';
    case 'text/less': return '.less';
    default: return '.css';
  }
};

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
          const ext = getScriptExtensionByType(node);
          const [ nodeContent ] = node.content;
          // TODO: check if sourcemaps can be usefull for inline scripts
          promises.push(compileJS({
            ...ctx,
            path: `${ctx.path}-${scriptIndex++}${ext}`,
            stats: {
              ...ctx.stats,
              ext,
            },
          }, nodeContent, false, true).then(({ code }) => {
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
              attrs: { src: `${protocol}:${host}:${ctx.app.lrPort}/livereload.js?snipver=1` },
              tag: 'script',
            },
          ],
        }));
      }
    },
    tree => {
      const promises = [];
      tree.match({ tag: 'style' }, node => {
        const ext = getStyleExtensionByType(node);
        const [ nodeContent ] = node.content;
        promises.push(compileCSS({
          ...ctx,
          path: `${ctx.path}$${styleIndex++}${ext}`,
          stats: {
            ...ctx.stats,
            ext,
          },
        }, nodeContent, false, true).then(({ code }) => {
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
