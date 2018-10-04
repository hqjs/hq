import HTMLASTTransform from 'html-ast-transform';
import fs from 'fs-extra';
import { saveContent } from './utils.mjs';

const { getAttr, h, transform, withAttr } = HTMLASTTransform;

export default async ctx => {
  const content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  const insertLR = ctx.path.includes('index.html');
  const res = await transform(content, {
    fragment: false,
    replaceTags: {
      body(node) {
        if (insertLR) {
          const [ protocol, host ] = ctx.store.baseURI.split(':');
          const lrScript = h('script', [{
            name: 'src',
            value: `${protocol}:${host}:${ctx.app.lrPort}/livereload.js?snipver=1`,
          }]);
          node.childNodes.push(lrScript);
        }
        return node;
      },
      script(node) {
        return getAttr(node, 'src') ?
          withAttr(node, 'type', 'module') :
          node;
      },
    },
    trimWhitespace: false,
  });
  return saveContent(res, ctx);
};
