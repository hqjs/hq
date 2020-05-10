import { changeStyleExt, getScriptName } from './utils.mjs';
import babel from '@babel/core';
import path from 'path';

export default async (content, url, { app, queue }) => {
  const baseURI = `${app.protocol}://${app.localIP}:${app.port}`;

  const notFetch = (t, nodePath) => {
    const [ arg ] = nodePath.node.arguments;
    return nodePath.node.callee.name !== 'fetch' ||
      !t.isStringLiteral(arg) ||
      (
        !arg.value.startsWith(baseURI) &&
        !arg.value.startsWith('/') &&
        !arg.value.startsWith('.')
      ) ||
      nodePath.scope.hasBinding('fetch');
  };

  const notImport = (t, nodePath) => {
    const [ arg ] = nodePath.node.arguments;
    return nodePath.node.callee.type !== 'Import' ||
      !t.isStringLiteral(arg) ||
      (
        !arg.value.startsWith(baseURI) &&
        !arg.value.startsWith('/') &&
        !arg.value.startsWith('.')
      ) ||
      nodePath.scope.hasBinding('import');
  };

  const isComponentDec = (t, node) =>
    node.callee.name === 'Component' &&
    t.isObjectExpression(node.arguments[0]);

  const notHref = (t, nodePath) => {
    const { node } = nodePath;
    return node.property.name !== 'href' ||
    !nodePath.parentPath.isAssignmentExpression() ||
    !t.isStringLiteral(nodePath.parent.right);
  };

  const notSrc = (t, nodePath) => {
    const { node } = nodePath;
    return node.property.name !== 'src' ||
    !nodePath.parentPath.isAssignmentExpression() ||
    !t.isStringLiteral(nodePath.parent.right);
  };

  const isAsset = src => [
    '.gif',
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.webp',
    '.ico',
    '.mp4',
    '.avi',
    '.flv',
    // TODO: add more assets extensions
  ].includes(path.extname(src));

  const plugins = [
    ({ types: t }) => ({
      visitor: {
        CallExpression(nodePath) {
          const { node } = nodePath;
          if (isComponentDec(t, node)) {
            const [{ properties }] = node.arguments;

            const templateUrl = properties.find(p => p.key.name === 'templateUrl');
            const templateName = templateUrl.value.value;
            queue.set(templateName, templateName);

            const styleUrls = properties.find(p => p.key.name === 'styleUrls');
            for (const el of styleUrls.value.elements) {
              const styleName = el.value;
              const trName = changeStyleExt(styleName);
              queue.set(trName, styleName);
              el.value = trName;
            }
          }
          const isNotImport = notImport(t, nodePath);
          if (isNotImport && notFetch(t, nodePath)) return;
          const [ arg ] = node.arguments;
          const { value: modName } = arg;

          if (
            modName.startsWith(baseURI) ||
            modName.startsWith('/') ||
            modName.startsWith('.')
          ) {
            const trName = getScriptName(app.root, modName);
            arg.value = isNotImport ? modName : trName;
            queue.set(isNotImport ? modName : trName, modName);
          }
        },
        ImportDeclaration(nodePath) {
          const { node } = nodePath;
          const { value: modName } = node.source;

          if (
            modName.startsWith(baseURI) ||
            modName.startsWith('/') ||
            modName.startsWith('.')
          ) {
            const trName = getScriptName(app.root, modName);
            node.source.value = trName;
            queue.set(trName, modName);
          }
        },
        MemberExpression(nodePath) {
          const isNotSrc = notSrc(t, nodePath);
          const isNotHref = notHref(t, nodePath);
          if (isNotSrc && isNotHref) return;
          const { value: modName } = nodePath.parent.right;

          if (
            modName.startsWith(baseURI) ||
            modName.startsWith('/') ||
            modName.startsWith('.')
          ) {
            const trName = isAsset(modName) ?
              modName :
              isNotSrc ?
                changeStyleExt(modName) :
                getScriptName(app.root, modName);
            nodePath.parent.right.value = trName;
            queue.set(trName, modName);
          }
        },
      },
    }),
  ];

  const { code } = await babel.transformAsync(content, {
    ast: false,
    babelrc: false,
    code: true,
    comments: false,
    compact: true,
    configFile: false,
    filename: url,
    minified: true,
    plugins,
    sourceMaps: false,
  });

  return code;
};
