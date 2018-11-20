import { WATCH_EXTENSIONS, getResType, isSource } from '../utils.mjs';
import BuildRecord from './build-record.mjs';
import chokidar from 'chokidar';
import compressible from 'compressible';
import mime from 'mime-types';
import path from 'path';

const DOT_FILES = /(^|[/\\])\../;

export default class Table extends Map {
  constructor(reload) {
    super();
    this.reload = reload;
  }

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
        type,
        version: 0,
      };
      this.set(srcPath, value);
      return value;
    }
  }

  watch(srcPaths) {
    const pattern = srcPaths.map(srcPath => `${path.resolve(srcPath)}/**/*.(${WATCH_EXTENSIONS.join('|')})`);
    const watcher = chokidar.watch(pattern, {
      ignoreInitial: true,
      ignored: DOT_FILES,
    });
    watcher
      .on('add', async srcPath => {
        this.touch(srcPath);
        this.reload();
      })
      .on('change', srcPath => {
        this.touch(srcPath);
        this.reload();
      })
      .on('unlink', async srcPath => {
        this.delete(srcPath);
        this.reload();
      });
    return this;
  }
}
