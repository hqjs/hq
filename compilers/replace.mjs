import fs from 'fs-extra';
import path from 'path';
import { saveContent } from './utils.mjs';

const RELATIVE_PATTERN = /('|")\s*(\.{1,2})\/([^'"]*)/g;
const ABSOLUTE_PATTERN = /('|"|`)\s*(\/node_modules)\/([^'"`]*)/g;

const replace = (baseURI, dirname) =>
  (match, quote, dots, rest) => `${quote}${baseURI}${path.join(dirname, dots, rest)}`;

const replaceRelativePath = async ctx => {
  const content = await fs.readFile(ctx.srcPath, { encoding: 'utf8' });
  const upContent = content.replace(RELATIVE_PATTERN, replace(ctx.store.baseURI, ctx.dirname));

  return upContent.replace(ABSOLUTE_PATTERN, replace(ctx.store.baseURI, ''));
};

export default async ctx => {
  const replaced = await replaceRelativePath(ctx);
  return saveContent(replaced, ctx);
};
