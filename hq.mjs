import build from './middlewares/build.mjs';
import checkSupport from './middlewares/check-support.mjs';
import compose from 'koa-compose';
import compress from './middlewares/compress.mjs';
import cors from '@koa/cors';
import detectUA from './middlewares/detect-ua.mjs';
import errorHandler from './middlewares/error-handler.mjs';
import etag from './middlewares/etag.mjs';
import resolvePath from './middlewares/resolve-path.mjs';
import resourceTable from './middlewares/resource-table.mjs';
// import serverPush from './middlewares/server-push.mjs';

export default () => compose([
  errorHandler(),
  cors({ origin: '*' }),
  detectUA(),
  checkSupport(),
  resolvePath(),
  resourceTable(),
  etag(),
  // serverPush(),
  build(),
  compress(),
]);
