import { getServer, getSrc, getVersion, readPackageJSON, readPlugins } from './utils.mjs';
import Koa from 'koa';
import Table from './res/table.mjs';
import fs from 'fs-extra';
import hq from './hq.mjs';
import path from 'path';
import url from 'url';

const HQ_ROOT = path.dirname(url.fileURLToPath(import.meta.url));

const liveReloadServer = async (app, server) => {
  if (app.production) {
    // FIXME: check why process ends without this watch
    app.table.watch([ app.src, './node_modules' ]);
    return null;
  }

  const { default: WebSocket } = await import('ws');
  const wss = new WebSocket.Server({ server });

  let doReload = true;
  const reload = () => {
    if (doReload) {
      if (app.verbose) console.log('🔄 Reloaded\n\n');
      doReload = false;
      process.nextTick(() => {
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) client.send('reload');
        }
        doReload = true;
      });
    }
  };

  app.table.setReload(reload).watch([ app.src, './node_modules' ]);

  return wss;
};

/* eslint-disable max-statements */
const setUp = async (app, {
  ROOT,
  build,
  certs,
  server,
  verbose,
}) => {
  const { port } = server.address();
  const babelRCPath = path.join(ROOT, '.babelrc');
  const postCSSRCPath = path.join(ROOT, '.postcssrc');
  const postHTMLRCPath = path.join(ROOT, '.posthtmlrc');
  const packageJSON = await readPackageJSON(
    ROOT,
    { search: false },
    [ 'browser', 'main', 'module', 'version', 'dependencies' ],
  );
  const vue = getVersion(packageJSON.dependencies, 'vue');

  app.build = build;
  app.hqroot = HQ_ROOT;
  app.production = process.env.NODE_ENV === 'production' || build;
  app.root = ROOT;
  app.src = await getSrc(ROOT);
  app.table = new Table;
  app.certs = certs;
  app.port = port;
  app.protocol = server.protocol;
  app.localIP = server.localIP;
  app.babelrc = await fs.pathExists(babelRCPath) ? babelRCPath : undefined;
  app.postcssrc = await fs.pathExists(postCSSRCPath) ? postCSSRCPath : undefined;
  app.posthtmlrc = await fs.pathExists(postHTMLRCPath) ? postHTMLRCPath : undefined;
  app.verbose = verbose;
  app.startTime = Date.now();
  app.dependencies = { vue };

  // TODO: invalidate compilation results and cache if config was changed
  app.cssPlugins = await readPlugins(app, app.postcssrc);
  app.htmlPlugins = await readPlugins(app, app.posthtmlrc);
};
/* eslint-enable max-statements */

export default async (ROOT, PORT, { build, buildArg, verbose } = {}) => {
  const app = new Koa;
  const { certs, server } = await getServer({ app, host: '0.0.0.0', port: PORT, root: ROOT });

  await setUp(app, {
    ROOT,
    build,
    certs,
    server,
    verbose,
  });

  if (app.verbose) {
    console.log(`
| hq root    : ${app.hqroot}

| root       : ${app.root}
| src        : ${app.src}

| certs      : ${app.certs}

| babelrc    : ${app.babelrc}
| postcssrc  : ${app.postcssrc}
| posthtmlrc : ${app.posthtmlrc}
`);
  }

  app.use(hq());

  if (build) {
    try {
      const { default: crawl } = await import('./crawl/index.mjs');
      crawl(app, buildArg);
    } catch (e) {
      console.log(e);
    }
  }

  const wss = await liveReloadServer(app, server);

  return { app, server, wss };
};
