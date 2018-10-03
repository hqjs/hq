#!/usr/bin/env node --experimental-modules

import Koa from 'koa';
import Table from './res/table.mjs';
import fs from 'fs-extra';
import getPort from 'get-port';
import hq from './hq.mjs';
import http2 from 'http2';
import livereload from 'livereload';
import path from 'path';
import { readPackageJSON } from './utils.mjs';

const LR_PORT = 35729;
const PORT = 8080;
const EXTENSIONS = [
  'html',
  'css',
  'sass',
  'less',
  'js',
  'jsx',
  'mjs',
  'json',
  'ts',
  'coffee',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
];

const CERT = path.resolve(path.dirname(import.meta.url.slice('file://'.length)), 'cert');
const ROOT = path.resolve();

const getSrc = async () => {
  const packageJSON = await readPackageJSON(ROOT);
  const srcExists = await fs.pathExists(path.join(ROOT, 'src'));
  return packageJSON.module ?
    path.dirname(packageJSON.module) :
    srcExists ?
      'src' :
      packageJSON.main ?
        path.dirname(packageJSON.main) :
        '.';
};

const startLRServer = async src => {
  const lrPort = await getPort({ port: LR_PORT });
  const lrServer = livereload.createServer({
    applyCSSLive: false,
    applyImgLive: false,
    extensions: EXTENSIONS,
    host: 'localhost',
    port: lrPort,
  }, err => {
    if (err) throw err;
    console.log(`Live-reload is listening on http://localhost:${lrPort}`);
  });
  lrServer.watch([
    path.resolve(ROOT, src),
    path.resolve(ROOT, 'node_modules'),
  ]);
};

const loadCertificatesFrom = root => Promise.all([ fs.readFile(`${root}/localhost.crt`), fs.readFile(`${root}/device.key`) ])

const loadCertificates = async () => {
  try {
    const [ cert, key ] = await loadCertificatesFrom(ROOT);
    return { cert, key };
  } catch {
    const [ cert, key ] = await loadCertificatesFrom(CERT);
    return { cert, key };
  }
}

const startServer = async src => {
  const babelRCPath = path.join(ROOT, '.babelrc');
  const useBabelRC = await fs.pathExists(babelRCPath);

  const app = new Koa;

  app.src = src;
  app.babelrc = useBabelRC ? babelRCPath : undefined;
  app.debug = process.env.NODE_ENV === 'debug';
  app.table = new Table().watch([ src, './node_modules' ]);
  app.startTime = Date.now();

  app.use(hq());

  const port = await getPort({ port: PORT, host: '127.0.0.1' });

  const options = await loadCertificates();

  const server = http2.createSecureServer(options, app.callback());

  server.listen(port, 'localhost', err => {
    if (err) throw err;
    console.log(`Listening on https://localhost:${port}`, process.uptime());
    import('./compilers/js.mjs');
    import('./compilers/css.mjs');
    import('./compilers/html.mjs');
  });
};

(async () => {
  const src = await getSrc();

  startLRServer(src);
  startServer(src);
})();
