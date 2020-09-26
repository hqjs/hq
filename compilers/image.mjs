import imagemin from 'imagemin';
import { saveContent } from './tools.mjs';

const TRESHOLD = 1024; // 1Kb

/* eslint-disable no-magic-numbers */
export default async (ctx, content) => {
  if (!ctx.app.production || ctx.size < TRESHOLD) return saveContent(content, ctx);
  const plugins = [];
  switch (ctx.stats.ext) {
    case '.gif': {
      const { default: gifcicle } = await import('imagemin-gifsicle');
      plugins.push(gifcicle());
      break;
    }
    case '.jpg':
    case '.jpeg': {
      const { default: mozjpeg } = await import('imagemin-mozjpeg');
      plugins.push(mozjpeg({ quality: 85 }));
      break;
    }
    case '.png': {
      const { default: pngquant } = await import('imagemin-pngquant');
      plugins.push(pngquant({ quality: [ 0.5, 0.85 ] }));
      break;
    }
    case '.svg': {
      const { default: svgo } = await import('imagemin-svgo');
      plugins.push(svgo({
        plugins: [
          { removeViewBox: false },
        ],
      }));
      break;
    }
  }
  const buffer = await imagemin.buffer(content, { plugins });
  return saveContent(buffer, ctx);
};
/* eslint-enable no-magic-numbers */
