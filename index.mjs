#!/usr/bin/env node --experimental-modules --no-warnings

import Koa from 'koa';
import Table from './res/table.mjs';
import fs from 'fs-extra';
import getPort from 'get-port';
import hq from './hq.mjs';
import http from 'http';
import info from './package.json';
import livereload from 'livereload';
import path from 'path';
import { WATCH_EXTENSIONS, readPackageJSON } from './utils.mjs';

console.log(`(c) hqjs @ ${info.version}`);

const LR_PORT = 35729;
const PORT = 8080;

const ROOT = path.resolve();

const app = new Koa;

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
  app.lrPort = lrPort;
  const lrServer = livereload.createServer({
    applyCSSLive: false,
    applyImgLive: false,
    extensions: WATCH_EXTENSIONS,
    host: 'localhost',
    port: lrPort,
  }, err => {
    if (err) throw err;
  });
  lrServer.watch([
    path.resolve(ROOT, src),
    path.resolve(ROOT, 'node_modules'),
  ]);
};

const startServer = async src => {
  const babelRCPath = path.join(ROOT, '.babelrc');
  const useBabelRC = await fs.pathExists(babelRCPath);

  app.src = src;
  app.babelrc = useBabelRC ? babelRCPath : undefined;
  app.debug = process.env.NODE_ENV === 'debug';
  app.table = new Table().watch([ src, './node_modules' ]);
  app.startTime = Date.now();

  app.use(hq());

  const port = await getPort({ port: PORT, host: '127.0.0.1' });

  const server = http.createServer(app.callback());

  server.listen(port, 'localhost', err => {
    if (err) throw err;
    console.log(`Start time: ${process.uptime()}`);
    console.log(`Visit http://localhost:${port}`);
    import('./compilers/html.mjs');
  });
};

(async () => {
  const src = await getSrc();

  startLRServer(src);
  startServer(src);
})();
