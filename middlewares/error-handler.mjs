import { HTTP_CODES } from '../utils.mjs';

export default () => async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(`❌ Error ${ctx.path}: ${err.message}`);
    console.log(err.stack);
    ctx.status = err.status || HTTP_CODES.INTERNAL_SERVER_ERROR;
    ctx.body = `${err.message}\n${err.stack}`;
    ctx.etag = '';
    ctx.set('Cache-Control', '');
    ctx.app.emit('error', err, ctx);
  }
};
