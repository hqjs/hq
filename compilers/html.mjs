import HTMLASTTransform from 'html-ast-transform';
import fs from 'fs-extra';
import { saveContent } from './utils.mjs';

const { transform } = HTMLASTTransform;

export default async ctx => {
  const content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  const res = await transform(content, {
    replaceTags: {
      script(node) {
        const src = node.attrs.find(attr => attr.name === 'src');
        if (src) {
          const type = node.attrs.find(attr => attr.name === 'type');
          if (type) type.value = 'module';
          else node.attrs.unshift({ name: 'type', value: 'module' });
        }
        return node;
      },
    },
    trimWhitespace: false,
  });
  return saveContent(res, ctx);
};
