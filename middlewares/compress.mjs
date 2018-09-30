import HTTP_CODES from 'http-status-codes';
import zlib from 'zlib';

const encode = {
  deflate: zlib.createDeflate,
  gzip: zlib.createGzip,
};

const COMPRESSION_THRESHOLD = 1024; // 1Kb

export default () => async ctx => {
  if (ctx.request.method === 'HEAD') return null;
  ctx.encoding = ctx.acceptsEncodings([ 'gzip', 'deflate', 'identity' ]);
  ctx.response.vary('Accept-Encoding');
  if (!ctx.encoding) ctx.throw(HTTP_CODES.NOT_ACCEPTABLE, 'supported encodings: gzip, deflate, identity');
  const compress = ctx.size > COMPRESSION_THRESHOLD &&
    ctx.encoding !== 'identity' &&
    ctx.stats.compress;
  if (!compress) return null;
  ctx.res.removeHeader('Content-Length');
  ctx.set('Content-Encoding', ctx.encoding);
  const stream = ctx.body.pipe(encode[ctx.encoding]());
  ctx.body = stream;
  if (ctx.app.debug) console.log('Compressing', ctx.path, compress);
  return null;
};
