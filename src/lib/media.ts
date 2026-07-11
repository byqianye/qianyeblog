import manifest from "../generated/media-manifest.json";

export interface MediaAsset { width: number; height: number; fallback: string; srcset: string; }
const assets = manifest as Record<string, MediaAsset>;
export const getMedia = (source?: string): MediaAsset | undefined => source ? assets[source] : undefined;
