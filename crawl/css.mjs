import { changeStyleExt } from './utils.mjs';
import path from 'path';
import postcss from 'postcss';

export default async (content, url, { app, queue }) => {
  const baseURI = `${app.protocol}://${app.localIP}:${app.port}`;

  const plugins = [
    root => {
      root.walkAtRules('import', rule => {
        for (const [ , urlLink, quoteLink, cssLink ] of rule.params.matchAll(/url\(['"]*([^'")]+)['"]*\)|['"]([^'"]+)['"]|([^\s]+\.css)/g)) {
          const link = urlLink || quoteLink || cssLink;
          if (
            link.startsWith(baseURI) ||
            link.startsWith('/') ||
            link.startsWith('.')
          ) {
            const trName = changeStyleExt(link);
            queue.set(trName, link);
            rule.params.replace(link, trName);
          }
        }
      });
      root.walkAtRules('font-face', rule => {
        rule.walkDecls('src', decl => {
          for (const [ , link ] of decl.value.matchAll(/url\(['"]*([^'")]+)['"]*\)/g)) {
            if (
              !link.startsWith('data:') &&
              !link.startsWith('#') && (
                link.startsWith(baseURI) ||
                link.startsWith('/') ||
                link.startsWith('.') || (
                  !link.startsWith('http:') &&
                  !link.startsWith('https:')
                )
              )
            ) {
              const [ name ] = link.split('#')[0].split('?');
              const reqPath = url.startsWith(baseURI) ?
                url.slice(baseURI.length) :
                url;
              const trName = path.resolve(path.dirname(reqPath), name);
              queue.set(trName, trName);
            }
          }
        });
      });
      root.walkAtRules('counter-style', rule => {
        rule.walkDecls('symbols', decl => {
          for (const [ , link ] of decl.value.matchAll(/url\(['"]*([^'")]+)['"]*\)/g)) {
            if (
              !link.startsWith('data:') &&
              !link.startsWith('#') && (
                link.startsWith(baseURI) ||
                link.startsWith('/') ||
                link.startsWith('.')
              )
            ) {
              const [ name ] = link.split('#')[0].split('?');
              queue.set(name, name);
            }
          }
        });
      });
      root.walkRules(rule => {
        rule.walkDecls(/^(background-image|background|list-style-image|list-style|content|cursor|border-image-source|border-image|border|mask-image|mask|src)$/, decl => {
          for (const [ , link ] of decl.value.matchAll(/url\(['"]*([^'")]+)['"]*\)/g)) {
            if (
              !link.startsWith('data:') &&
              !link.startsWith('#') && (
                link.startsWith(baseURI) ||
                link.startsWith('/') ||
                link.startsWith('.')
              )
            ) {
              const [ name ] = link.split('#')[0].split('?');
              queue.set(name, name);
            }
          }
        });
      });
    },
  ];

  const { css } = await postcss(plugins)
    .process(content, { from: undefined });

  return css;
};
