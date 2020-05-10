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
      const { category, name, version } = ctx.app.build ?
        {
          category: uaString.split('/')[0],
          name: 'hq',
          version: uaString.split('/')[1],
        } :
        woothee.parse(uaString);
      const target = category === 'module' ?
        'module' :
        category === 'nomodule' ?
          'nomodule' :
          category === 'pc' ?
            'desktop' :
            'mobile';
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
      ctx.store.baseURI = ctx.request.origin;
      uaMap.set(uaString, ctx.store);
      if (ctx.app.verbose) console.log(`🌐  USER AGENT ${name} ${ver} for ${target}`);
    }
  }
  return next();
};
