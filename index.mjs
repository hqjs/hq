#!/usr/bin/env node --experimental-modules --no-warnings

import { getServer, getSrc } from './utils.mjs';
import Koa from 'koa';
import Table from './res/table.mjs';
import WebSocket from 'ws';
import fs from 'fs-extra';
import hq from './hq.mjs';
import info from './package.json';
import path from 'path';

console.log(`(c) hqjs @ ${info.version}`);

const PORT = 8080;

const ROOT = path.resolve();

(async () => {
  const app = new Koa;
  const src = await getSrc(ROOT);
  const babelRCPath = path.join(ROOT, '.babelrc');
  const useBabelRC = await fs.pathExists(babelRCPath);
  const server = await getServer({ app, host: '0.0.0.0', port: PORT });
  const { port } = server.address();
  const wss = new WebSocket.Server({ server });

  let doReload = true;
  const reload = () => {
    if (doReload) {
      doReload = false;
      process.nextTick(() => {
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) client.send('reload');
        }
        doReload = true;
      });
    }
  };

  app.port = port;
  app.src = src;
  app.babelrc = useBabelRC ? babelRCPath : undefined;
  app.debug = process.env.NODE_ENV === 'debug';
  app.table = new Table(reload).watch([ src, './node_modules' ]);
  app.startTime = Date.now();

  app.use(hq());
})();
