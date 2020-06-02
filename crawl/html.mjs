import { changeStyleExt, getBundleName, getScriptName } from './utils.mjs';
import buildCss from './css.mjs';
import buildJs from './js.mjs';
import posthtml from 'posthtml';

export default async (content, url, { app, entries, queue }) => {
  const baseURI = `${app.protocol}://${app.localIP}:${app.port}`;
  const insertSW = url.includes('index.html');
  let scriptIndex = 0;
  let styleIndex = 0;
  const noModules = [];

  const plugins = [
    tree => {
      tree.match({ tag: 'link' }, node => {
        if (
          node.attrs &&
          node.attrs.href != null &&
          (
            node.attrs.href.startsWith(baseURI) ||
            node.attrs.href.startsWith('/') ||
            node.attrs.href.startsWith('.') ||
            (
              !node.attrs.href.startsWith('http://') &&
              !node.attrs.href.startsWith('https://')
            )
          )
        ) {
          const trName = (!node.attrs.rel || node.attrs.rel === 'stylesheet') ?
            changeStyleExt(node.attrs.href) :
            node.attrs.href;
          queue.set(trName, node.attrs.href);
          node.attrs.href = trName;
        }
        return node;
      });
    },
    tree => {
      const promises = [];
      tree.match({ tag: 'script' }, node => {
        if (
          node.attrs &&
          node.attrs.src != null &&
          (
            node.attrs.src.startsWith(baseURI) ||
            node.attrs.src.startsWith('/') ||
            node.attrs.src.startsWith('.') ||
            (
              !node.attrs.src.startsWith('http://') &&
              !node.attrs.src.startsWith('https://')
            )
          )
        ) {
          if (
            !('nomodule' in node.attrs) &&
            !node.attrs.src.includes('hq-livereload.js')
          ) {
            noModules.push([ node.attrs.src, node.attrs.async, node.attrs.defer ]);
            entries.add(node.attrs.src);
          }
          const trName = getScriptName(app.root, node.attrs.src);
          queue.set(trName, node.attrs.src);
          node.attrs.src = trName;
        }
        if (!node.attrs || node.attrs.src == null) {
          const nodeContent = node.content.join('');
          promises.push(buildJs(nodeContent, `${url}-${scriptIndex++}.js`, { app, queue }).then(code => {
            node.content = [ code ];
          }));
        }
        return node;
      });
      return Promise.allSettled(promises).then(() => tree);
    },
    tree => {
      tree.match({ tag: 'img' }, node => {
        if (
          node.attrs &&
          node.attrs.src != null &&
          (
            node.attrs.src.startsWith(baseURI) ||
            node.attrs.src.startsWith('/') ||
            node.attrs.src.startsWith('.') ||
            (
              !node.attrs.src.startsWith('http://') &&
              !node.attrs.src.startsWith('https://') &&
              !node.attrs.src.startsWith('data:')
            )
          )
        ) queue.set(node.attrs.src, node.attrs.src);
        return node;
      });
    },
    tree => {
      tree.match({ tag: 'source' }, node => {
        if (
          node.attrs &&
          node.attrs.srcset != null &&
          (
            node.attrs.srcset.startsWith(baseURI) ||
            node.attrs.srcset.startsWith('/') ||
            node.attrs.srcset.startsWith('.') ||
            (
              !node.attrs.srcset.startsWith('http://') &&
              !node.attrs.srcset.startsWith('https://')
            )
          )
        ) queue.set(node.attrs.srcset, node.attrs.srcset);
        return node;
      });
    },
    tree => {
      if (insertSW) {
        tree.match({ tag: 'body' }, node => ({
          ...node,
          content: [
            ...node.content,
            ...noModules
              .map(([ src, async, defer ]) => ({
                attrs: {
                  async,
                  defer,
                  nomodule: true,
                  src: getBundleName(src),
                  type: undefined,
                },
                tag: 'script',
              })),
            {
              content: [
                'if (\'serviceWorker\' in navigator) {',
                '  navigator.serviceWorker.register(\'/hq-sw.js\');',
                '};',
              ],
              tag: 'script',
            },
          ],
        }));
      }
    },
    tree => {
      const promises = [];
      tree.match({ tag: 'style' }, node => {
        const nodeContent = node.content.join('');
        promises.push(buildCss(nodeContent, `${url}-${styleIndex++}.css`, { app, queue }).then(code => {
          node.content = [ code ];
        }));
        return node;
      });
      return Promise.all(promises).then(() => tree);
    },
  ];

  const { html } = await posthtml(plugins)
    .process(content);

  return html;
};
