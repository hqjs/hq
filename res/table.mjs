import { WATCH_EXTENSIONS, getResType, isSource } from '../utils.mjs';
import BuildRecord from './build-record.mjs';
import chokidar from 'chokidar';
import compressible from 'compressible';
import mime from 'mime-types';
import path from 'path';

const DOT_FILES = /(^|[/\\])\../;

export default class Table extends Map {
  touch(srcPath) {
    const current = this.get(srcPath);
    if (current !== undefined) {
      current.build.clear();
      current.version++;
      this.set(srcPath, current);
      return current;
    } else {
      const ext = path.extname(srcPath).toLocaleLowerCase();
      const dirname = path.dirname(srcPath);
      const type = mime.lookup(getResType(ext));
      const compress = compressible(type);
      const isSrc = isSource(ext);
      const value = {
        build: new BuildRecord,
        compress,
        dirname,
        ext,
        isSrc,
        push: null,
        type,
        // use real etag instead
        version: 0,
      };
      this.set(srcPath, value);
      return value;
    }
  }

  watch(srcPaths) {
    // TODO: trigger livereload
    // TODO: try to rebuild on change
    const pattern = srcPaths.map(srcPath => `${path.resolve(srcPath)}/**/*.(${WATCH_EXTENSIONS.join('|')})`);
    const watcher = chokidar.watch(pattern, { ignored: DOT_FILES });
    watcher
      .on('add', async srcPath => {
        this.touch(srcPath);
      })
      .on('change', srcPath => {
        this.touch(srcPath);
      })
      .on('unlink', async srcPath => {
        this.delete(srcPath);
      });
    return this;
  }
}
