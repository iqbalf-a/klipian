/* Kocokan kartu remi — look 2d (B28): a flat FRONT view of a card table (set kind "card-table", see set.json). Real shapes (B27.16, checked in the sources of the
   story): a standard deck is 52 cards, 4 suits of 13 (the tiles); a riffle shuffle CUTS the deck in two halves and INTERLEAVES them (Wikipedia, Shuffling), so the pile
   is drawn as cards each offset down-right (its ledges show), one half tinted blue and the other red: after a riffle the colours alternate, after seven they are
   mixed. The pile has 26 cards, half of the real deck, to keep the picture readable. Two tones per part (a base and a shade moved down-right, light from the top
   left); every colour is a token or a mix of tokens. One world, one camera (plan.ts camAt), so the sting and every beat share the set. */
import React from "react";
import {
  loopClock, BLACK, BLUSH, CaptionLayer, COFFEE, FONT_BOLD, FONT_MONO, G1, G2, G3, G4, Label, Mascot, Onomatopoeia, Pill, SKIN_A, SKIN_B, SourceChip, StoryVideo, STEAM,
  THEMES, TopText, rgb as fromRgb, WHITE, YELLOW, YELLOW_D, clamp01, easeInOut, easeOut, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import {
  BOARD, BOARD_T, CUTS, DOTS_FROM, DROPS, EXP, FAKTA, HASIL, HOOK_Q, LABELS, M, MANT, ORDERS, RESET, SHUF, SLOTS, TILES, TILES_OUT, TIPS, camAt, dotLit,
} from "./plan.ts";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { hook: "KARTU REMI", deck: "ISI SATU DEK", pilih: "URUTANNYA", angka: "HITUNGANNYA", acak: "RIFFLE", hasil: "PELUANG", fakta: "KESIMPULAN", tips: "TIPS" };
const bold: React.CSSProperties = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 };
const mono: React.CSSProperties = { fontFamily: `"${FONT_MONO}", monospace` };

// ---- colours: tokens, or mixes of tokens
const nums = (c: string) => (c.match(/\d+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
const mix = (a: string, b: string, k: number) => { const x = nums(a), y = nums(b); return fromRgb([0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * k)) as [number, number, number]); };
const WALLC = THEMES.mint.wall, WAIN = THEMES.mint.floor, WAIN_SH = THEMES.mint.floorEdge;
const FELT = mix(THEMES.mint.floorEdge, G1, 0.5), FELT_SH = mix(FELT, BLACK, 0.3), FELT_L = mix(FELT, YELLOW, 0.14);
const WOOD = mix(SKIN_B, COFFEE, 0.4), WOOD_D = mix(SKIN_B, COFFEE, 0.8), WOOD_L = mix(WOOD, WHITE, 0.22);
const BACK_A = mix(STEAM, G2, 0.4), BACK_B = mix(BLUSH, G2, 0.25);
const SUIT_RED = BLUSH;

const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));

// ---------------------------------------------------------------------------------------------------------------- the pile of cards
const CW = 440, CH = 616, STEP = 3, X0 = 320, Y0 = 800;
const slot = (m: number) => ({ x: X0 + (M - 1 - m) * STEP, y: Y0 + (M - 1 - m) * STEP });
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

type CardPos = { id: number; z: number; x: number; y: number };
/** The pile at time t: every card's position, in drawing order (bottom to top). A riffle is three moves: the halves move apart, the cards drop one by one into
    the merged pile (the lowest first), and the pile settles. */
function pileAt(t: number): CardPos[] {
  const live = t < RESET;
  const done = live ? SHUF.filter((s) => t >= s.a + s.d).length : 0;
  const act = live ? SHUF.findIndex((s) => t >= s.a && t < s.a + s.d) : -1;
  if (act < 0) return ORDERS[done].map((id, m) => ({ id, z: m, ...slot(m) }));
  const s = SHUF[act], prev = ORDERS[act], next = ORDERS[act + 1], cut = CUTS[act], u = (t - s.a) / s.d;
  const out: CardPos[] = next.map((id, m) => {
    const pi = prev.indexOf(id), half = pi < cut ? 0 : 1, sz = half === 0 ? cut : M - cut, j = half === 0 ? pi : pi - cut;
    const from = slot(pi), side = { x: X0 + (half === 0 ? -225 : 225) + (sz - 1 - j) * STEP, y: Y0 + (half === 0 ? 34 : -22) + (sz - 1 - j) * STEP }, to = slot(m);
    if (u < 0.3) { const p = easeInOut(clamp01(u / 0.3)); return { id, z: m, x: lerp(from.x, side.x, p), y: lerp(from.y, side.y, p) }; }
    const st = 0.3 + 0.4 * (m / (M - 1)), e = easeInOut(clamp01((u - st) / 0.2));
    return { id, z: m, x: lerp(side.x, to.x, e), y: lerp(side.y, to.y, e) - 46 * Math.sin(Math.PI * e) };
  });
  return out;
}

const Card: React.FC<{ id: number; x: number; y: number; top?: boolean }> = ({ id, x, y, top }) => {
  const c = id < 13 ? BACK_A : BACK_B, inner = mix(c, WHITE, 0.32), lat = mix(c, WHITE, 0.62);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={CW} height={CH} rx={30} fill={c} />
      <rect x={22} y={22} width={CW - 44} height={CH - 44} rx={18} fill={inner} />
      {top && (
        <g>
          <clipPath id="card-inner"><rect x={22} y={22} width={CW - 44} height={CH - 44} rx={18} /></clipPath>
          <g clipPath="url(#card-inner)" stroke={lat} strokeWidth={5}>
            {Array.from({ length: 26 }, (_, i) => <path key={i} d={`M ${-300 + i * 36} 0 L ${-300 + i * 36 + CH} ${CH}`} />)}
            {Array.from({ length: 26 }, (_, i) => <path key={i} d={`M ${i * 36} 0 L ${i * 36 - CH} ${CH}`} />)}
          </g>
          <path d={`M ${CW / 2} ${CH / 2 - 78} L ${CW / 2 + 54} ${CH / 2} L ${CW / 2} ${CH / 2 + 78} L ${CW / 2 - 54} ${CH / 2} Z`} fill={WHITE} opacity={0.9} />
          <path d={`M ${CW / 2} ${CH / 2 - 46} L ${CW / 2 + 32} ${CH / 2} L ${CW / 2} ${CH / 2 + 46} L ${CW / 2 - 32} ${CH / 2} Z`} fill={c} />
        </g>
      )}
    </g>
  );
};

const Suit: React.FC<{ k: "heart" | "diamond" | "spade" | "club"; s?: number }> = ({ k, s = 1 }) => {
  const red = k === "heart" || k === "diamond", fill = red ? SUIT_RED : BLACK;
  return (
    <g transform={`scale(${s})`} fill={fill}>
      {k === "heart" && <path d="M 0 52 C -78 -2 -52 -58 0 -24 C 52 -58 78 -2 0 52 Z" />}
      {k === "diamond" && <path d="M 0 -60 L 44 0 L 0 60 L -44 0 Z" />}
      {k === "spade" && <g><path d="M 0 -56 C -80 8 -50 56 0 24 C 50 56 80 8 0 -56 Z" /><path d="M 0 18 L -18 62 L 18 62 Z" /></g>}
      {k === "club" && <g><circle cx={0} cy={-26} r={26} /><circle cx={-30} cy={14} r={26} /><circle cx={30} cy={14} r={26} /><path d="M 0 8 L -16 62 L 16 62 Z" /></g>}
    </g>
  );
};
const SUITS = ["spade", "heart", "diamond", "club"] as const;

/** A strip of 52 small cells (a deck order), filled from the left after `start`. */
const lcg = (seed: number) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const PALETTE = [STEAM, BLUSH, G2, SKIN_A];
const STRIP_A = (() => { const r = lcg(5); return Array.from({ length: 52 }, () => PALETTE[Math.floor(r() * 4)]); })();
const STRIP_B = (() => { const r = lcg(91); return Array.from({ length: 52 }, () => PALETTE[Math.floor(r() * 4)]); })();
const Strip: React.FC<{ cells: string[]; y: number; t: number; start: number }> = ({ cells, y, t, start }) => (
  <g>
    <rect x={168} y={y - 8} width={744} height={76} rx={16} fill={mix(WALLC, BLACK, 0.12)} />
    {cells.map((c, i) => { const o = clamp01((t - start - i * 0.016) / 0.15); return o > 0 ? <rect key={i} x={176 + i * 14} y={y} width={12} height={60} rx={3} fill={c} opacity={o} /> : null; })}
  </g>
);

/** How many cards are still in the stock row on the table while the slots fill (52 at first, one fewer after each drop, the ellipsis sweeps down to 2). */
const stockAt = (t: number) => {
  if (t < DROPS[0].t) return 52;
  if (t < DROPS[1].t) return 51;
  if (t < DROPS[2].t) return 50;
  if (t < DROPS[3].t) return 49;
  if (t < DROPS[4].t) return Math.round(lerp(49, 2, easeInOut(clamp01((t - DROPS[3].t) / 0.8))));
  if (t < DROPS[5].t) return 1;
  return 0;
};

// ---------------------------------------------------------------------------------------------------------------- the world
const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const t = clock;
  const bob = 3 * Math.sin((2 * Math.PI * amb) / 4);                           // the deck breathes: 15 bobs in 60 s, so the loop matches
  const sway = 2.2 * Math.sin((2 * Math.PI * amb) / 6), leaf = (k: number) => 6 * Math.sin((2 * Math.PI * amb) / 5 + k * 1.7);
  const pile = pileAt(t), topId = pile[pile.length - 1]?.id;
  const reset = t >= RESET ? springAt(t, RESET) : 1;
  const e = Math.round(EXP * easeOut(clamp01((t - BOARD_T.expA) / (BOARD_T.expB - BOARD_T.expA))));
  const mant = MANT * easeOut(clamp01((t - BOARD_T.mant) / 1.0));
  const boardO = win(t, BOARD_T.pop - 0.4, 26.4, 0.4);
  const glow = win(t, FAKTA.glow, FAKTA.end, 0.5);
  const recess = win(t, 10.2, 25.6, 0.4);
  const tiles = TILES.map((a) => springAt(t, a)).map((p, i) => p * (1 - clamp01((t - (TILES_OUT + i * 0.1)) / 0.25)));
  const dots = win(t, DOTS_FROM, 34.6, 0.4);
  const hasil = win(t, HASIL.stripA - 0.3, 41.2, 0.4);
  return (
    <g>
      {/* the wall and its panelled lower band: both bleed past the frame */}
      <rect x={-1600} y={-1400} width={5400} height={2600} fill={WALLC} />
      <rect x={-1600} y={780} width={5400} height={430} fill={WAIN} />
      {Array.from({ length: 24 }, (_, i) => <rect key={i} x={-1000 + i * 260} y={812} width={8} height={380} fill={WAIN_SH} />)}
      <rect x={-1600} y={770} width={5400} height={22} fill={mix(G4, WOOD, 0.35)} />
      <rect x={-1600} y={792} width={5400} height={8} fill={mix(G4, WOOD, 0.35)} opacity={0.5} transform="translate(0 4)" />
      {/* pictures on the panelled wall (on the table's right, where the slots are) and a wall clock far right */}
      {[[1290, 0], [1560, 1], [1830, 2]].map(([x, k]) => (
        <g key={x} transform={`translate(${x} 840)`}>
          <rect width={230} height={290} fill={WOOD_D} /><rect x={16} y={16} width={198} height={258} fill={WHITE} />
          <rect x={16} y={16} width={198} height={258} fill={mix(WHITE, SKIN_A, 0.25)} opacity={0.5} />
          <g transform="translate(115 150)"><Suit k={SUITS[k + 1]} s={1.5} /></g>
        </g>
      ))}
      <circle cx={1990} cy={560} r={96} fill={WOOD_D} /><circle cx={1986} cy={556} r={84} fill={WHITE} />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={1986 - 3} y={556 - 76} width={6} height={i % 3 === 0 ? 20 : 11} fill={G2} transform={`rotate(${i * 30} 1986 556)`} />)}
      <rect x={1986 - 4} y={556 - 50} width={8} height={54} rx={4} fill={BLACK} transform={`rotate(${(t * 0.1) % 360 + 40} 1986 556)`} />
      <rect x={1986 - 2} y={556 - 70} width={4} height={74} rx={2} fill={YELLOW_D} transform={`rotate(${(t * 6) % 360} 1986 556)`} />
      <circle cx={1986} cy={556} r={9} fill={BLACK} />
      {/* the pendant lamp over the table's left: a cone of light with a few motes in it */}
      <polygon points="40,880 260,880 560,1500 -260,1500" fill={YELLOW} opacity={0.075} />
      {Array.from({ length: 7 }, (_, i) => {
        const ph = (amb * 0.05 + i * 0.143) % 1, x = 150 + (i - 3) * 62 * (0.4 + ph) + 10 * Math.sin(amb * 1.361 + i), y = 900 + ph * 540;
        return <circle key={i} cx={x} cy={y} r={4 + (i % 3)} fill={YELLOW} opacity={0.5 * Math.sin(Math.PI * ph)} />;
      })}
      <rect x={-1600} y={694} width={1756} height={14} fill={WOOD} /><rect x={-1600} y={694} width={1756} height={5} fill={WOOD_L} />
      <g transform={`rotate(${sway} 150 700)`}>
        <rect x={147} y={700} width={6} height={90} fill={G1} />
        <path d="M 70 880 L 230 880 L 290 790 L 10 790 Z" fill={YELLOW_D} />
        <path d="M 70 880 L 230 880 L 238 868 L 62 868 Z" fill={mix(YELLOW_D, BLACK, 0.3)} />
        <ellipse cx={150} cy={886} rx={52} ry={9} fill={YELLOW} opacity={0.9} />
      </g>
      {/* a plant on a shelf, on the right of the deck */}
      <rect x={880} y={868} width={260} height={18} fill={WOOD} /><rect x={880} y={868} width={260} height={6} fill={WOOD_L} />
      <path d="M 945 788 L 1055 788 L 1038 868 L 962 868 Z" fill={SKIN_B} /><path d="M 1038 788 L 1055 788 L 1038 868 L 1022 868 Z" fill={mix(SKIN_B, BLACK, 0.2)} />
      {[-1, 0, 1].map((k) => <ellipse key={k} cx={1000 + k * 30} cy={730} rx={22} ry={72} fill={mix(THEMES.mint.floorEdge, G1, k === 0 ? 0.25 : 0.4)} transform={`rotate(${k * 22 + leaf(k)} ${1000 + k * 14} 788)`} />)}
      {/* the wall board: a dark panel in a wooden frame, its content shows only while the number is told */}
      <g transform="translate(0 -420)">
      <rect x={124} y={-316} width={832} height={448} rx={14} fill={WOOD_D} />
      <rect x={140} y={-300} width={800} height={420} rx={8} fill={G1} />
      <rect x={140} y={-300} width={800} height={14} fill={mix(G1, WHITE, 0.08)} />
      <g opacity={boardO}>
        <text x={540} y={-232} fontSize={32} fill={YELLOW} textAnchor="middle" letterSpacing={3} style={mono}>SUSUNAN KARTU YANG MUNGKIN</text>
        <text x={540} y={-184} fontSize={30} fill={G3} textAnchor="middle" style={mono}>52 × 51 × 50 × … × 1 = 52!</text>
        <text x={170} y={-26} fontSize={150} fill={WHITE} textAnchor="start" style={bold}>{mant.toFixed(2).replace(".", ",")}</text>
        <text x={486} y={-30} fontSize={100} fill={WHITE} style={bold}>× 10</text>
        <text x={704} y={-82} fontSize={84} fill={YELLOW} style={bold}>{e}</text>
        {Array.from({ length: EXP }, (_, k) => <rect key={k} x={192 + k * 10.4} y={44} width={8} height={30} rx={2} fill={k < e ? YELLOW : mix(G1, G2, 0.5)} />)}
        <text x={540} y={110} fontSize={24} fill={G3} textAnchor="middle" style={mono}>satu kotak = satu pangkat sepuluh</text>
      </g>
      </g>
      {/* the table: felt with a lighter pool under the lamp, a wooden edge and the apron, all bleeding past the frame */}
      <rect x={-1600} y={1200} width={5400} height={600} fill={FELT} />
      <rect x={-1600} y={1200} width={5400} height={16} fill={FELT_SH} />
      <ellipse cx={130} cy={1500} rx={560} ry={170} fill={FELT_L} opacity={0.55} />
      <rect x={-1600} y={1800} width={5400} height={74} fill={WOOD} /><rect x={-1600} y={1800} width={5400} height={14} fill={WOOD_L} />
      <rect x={-1600} y={1874} width={5400} height={900} fill={WOOD_D} />
      {/* a pool of light behind the deck when the conclusion lands */}
      <ellipse cx={540} cy={1190} rx={470} ry={450} fill={YELLOW} opacity={0.2 * glow} />
      {/* two stacks of chips, real size: one cut by the frame on each side */}
      {[[100, 1500], [990, 1470]].map(([cx, base], k) => (
        <g key={k}>
          <rect x={cx - 118} y={base - 6} width={252} height={16} rx={8} fill={FELT_SH} />
          {Array.from({ length: 7 - k }, (_, i) => {
            const c = [YELLOW, WHITE, STEAM, G2][(i + k * 2) % 4];
            return <g key={i}><rect x={cx - 125 + 6} y={base - (i + 1) * 28 + 6} width={250} height={28} rx={14} fill={mix(c, BLACK, 0.28)} /><rect x={cx - 125} y={base - (i + 1) * 28} width={250} height={28} rx={14} fill={c} /></g>;
          })}
        </g>
      ))}
      {/* the pile's shadow on the felt, then the pile (26 cards) */}
      <g transform={`translate(0 ${bob})`}>
        <g transform={`translate(540 1491) scale(${reset}) translate(-540 -1491)`}>
          <rect x={X0 + 18} y={1470} width={CW + 70} height={44} rx={20} fill={FELT_SH} />
          {pile.map((c) => <Card key={c.id} id={c.id} x={c.x} y={c.y} top={c.id === topId} />)}
        </g>
      </g>
      {/* deck: four suit tiles in front of the deck, then the sum */}
      {SUITS.map((k, i) => tiles[i] > 0.01 && (
        <g key={k} transform={`translate(${315 + i * 150} 1600) scale(${tiles[i]})`}>
          <rect x={-62} y={-60} width={140} height={140} rx={26} fill={mix(WHITE, G2, 0.32)} />
          <rect x={-70} y={-70} width={140} height={140} rx={26} fill={WHITE} />
          <g transform="translate(0 -14)"><Suit k={k} s={0.7} /></g>
          <text x={0} y={52} fontSize={32} fill={G2} textAnchor="middle" style={mono}>×13</text>
        </g>
      ))}
      {/* acak: seven dots, one lights as each riffle ends */}
      {dots > 0.01 && Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx={540 + (i - 3) * 76} cy={1610} r={22} fill={t >= dotLit(i) ? YELLOW : mix(FELT, WHITE, 0.2)} opacity={dots} transform={`translate(0 ${t >= dotLit(i) && t < dotLit(i) + 0.3 ? -10 * Math.sin(Math.PI * ((t - dotLit(i)) / 0.3)) : 0})`} />
      ))}
      {/* pilih: six slots on the felt to the right, a card drops into each with the number of choices left */}
      {recess > 0.01 && Array.from({ length: 6 }, (_, i) => {
        const cx = SLOTS.x - 375 + i * 150, cy = 1330, d = DROPS[i], u = clamp01((t - d.t) / 0.4), land = (t - d.t) / 0.4;
        const y = d.t > t ? -300 : -(1 - easeOut(u)) * 320 - (land > 1 && land < 1.5 ? 6 * Math.sin(Math.PI * (land - 1) * 2) : 0);
        return (
          <g key={i} opacity={recess}>
            <rect x={cx - 66} y={cy - 90} width={132} height={180} rx={18} fill={FELT_SH} />
            {t >= d.t && (
              <g transform={`translate(${cx} ${cy + y})`} opacity={clamp01(u * 3)}>
                <rect x={-54} y={-72} width={120} height={168} rx={14} fill={mix(WHITE, G2, 0.3)} />
                <rect x={-60} y={-84} width={120} height={168} rx={14} fill={WHITE} />
                {d.n === "…" ? [-24, 0, 24].map((dx) => <circle key={dx} cx={dx} cy={0} r={8} fill={BLACK} />) : <text x={0} y={22} fontSize={d.n.length > 1 ? 66 : 84} fill={BLACK} textAnchor="middle" style={bold}>{d.n}</text>}
              </g>
            )}
          </g>
        );
      })}
      {recess > 0.01 && Array.from({ length: 52 }, (_, i) => i < stockAt(t) && (
        <g key={i} opacity={recess}><rect x={1228 + (i % 26) * 28 + 3} y={1490 + Math.floor(i / 26) * 46 + 4} width={24} height={38} rx={5} fill={mix(i % 2 ? BACK_A : BACK_B, BLACK, 0.3)} /><rect x={1228 + (i % 26) * 28} y={1490 + Math.floor(i / 26) * 46} width={24} height={38} rx={5} fill={i % 2 ? BACK_A : BACK_B} /></g>
      ))}
      {/* hasil: two strips of 52 cells, two different orders, and the not-equal sign */}
      {hasil > 0.01 && (
        <g opacity={hasil}>
          <Strip cells={STRIP_A} y={540} t={t} start={HASIL.stripA} />
          <Strip cells={STRIP_B} y={700} t={t} start={HASIL.stripB} />
          <g transform={`translate(540 650) scale(${0.62 * springAt(t, HASIL.neq)})`}>
            <rect x={-38} y={-34} width={76} height={12} rx={6} fill={BLACK} /><rect x={-38} y={22} width={76} height={12} rx={6} fill={BLACK} />
            <rect x={-6} y={-64} width={12} height={128} rx={6} fill={BLACK} transform="rotate(24)" />
          </g>
        </g>
      )}
    </g>
  );
};

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0));   // B29: the ambient motion runs on the loop clock
  const c = camAt(clock), sting = beat.kind === "sting", outro = beat.kind === "outro";
  const labels = LABELS.filter((l) => clock >= l.from && clock < l.to + 0.3);
  const tx = `translate(${W / 2} ${H / 2}) scale(${c.z}) translate(${-c.x} ${-c.y})`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <g transform={tx}>
        <World clock={clock} amb={amb} />
        {labels.map((l) => <g key={l.text} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={l.x} y={l.y} fs={l.fs} t={clock} start={l.from} onDark={l.y >= 700} align={l.start ? "start" : "middle"} /></g>)}
        {clock >= HOOK_Q && clock < HOOK_Q + 1.5 && <Onomatopoeia text="?" x={880} y={820} fs={120} rot={8} t={clock} start={HOOK_Q} />}
        {clock >= BOARD_T.stamp && clock < BOARD_T.stamp + 1.7 && <Onomatopoeia text="52!" x={BOARD.x + 350} y={BOARD.y - 250} fs={92} rot={-8} t={clock} start={BOARD_T.stamp} />}
        {clock >= FAKTA.baru && clock < FAKTA.end + 0.3 && <g opacity={1 - clamp01((clock - FAKTA.end) / 0.3)}><Onomatopoeia text="BARU!" x={770} y={900} fs={84} rot={-8} t={clock} start={FAKTA.baru} /></g>}
      </g>
      {/* hasil: the source chip, screen space above the caption */}
      {clock >= HASIL.chipA && clock < HASIL.chipB + 0.3 && <SourceChip x={110} y={1360} text="Wikipedia: Shuffling" t={clock} start={HASIL.chipA} end={HASIL.chipB} />}
      {/* tips: two cards in screen space, under the deck and over the caption's zone */}
      {TIPS.map((tp, i) => {
        if (clock < tp.a || clock >= tp.b + 0.3) return null;
        const p = springAt(clock, tp.a) * (1 - clamp01((clock - tp.b) / 0.3)), x = i === 0 ? 290 : 790;
        const lines = i === 0 ? ["Kocok sekitar", "tujuh kali"] : ["Kurang dari lima:", "belum acak"];
        return (
          <g key={i} transform={`translate(${x} 1365) scale(${Math.max(0, p)})`}>
            <rect x={-232} y={-70} width={480} height={150} rx={34} fill={mix(WHITE, G2, 0.25)} />
            <rect x={-240} y={-80} width={480} height={150} rx={34} fill={WHITE} />
            <circle cx={-186} cy={-5} r={32} fill={YELLOW} /><text x={-186} y={9} fontSize={40} fill={BLACK} textAnchor="middle" style={bold}>{i + 1}</text>
            {lines.map((s, k) => <text key={k} x={-136} y={-14 + k * 50} fontSize={40} fill={BLACK} style={bold}>{s}</text>)}
          </g>
        );
      })}
      {sting && <g>
        <g transform={`translate(540 720) scale(${Math.max(0, springAt(t, 0))}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={clock} squash={0.18 * (1 - springAt(t, 0))} /></g>
        <Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} />
      </g>}
      {!sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {!sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
