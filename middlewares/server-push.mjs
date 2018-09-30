export default () => async (ctx, next) => {
  const { push } = ctx.stats;

  if (push !== null) {
    for (const [ link, { rel, type }] of push) {
      ctx.append('Link', `<${link}>; rel=${rel}${rel === 'preload' ? `; as=${type}` : ''}`);
    }

    if (ctx.app.debug) console.log('server push appended:', ctx.path, push);
  }

  return next();
};
