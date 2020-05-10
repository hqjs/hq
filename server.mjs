import { getServer, getSrc } from './utils.mjs';
import Koa from 'koa';
import Table from './res/table.mjs';
import WebSocket from 'ws';
import fs from 'fs-extra';
import hq from './hq.mjs';
import path from 'path';

const HQ_ROOT = path.dirname(import.meta.url.slice('file://'.length));

export default async (ROOT, PORT, { build, buildArg, verbose }) => {
  const src = await getSrc(ROOT);
  const babelRCPath = path.join(ROOT, '.babelrc');
  const useBabelRC = await fs.pathExists(babelRCPath);
  const app = new Koa;
  app.hqroot = HQ_ROOT;
  app.root = ROOT;
  app.build = build;
  const { certs, server } = await getServer({ app, host: '0.0.0.0', port: PORT });
  const { port } = server.address();
  const wss = new WebSocket.Server({ server });

  let doReload = true;
  const reload = () => {
    if (doReload) {
      if (app.debug) console.log('Reloaded');
      doReload = false;
      process.nextTick(() => {
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) client.send('reload');
        }
        doReload = true;
      });
    }
  };

  app.certs = certs;
  app.port = port;
  app.protocol = server.protocol;
  app.localIP = server.localIP;
  app.src = src;
  app.babelrc = useBabelRC ? babelRCPath : undefined;
  app.table = new Table(reload).watch([src, './node_modules']);
  app.production = process.env.NODE_ENV === 'production' || build;
  app.verbose = verbose;
  app.startTime = Date.now();

  app.use(hq());

  if (build) {
    try {
      const { default: crawl } = await import('./crawl/index.mjs');
      crawl(app, buildArg);
    } catch(e) {
      console.log(e);
    }
  }

  return { server, app, wss, version };
};
