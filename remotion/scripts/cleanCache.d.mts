export const CACHE_DIR: string;
export function touchBundle(dir: string): void;
export function pruneBundles(cacheDir?: string, keep?: number): { removed: string[]; kept: string[] };
