import woothee from 'woothee';

const uaMap = new Map;

export default () => (ctx, next) => {
  ctx.store = ctx.store || {};
  if (ctx.store.ua === undefined) {
    const uaString = ctx.req.headers['user-agent'] || '';
    const store = uaMap.get(uaString);
    if (store) {
      ctx.store = store;
    } else {
      const { category, name, version } = woothee.parse(uaString);
      const target = category === 'pc' ? 'desktop' : 'mobile';
      const [ major, minor ] = version.split('.').map(x => {
        const num = Number(x);
        return Number.isNaN(num) ? x : num;
      });
      const ver = [ major, minor ].join('.');
      ctx.store.ua = {
        major,
        minor,
        name,
        target,
        ver,
        version,
      };
      ctx.store.root = `./.dist/${target}/${name}/${ver}`;
      ctx.store.baseURI = `https://${ctx.request.header[':authority']}`;
      uaMap.set(uaString, ctx.store);
      if (ctx.app.debug) console.log(
        'Detect user agent',
        ctx.path,
        ctx.store.ua,
        ctx.store.root,
        ctx.store.baseURI
      );
    }
  }
  return next();
};
