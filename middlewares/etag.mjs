import { HTTP_CODES } from '../utils.mjs';

const MAX_AGE = 0;
const PROD_MAX_AGE = 60 * 60; // 1h

export default () => (ctx, next) => {
  const maxAge = ctx.production ? PROD_MAX_AGE : MAX_AGE;
  ctx.status = HTTP_CODES.OK;
  ctx.etag = `${ctx.app.startTime}:${ctx.stats.version}`;
  ctx.set('Cache-Control', `private, max-age=${maxAge}`);
  if (ctx.app.debug) console.log('Checking etag', ctx.fresh, ctx.etag);
  if (ctx.fresh) {
    ctx.status = HTTP_CODES.NOT_MODIFIED;
    ctx.body = null;
    return null;
  }
  return next();
};
