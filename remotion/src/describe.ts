/* A zod schema described as compact text, so the brief can show the AI the exact shape of the story without anybody copying the rules:
   the description is read off the schema itself. Pure (no DOM, no React): node runs it. */
import type { ZodTypeAny } from "zod";

type Def = { typeName: string; [k: string]: any };
const defOf = (t: ZodTypeAny): Def => (t as any)._def;

export const isOptional = (t: ZodTypeAny): boolean => defOf(t).typeName === "ZodOptional";

/** One field's type as short text: "number 0.1..4", '"outside" | "cutaway"', "string (max 120)", "[number, number]", "array of ... (2..6)". */
export function describe(t: ZodTypeAny, refs?: Map<ZodTypeAny, string>): string {
  if (refs?.has(t)) return refs.get(t)!;
  const d = defOf(t);
  switch (d.typeName) {
    case "ZodOptional": return describe(d.innerType, refs);
    case "ZodEffects": return describe(d.schema, refs);
    case "ZodNumber": {
      const min = d.checks.find((c: any) => c.kind === "min")?.value, max = d.checks.find((c: any) => c.kind === "max")?.value;
      return `number${min !== undefined || max !== undefined ? ` ${min ?? ""}..${max ?? ""}` : ""}`;
    }
    case "ZodString": {
      const max = d.checks.find((c: any) => c.kind === "max")?.value;
      if (d.checks.some((c: any) => c.kind === "url")) return "url string";
      const re = d.checks.find((c: any) => c.kind === "regex")?.regex;
      return `string${re ? ` /${re.source}/` : ""}${max ? ` (max ${max})` : ""}`;
    }
    case "ZodBoolean": return "boolean";
    case "ZodLiteral": return JSON.stringify(d.value);
    case "ZodEnum": return (d.values as string[]).map((v) => JSON.stringify(v)).join(" | ");
    case "ZodTuple": return `[${(d.items as ZodTypeAny[]).map((x) => describe(x, refs)).join(", ")}]`;
    case "ZodArray": {
      const lo = d.minLength?.value, hi = d.maxLength?.value;
      return `array of ${describe(d.type, refs)}${lo !== undefined || hi !== undefined ? ` (${lo ?? 0}..${hi ?? ""})` : ""}`;
    }
    case "ZodObject": return "{" + Object.entries(d.shape()).map(([k, v]) => `${k}${isOptional(v as ZodTypeAny) ? "?" : ""}: ${describe(v as ZodTypeAny, refs)}`).join(", ") + "}";
    case "ZodDiscriminatedUnion": return (d.options as ZodTypeAny[]).map((x) => describe(x, refs)).join(" | ");
    default: return d.typeName.replace(/^Zod/, "").toLowerCase();
  }
}

/** The fields of an object schema (looking through refinements) as { name: "type", "name?": "type" }. */
export function fieldsOf(t: ZodTypeAny, refs?: Map<ZodTypeAny, string>): Record<string, string> {
  let d = defOf(t);
  while (d.typeName === "ZodEffects") d = defOf(d.schema);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.shape() as Record<string, ZodTypeAny>)) out[isOptional(v) ? `${k}?` : k] = describe(v, refs);
  return out;
}

/** The item types of a discriminated union, by their `type` literal. */
export function unionFields(t: ZodTypeAny, refs?: Map<ZodTypeAny, string>): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const option of defOf(t).options as ZodTypeAny[]) {
    const fields = fieldsOf(option, refs), tag = JSON.parse(fields.type);
    delete fields.type;
    out[tag] = fields;
  }
  return out;
}
