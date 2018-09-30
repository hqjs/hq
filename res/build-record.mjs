export default class BuildRecord extends Map {
  set({ name, target, ver }, value) {
    const key = BuildRecord.getKey(target, name, ver);
    return super.set(key, value);
  }

  get({ name, target, ver }) {
    const key = BuildRecord.getKey(target, name, ver);
    return super.get(key);
  }

  delete({ name, target, ver }) {
    const key = BuildRecord.getKey(target, name, ver);
    return super.delete(key);
  }

  isDirty({ name, target, ver }) {
    const key = BuildRecord.getKey(target, name, ver);
    return !super.has(key) || super.get(key) == null;
  }

  setDirty({ name, target, ver }) {
    const key = BuildRecord.getKey(target, name, ver);
    return super.set(key, null);
  }

  static getKey(target, name, ver) {
    return `${target}:${name}:${ver}`;
  }
}
