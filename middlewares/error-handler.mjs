import HTTP_CODES from 'http-status-codes';

export default () => async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err.message, err, ctx.path);
    ctx.status = err.status || HTTP_CODES.INTERNAL_SERVER_ERROR;
    ctx.body = err.message;
    ctx.etag = '';
    ctx.set('Cache-Control', '');
    ctx.app.emit('error', err, ctx);
  }
};
