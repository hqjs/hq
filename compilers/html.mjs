import fs from 'fs-extra';
import pug from 'pug';
import sanitizeHTML from 'sanitize-html';
import { saveContent } from './utils.mjs';

export default async ctx => {
  let content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  const insertLR = ctx.path.includes('index.html');
  if (ctx.stats.ext === '.pug') content = pug.render(content, {
    compileDebug: false,
    filename: ctx.srcPath,
    pretty: true,
  });
  // TODO: transform script and style content
  let res = sanitizeHTML(content, {
    allowedAttributes: false,
    allowedTags: false,
    parser: {
      lowerCaseAttributeNames: false,
      lowerCaseTags: false,
    },
    transformTags: {
      script(tagName, attribs, text) {
        return attribs.src == null ?
          {
            attribs,
            tagName,
            text,
          } :
          {
            attribs: { ...attribs, type: 'module' },
            tagName,
          };
      },
    },
  });
  if (insertLR) {
    const [ protocol, host ] = ctx.store.baseURI.split(':');
    const lrScript = `<script src=${protocol}:${host}:${ctx.app.lrPort}/livereload.js?snipver=1></script>`;
    res = res.replace(/<\/(\s*body)([^>]*)>/i, `\n${lrScript}\n</$1$2>`);
  }
  return saveContent(res, ctx);
};
