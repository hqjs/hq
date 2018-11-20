import { HTTP_CODES } from '../utils.mjs';

const MAX_AGE = 0;

export default () => (ctx, next) => {
  ctx.status = HTTP_CODES.OK;
  ctx.etag = `${ctx.app.startTime}:${ctx.stats.version}`;
  ctx.set('Cache-Control', `private, max-age=${MAX_AGE}`);
  if (ctx.app.debug) console.log('Checking etag', ctx.fresh, ctx.etag);
  if (ctx.fresh) {
    ctx.status = HTTP_CODES.NOT_MODIFIED;
    ctx.body = null;
    return null;
  }
  return next();
};
