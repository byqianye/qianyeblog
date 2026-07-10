/** Returns the locally generated WebP variant for supported raster assets. */
export function getWebpPath(source: string) {
  return /\.(?:png|jpe?g)$/i.test(source) ? source.replace(/\.(?:png|jpe?g)$/i, ".webp") : undefined;
}

/** Builds a density-aware source list for the generated local WebP variants. */
export function getWebpSrcSet(source: string, originalWidth: number) {
  const webp = getWebpPath(source);
  if (!webp) return undefined;
  const base = webp.replace(/\.webp$/i, "");
  const widths = [640, 960].filter((width) => width < originalWidth);
  return [...widths.map((width) => `${base}-${width}.webp ${width}w`), `${webp} ${originalWidth}w`].join(", ");
}
