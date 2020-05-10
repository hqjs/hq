export default () => (ctx, next) => {
  ctx.stats = ctx.app.table.get(ctx.srcPath) || ctx.app.table.touch(ctx.srcPath);
  if (ctx.app.verbose) {
    console.log(`ℹ️   STATS      ${ctx.path}: ${ctx.stats.type} ${ctx.stats.isSrc ? 'source' : 'asset'}`);
  }
  return next();
};
