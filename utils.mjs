import fg from 'fast-glob';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import resolvePackage from 'resolve';

const MAX_RETRY = 30;

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const intfs of Object.values(interfaces)) {
    for (const intf of intfs) {
      if (intf.family === 'IPv4' && !intf.internal) return intf;
    }
  }
  return null;
};

const { address: LOCAL_IP } = getLocalIP();

const WORKER_REXP = /(worker|sw)\d*\b/i;

export const HTTP_CODES = {
  INTERNAL_SERVER_ERROR: 500,
  NOT_ACCEPTABLE: 406,
  NOT_FOUND: 404,
  NOT_MODIFIED: 304,
  OK: 200,
};

export const WATCH_EXTENSIONS = [
  'pug',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'jsx',
  'es6',
  'mjs',
  'vue',
  'svelte',
  'json',
  'ts',
  'tsx',
  'coffee',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'glsl',
  'vert',
  'frag',
];

export const isMap = filePath => path.extname(filePath).toLowerCase() === '.map';

export const isTest = filePath => filePath.startsWith('/test/');

export const isVendor = filePath => filePath.startsWith('/node_modules/');

export const isPolyfill = filePath => filePath.startsWith('/node_modules/core-js/') ||
  filePath.startsWith('/node_modules/buffer') ||
  filePath.startsWith('/node_modules/process');

export const isInternal = filePath => filePath.includes('/hq-livereload.js');

export const isCertificate = (filePath, app) => app.certs.includes(filePath);

export const isWorker = filePath => WORKER_REXP.test(filePath);

export const isDefaultFavicon = filePath => filePath.endsWith('favicon.ico');

export const isSource = ext => [
  '.pug',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.js',
  '.jsx',
  '.mjs',
  '.es6',
  '.vue',
  '.svelte',
  '.ts',
  '.tsx',
  '.coffee',
  '.map',
].includes(ext);

export const getResType = ext => {
  switch (ext) {
    case '.jsx':
    case '.ts':
    case '.tsx':
    case '.es6':
    case '.vue':
    case '.svelte':
    case '.coffee': return '.js';
    case '.scss':
    case '.sass':
    case '.less': return '.css';
    case '.pug': return '.html';
    default: return ext;
  }
};

/* eslint-disable complexity */
// TODO: delete this method it is unused
export const getLinkType = (ext, name) => {
  // TODO add other types https://w3c.github.io/preload/#as-attribute
  switch (ext) {
    case '.js':
    case '.jsx':
    case '.es6':
    case '.vue':
    case '.svelte':
    case '.ts':
    case '.tsx':
    case '.coffee':
    case '.mjs': return WORKER_REXP.test(name) ? 'worker' : 'script';
    case '.json': return 'script';
    case '.scss':
    case '.sass':
    case '.less':
    case '.css': return 'style';
    case '.pug':
    case '.html': return 'document';
    case '.woff':
    case '.woff2': return 'font';
    case '.gif':
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.svg':
    case '.webp': return 'image';
    default: return '';
  }
};
/* eslint-enable complexity */

export const findExistingExtension = async filepath => {
  if (filepath.endsWith('index') && await fs.pathExists(`${filepath}.html`)) return '.html';
  else if (await fs.pathExists(`${filepath}.jsx`)) return '.jsx';
  else if (await fs.pathExists(`${filepath}.vue`)) return '.vue';
  else if (await fs.pathExists(`${filepath}.svelte`)) return '.svelte';
  else if (await fs.pathExists(`${filepath}.mjs`)) return '.mjs';
  else if (await fs.pathExists(`${filepath}.json`)) return '.json';
  else if (await fs.pathExists(`${filepath}.ts`)) return '.ts';
  else if (await fs.pathExists(`${filepath}.tsx`)) return '.tsx';
  else if (await fs.pathExists(`${filepath}.coffee`)) return '.coffee';
  else if (await fs.pathExists(`${filepath}.es6`)) return '.es6';
  else if (await fs.pathExists(`${filepath}.js`)) return '.js';
  else if (await fs.pathExists(filepath)) return '';
  else if (!filepath.endsWith('index') && await fs.pathExists(`${filepath}.html`)) return '.html';
  else throw new Error(`File ${filepath} not found`);
};

export const getModulePath = filepath => `/node_modules/${filepath.split('/node_modules/')[1]}`;

export const getPackageJSONDir = async dir => {
  let dirPath = dir;
  while (dirPath !== '/' && !await fs.pathExists(`${dirPath}/package.json`)) {
    dirPath = path.join(dirPath, '..');
  }
  if (!await fs.pathExists(`${dirPath}/package.json`)) return null;
  return dirPath;
};

export const readPackageJSON = async (dir, { search = true } = {}) => {
  const dirPath = search ? await getPackageJSONDir(dir) : dir;
  try {
    return JSON.parse(await fs.readFile(`${dirPath}/package.json`, { encoding: 'utf8' }));
  } catch {
    return {};
  }
};

// FIXME: make it work advanced package.json browser
export const resolvePackageMain = async (dir, { search = false } = {}) => {
  const dirPath = search ? await getPackageJSONDir(dir) : dir;
  const packageJSON = await readPackageJSON(dirPath, { search: false });
  return packageJSON.module ||
    (typeof packageJSON.browser === 'string' && packageJSON.browser) ||
    packageJSON.main ||
    `index${await findExistingExtension(`${dirPath}/index`)}`;
};

// FIXME: make it work advanced package.json browser
export const resolvePackageFrom = (basedir, filePath) => new Promise((resolve, reject) => {
  const [ , modName ] = filePath.split('/node_modules/');
  const modResolve = resolvePackage.isCore(modName) ? `${modName}/` : modName;
  return resolvePackage(
    modResolve,
    {
      basedir,
      packageFilter(pkg) {
        if (pkg.browser && typeof pkg.browser === 'string') pkg.main = pkg.browser;
        if (pkg.module) pkg.main = pkg.module;
        return pkg;
      },
    },
    (err, p) => {
      if (err) reject(err);
      resolve(p);
    },
  );
});

export const readPlugins = async (ctx, config) => {
  try {
    const { plugins } = JSON.parse(await fs.readFile(path.resolve(ctx.app.root, config), { encoding: 'utf-8' }));
    const pluginsConfig = await Promise.all(plugins.map(async p => {
      const [ pluginName, ...args ] = Array.isArray(p) ? p : [ p ];
      const pluginPath = await resolvePackageFrom(ctx.app.root, `/node_modules/${pluginName}`);
      const { default: plugin } = await import(pluginPath);
      return { args, plugin };
    }));
    return pluginsConfig.map(({ args, plugin }) => plugin(...args));
  } catch {
    return [];
  }
};

/* eslint-disable no-unused-expressions */
const getFreeServer = ({ app, certs, cfg, host, net, port, retry, s, secure }) => new Promise((resolve, reject) => {
  const server = secure ?
    net.createSecureServer({ allowHTTP1: true, ...cfg }, app.callback()) :
    net.createServer(app.callback());
  server.unref();
  server.on('error', reject);
  // Next 2 lines required for vscode plugin
  server.localIP = LOCAL_IP;
  server.protocol = `http${s}`;
  server.listen(port, host, () => {
    console.log(`Start time: ${process.uptime().toFixed(1)} s`);
    console.log(`Visit http${s}://localhost:${port}\nor http${s}://${LOCAL_IP}:${port} within local network`);
    import('./compilers/html.mjs');
    resolve({
      certs: certs.map(crt => crt.slice(app.root.length)),
      server,
    });
  });
}).catch(err => {
  if (retry > MAX_RETRY) throw err;
  return getFreeServer({ app, certs, cfg, host, net, port: port + 1, retry: retry + 1, s, secure });
});
/* eslint-enable no-unused-expressions */

export const getServer = async ({ app, host, port }) => {
  const certs = await fg(`${app.root}/**/*.pem`, { ignore: [ `${app.root}/node_modules/**` ] });
  const cfg = (await Promise.all(certs.slice(0, 2).map(crt => fs.readFile(crt))))
    .reduce(
      ({ cert, key }, file, index) => certs[index].endsWith('key.pem') ?
        { cert, key: file } :
        { cert: file, key },
      { cert: null, key: null },
    );
  const secure = Boolean(cfg.cert && cfg.key);
  const s = secure ? 's' : '';
  const net = await (secure ?
    import('http2') :
    import('http')
  );

  return getFreeServer({
    app,
    certs,
    cfg,
    host,
    net,
    port,
    retry: 0,
    s,
    secure,
  });
};

export const getSrc = async root => {
  const [ packageJSON, rootHTML, srcHTML, srcExists ] = await Promise.all([
    readPackageJSON(root),
    fs.pathExists(path.join(root, './index.html')),
    fs.pathExists(path.join(root, 'src/index.html')),
    fs.pathExists(path.join(root, 'src')),
  ]);
  return packageJSON.module ?
    path.dirname(packageJSON.module) :
    srcHTML ?
      'src' :
      rootHTML ?
        '.' :
        srcExists ?
          'src' :
          packageJSON.main ?
            path.dirname(packageJSON.main) :
            '.';
};
