const SUPPORT = {
  desktop: {
    Chrome: [ 61, 0 ],
    Edge: [ 16, 0 ],
    Firefox: [ 60, 0 ],
    Opera: [ 48, 0 ],
    Safari: [ 10, 1 ],
  },
  mobile: {
    Chrome: [ 66, 0 ],
    Firefox: [ 60, 0 ],
    Safari: [ 10, 3 ],
  },
};

const compareVersions = (major, minor, supportMajor, supportMinor) =>
  major === 'TP' || major > supportMajor ?
    true :
    major === supportMajor && minor >= supportMinor;

export default () => (ctx, next) => {
  if (ctx.store.support === undefined) {
    const { name, target, major, minor } = ctx.store.ua;
    const [ supportMajor, supportMinor ] = SUPPORT[target][name];
    ctx.store.support = compareVersions(major, minor, supportMajor, supportMinor);
    if (ctx.app.debug) console.log('Check support', ctx.path, ctx.store.support);
  }
  if (!ctx.store.support) {
    ctx.body = 'For development please use browser that supports script type="module"';
    return null;
  } else return next();
};
