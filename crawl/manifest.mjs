export default async (content, { queue }) => {
  const manifest = JSON.parse(content);
  if (!Array.isArray(manifest.icons)) return content;
  for (const { src } of manifest.icons) {
    queue.set(src, src);
  }
  return content;
};
