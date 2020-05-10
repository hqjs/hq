import { changeScriptExt, changeStyleExt, fetch, getBundleName, getScriptName } from './utils.mjs';
import buildCss from './css.mjs';
import buildHtml from './html.mjs';
import buildJs from './js.mjs';
import buildManifest from './manifest.mjs';
import fs from 'fs-extra';
import path from 'path';
import { resolvePackageMain } from '../utils.mjs';
import rollup from 'rollup/dist/rollup.js';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const scriptExtensions = [
  '.js',
  '.mjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.coffee',
  '.es6',
  '.vue',
  '.svelte',
];

/* eslint-disable max-statements */
export default async (app, buildArg) => {
  let buildPath;
  let override = false;
  if (!buildArg) await fs.remove(path.resolve(app.root, 'dist'));
  else {
    override = true;
    const src = app.src.startsWith('./') ? app.src.slice(2) : app.src;
    const arg = buildArg.startsWith('./') ? buildArg.slice(2) : buildArg;
    buildPath = arg.startsWith(src) ? arg.slice(src.length + 1) : arg;
  }
  const main = buildPath || await resolvePackageMain(path.resolve(app.root, app.src), { search: false });
  const mainUrl = `/${main}`;
  const errors = new Set;
  await makeBuild(app, mainUrl, true, errors, override);
  if ([
    '',
    '.js',
    '.mjs',
    '.jsx',
    '.ts',
    '.tsx',
    '.vue',
    '.coffee',
    '.svelte',
    '.html',
  ].includes(path.extname(mainUrl))) await makeBuild(app, mainUrl, false, errors);
  if (errors.size === 0) console.log('\n\n\n✅ Build successfully completed!');
  else console.log(`\n\n⚠️  Build completed with errors:\n${[ ...errors ].map(err => `    🚫 ${err}`).join('\n')}`);
  process.exit(0);
};

const makeBuild = async (app, main, module, errors, override) => {
  const entries = scriptExtensions.some(ext => main.endsWith(ext)) ?
    new Set([ main ]) :
    new Set;
  const requests = new Set;
  const visited = new Set;
  const resources = new Set;
  await request(app, main, module, { entries, errors, requests, resources, visited });
  const baseURI = `${app.protocol}://${app.localIP}:${app.port}`;
  if (requests.size === 0) {
    if (module && resources.has('/index.html')) {
      await createServiceWorker(app, resources);
    }
    if (!module && entries.size > 0) console.log('\n\n📦 Bundling for old browsers');
    if (override) {
      await Promise.allSettled(Array.from(visited).map(f => fs.remove(path.resolve(app.root, 'dist', f.slice(1)))));
    }
    try {
      await Promise.allSettled(Array.from(entries)
        .map(rpath => rpath.startsWith(baseURI) ?
          rpath.slice(baseURI.length) :
          !rpath.startsWith('/') ?
            `/${rpath}` :
            rpath)
        .map(rpath => Promise.allSettled([
          makeBundle(app, true, rpath),
          makeBundle(app, false, rpath),
        ])));
    } catch (e) {
      console.log(e);
    }
    if (module) {
      const moduleRoot = path.resolve(app.root, 'dist/module');
      await fs.copy(moduleRoot, path.resolve(app.root, 'dist'), { overwrite: false });
      await fs.remove(path.resolve(app.root, 'dist/module'));
    } else {
      await fs.remove(path.resolve(app.root, 'dist/nomodule'));
    }
  }
};

const request = async (app, req, module, {
  entries = new Set,
  errors = new Set,
  requests = new Set,
  resources = new Set,
  visited = new Set,
} = {}) => {
  const baseURI = `${app.protocol}://${app.localIP}:${app.port}`;
  const reqPath = req.startsWith(baseURI) ?
    req.slice(baseURI.length) :
    !req.startsWith('/') ?
      `/${req}` :
      req;
  const url = `${baseURI}${reqPath}`;
  const queue = new Map;
  try {
    requests.add(url);
    console.log(`⬇️  ${reqPath}`);
    await build(url, reqPath, module, { app, entries, queue, resources, visited });
    console.log(`🆗 ${reqPath}`);
  } catch (e) {
    console.log(e);
    errors.add(e);
  } finally {
    await Promise.allSettled(Array.from(queue.entries())
      .map(([ fpath, rpath ]) => {
        const trPath = rpath.startsWith(baseURI) ?
          rpath.slice(baseURI.length) :
          !rpath.startsWith('/') ?
            path.resolve('/', rpath) :
            rpath;
        const tfPath = fpath.startsWith(baseURI) ?
          fpath.slice(baseURI.length) :
          !fpath.startsWith('/') ?
            path.resolve('/', fpath) :
            fpath;
        return [ tfPath, trPath ];
      })
      .filter(([ fpath, rpath ]) => !visited.has(rpath) && (
        module ||
        [ '', '.js', '.mjs' ].includes(path.extname(fpath))
      ))
      .map(([ , rpath ]) => request(app, rpath, module, {
        entries,
        errors,
        requests,
        resources,
        visited,
      })));

    requests.delete(url);
  }
};

const build = async (url, reqPath, module, { app, entries, queue, resources, visited }) => {
  visited.add(reqPath);
  const ua = module ?
    'module/1.0' :
    'nomodule/1.0';
  const distPath = path.resolve(app.root, module ? 'dist/module' : 'dist/nomodule');
  let outputPath;
  let transformed;
  let trReqPath;
  const res = await fetch(url, { headers: { 'user-agent': ua } });
  if (!res.ok) throw new Error(`Unable to build ${reqPath}: ${res.statusText}`);
  switch (res.headers.get('content-type')) {
    case 'text/html; charset=utf-8': {
      const content = await res.text();
      transformed = await buildHtml(content, url, { app, entries, queue });
      trReqPath = reqPath;
      outputPath = path.resolve(distPath, trReqPath.slice(1));
      break;
    }
    case 'application/javascript; charset=utf-8': {
      const content = await res.text();
      transformed = await buildJs(content, url, { app, queue });
      trReqPath = getScriptName(app.root, reqPath);
      outputPath = path.resolve(distPath, trReqPath.slice(1));
      break;
    }
    case 'text/css; charset=utf-8': {
      const content = await res.text();
      transformed = await buildCss(content, url, { app, queue });
      trReqPath = changeStyleExt(reqPath);
      outputPath = path.resolve(distPath, trReqPath.slice(1));
      break;
    }
    case 'application/manifest+json; charset=utf-8': {
      const content = await res.text();
      transformed = await buildManifest(content, { queue });
      trReqPath = reqPath;
      outputPath = path.resolve(distPath, trReqPath.slice(1));
      break;
    }
    case 'image/png': {
      const content = await res.buffer();
      transformed = content;
      trReqPath = reqPath;
      outputPath = path.resolve(distPath, trReqPath.slice(1));
      break;
    }
    default: {
      const content = await res.text();
      transformed = content;
      trReqPath = reqPath;
      outputPath = path.resolve(distPath, trReqPath.slice(1));
      break;
    }
  }
  resources.add(trReqPath);
  return fs.outputFile(outputPath, transformed);
};

const makeBundle = async (app, module, entry) => {
  const inputOptions = module ?
    {
      input: path.resolve(app.root, 'dist/module', entry.slice(1)),
      plugins: [
        {
          name: 'synthetic-exports',
          resolveId(source, importer) {
            const src = importer ?
              path.resolve(app.root, 'dist/module', source.startsWith('/') ? source.slice(1) : source) :
              source;
            return {
              id: changeScriptExt(src),
              syntheticNamedExports: true,
            };
          },
          transform(code) {
            // TODO: safe and reuse this info during traversal
            return { code, syntheticNamedExports: /export\s+default\W/.test(code) };
          },
        },
      ],
      preserveModules: true,
    } :
    {
      input: path.resolve(app.root, 'dist/nomodule', entry.slice(1)),
      plugins: [
        {
          name: 'synthetic-exports',
          resolveId(source, importer) {
            const src = importer ?
              path.resolve(app.root, 'dist/nomodule', source.startsWith('/') ? source.slice(1) : source) :
              source;
            return {
              id: changeScriptExt(src),
              syntheticNamedExports: true,
            };
          },
          transform(code) {
            return { code, syntheticNamedExports: /export\s+default\W/.test(code) };
          },
        },
      ],
      preserveModules: false,
    };
  const outputOptions = module ?
    {
      compact: true,
      dir: path.resolve(app.root, 'dist'),
      entryFileNames: '[name][extname]',
      format: 'es',
    } :
    {
      compact: true,
      file: path.resolve(app.root, 'dist', getBundleName(entry).slice(1)),
      format: 'iife',
      name: entry,
    };

  let bundle;
  try {
    bundle = await rollup.rollup(inputOptions);
    await bundle.generate(outputOptions);
    await bundle.write(outputOptions);
  } catch (e) {
    if (!e.message.startsWith('Could not load')) console.log('🚧 Bundling problem:', e.message);
  }
};

const createServiceWorker = (app, visited) => fs.outputFile(path.resolve(app.root, 'dist/hq-sw.js'), `
const cacheName = 'hq-${Date.now()}';
const appShellFiles = [${Array
    .from(visited.values())
    .map(spath => `'${spath}'`)
    .join(',')}];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(appShellFiles)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keyList => Promise.all(keyList.map(key => caches.delete(key)))));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request)
    .then(r => r || fetch(e.request)));
});
`);
