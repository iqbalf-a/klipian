import type { SetKind } from "../src/sets.ts";
export function loadSetOwners(videosDir: string): { owners: Record<string, string[]>; kinds: SetKind[]; problems: string[] };
