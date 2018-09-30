export default () => (ctx, next) => {
  ctx.stats = ctx.app.table.get(ctx.srcPath) || ctx.app.table.touch(ctx.srcPath);
  // if (ctx.path === '/index.html') ctx.stats.push = ctx.app.table.push;
  if (ctx.app.debug) console.log('Get resource table', ctx.path, ctx.stats);
  return next();
};
