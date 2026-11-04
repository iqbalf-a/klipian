/* Kenapa kita cegukan? — look 2d (B28): a flat FRONT view of the chest, cut open (set kind "chest-section", see set.json). Real shapes (B27.16): the
   diaphragm is TWO domes with the right one higher (the liver sits under it), the windpipe forks into two bronchi, the stomach lies on the person's left
   (the right of the picture), the glottis is the gap between the two vocal cords. Two tones per part: a base and the same shape moved down-right as its
   shade (light from the top left). One world, one camera (plan.ts camAt), so the sting and every beat share the set. */
import React from "react";
import {
  BLACK, BLUSH, CaptionLayer, FONT_BOLD, FONT_MONO, G2, G3, G4, Label, Mascot, Onomatopoeia, PLASTER, Pill, SKIN_A, SKIN_B, StoryVideo, STEAM, TopText, WHITE, YELLOW,
  YELLOW_D, clamp01, easeInOut, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { AIR_BUBBLE, CARD, CHUNKS, FIZZ, HICS, HIK_AT, LABELS, SIGNALS, TWITCH, camAt } from "./plan.ts";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { hook: "CEGUKAN", diafragma: "DI DALAM DADA", saraf: "REFLEKS", hik: "HIK!", pemicu: "PEMICU", akhir: "RINGKASNYA", fakta: "FAKTA" };

/** One part: its shade (the same shape moved down-right) and its base. */
const Part: React.FC<{ d: string; base: string; shade: string; o?: number; sh?: [number, number]; so?: number }> = ({ d, base, shade, o = 1, sh = [12, 14], so = 1 }) => (
  <g>
    <path d={d} fill={shade} opacity={so * o} transform={`translate(${sh[0]} ${sh[1]})`} />
    <path d={d} fill={base} opacity={o} />
  </g>
);
/** A line part (a nerve, a rib, a pipe): the shade stroke under the base stroke. */
const Tube: React.FC<{ d: string; w: number; base: string; shade: string; sh?: [number, number]; cap?: "round" | "butt" }> = ({ d, w, base, shade, sh = [6, 7], cap = "round" }) => (
  <g fill="none" strokeLinecap={cap} strokeLinejoin="round">
    <path d={d} stroke={shade} strokeWidth={w} transform={`translate(${sh[0]} ${sh[1]})`} />
    <path d={d} stroke={base} strokeWidth={w} />
  </g>
);

const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const breath = (clock: number) => 0.5 - 0.5 * Math.cos((2 * Math.PI * clock) / 4);   // 0 at 0 s and at 60 s (15 breaths)

/** How far the diaphragm is pulled down (0 rest, 1 hiccup), the glottis closing (0 open, 1 shut) and the air running down the windpipe (0..1) at time t. */
function reflex(t: number) {
  let d = 0, shut = 0, air = 0;
  for (const h of HICS) {
    const u1 = easeInOut(clamp01((t - h.drop) / 0.25)), u2 = 1 - easeInOut(clamp01((t - (h.shut + h.hold)) / Math.max(0.2, h.rise - (h.shut + h.hold))));
    d = Math.max(d, Math.min(u1, u2));
    shut = Math.max(shut, easeInOut(clamp01((t - h.shut) / 0.1)) * (1 - easeInOut(clamp01((t - h.shut - h.hold) / 0.25))));
    air = Math.max(air, win(t, h.drop + 0.3, h.shut + 0.05, 0.15));
  }
  return { d, shut, air };
}

const DOME_L = (a: number) => `M 170 1290 C 190 ${a + 40} 290 ${a} 360 ${a} C 430 ${a} 500 ${a + 40} 540 1250`;
const DOME_R = (a: number) => `M 540 1250 C 590 ${a + 50} 650 ${a} 720 ${a} C 800 ${a} 890 ${a + 50} 910 1290`;

const World: React.FC<{ clock: number }> = ({ clock }) => {
  const t = clock, br = breath(clock), r = reflex(t);
  const tw = win(t, TWITCH.a, TWITCH.b, 0.15), shake = tw * 7 * Math.sin(t * 58);
  const d = Math.max(r.d, 0.16 * br);                                  // the diaphragm: the breathing and the hiccup
  const aL = 1110 + 78 * d + shake, aR = 1160 + 70 * d - shake;       // the domes' tops (the right dome is higher, the liver is under it)
  const lungK = 1 + 0.035 * d;
  const hi = Math.max(tw, r.d > 0.5 ? 0.9 : 0);                        // the highlight of the diaphragm: it is the thing that moves
  const gap = 15 * (1 - r.shut);
  const bubbleR = 30 + 28 * easeInOut(clamp01((t - AIR_BUBBLE.grow) / (AIR_BUBBLE.full - AIR_BUBBLE.grow))) * (1 - easeInOut(clamp01((t - AIR_BUBBLE.back) / 1.5)));
  const sig = (s: { a: number; b: number; up?: boolean }) => win(t, s.a, s.b, 0.25);
  const dash = (s: { a: number; up?: boolean }) => (s.up ? 1 : -1) * (t - s.a) * 260;
  const nerves = ["M 478 440 C 470 600 500 760 470 900 C 440 1000 420 1060 400 1115", "M 602 440 C 610 600 580 760 610 900 C 650 1000 690 1070 720 1165"];
  const vagus = "M 625 440 C 640 700 600 1000 640 1330";
  return (
    <g>
      {/* the body (it bleeds past the frame) and the cut face */}
      <rect x={-1600} y={-700} width={4280} height={4000} fill={SKIN_A} />
      <rect x={-1600} y={-700} width={4280} height={4000} fill={SKIN_B} opacity={0.12} />
      <Part d="M 90 250 L 990 250 L 990 1760 L 90 1760 Z" base={PLASTER} shade={SKIN_B} sh={[16, 18]} so={0.55} />
      {/* the abdomen under the domes: a plain cavity, the liver (under the right dome, so that dome is higher) and the stomach */}
      <Part d={`M 110 1250 L 970 1250 L 970 1740 L 110 1740 Z`} base={PLASTER} shade={SKIN_B} sh={[0, 0]} so={0.3} />
      <g transform={`translate(0 ${9 * d})`}><Part d="M 185 1300 C 260 1240 450 1275 520 1335 C 545 1430 470 1530 335 1530 C 230 1530 175 1420 185 1300 Z" base={SKIN_B} shade={G2} so={0.5} sh={[10, 12]} /></g>
      {/* the rib cage (dressing): ribs curve out and down from the middle, drawn behind the lungs */}
      {[690, 790, 890, 990, 1090].map((y, i) => (
        <g key={y}>
          <Tube d={`M 520 ${y - 30} C 380 ${y - 40} 230 ${y - 10} 150 ${y + 150 - i * 14}`} w={22} base={G4} shade={G3} />
          <Tube d={`M 560 ${y - 30} C 700 ${y - 40} 850 ${y - 10} 930 ${y + 150 - i * 14}`} w={22} base={G4} shade={G3} />
        </g>
      ))}
      {/* the lungs (the one on the left of the picture is the person's right: bigger; the other has a notch for the heart) */}
      <g transform={`translate(0 800) scale(1 ${lungK}) translate(0 -800)`}>
        <Part d="M 500 830 C 470 760 330 765 270 880 C 215 985 205 1100 240 1160 L 510 1160 Z" base={BLUSH} o={0.55} shade={G3} so={0.6} />
        <Part d="M 585 840 C 640 775 780 780 835 890 C 885 990 885 1110 855 1165 L 585 1165 C 640 1060 560 930 585 840 Z" base={BLUSH} o={0.55} shade={G3} so={0.6} />
      </g>
      {/* the windpipe with its rings, the two bronchi, the gullet */}
      <Tube d="M 585 520 L 585 1335" w={26} base={BLUSH} shade={G3} sh={[5, 6]} cap="butt" />
      <Tube d="M 540 760 L 430 880" w={40} base={G4} shade={G3} />
      <Tube d="M 540 760 L 650 880" w={40} base={G4} shade={G3} />
      <Tube d="M 540 470 L 540 790" w={64} base={G4} shade={G3} sh={[7, 8]} cap="butt" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={512} y={500 + i * 24} width={56} height={5} fill={G3} />)}
      {/* the nerves: the phrenic nerves to the two domes and the vagus down to the stomach, with the yellow signal dashes (current's mark) when they fire */}
      {nerves.map((n, i) => <Tube key={i} d={n} w={8} base={WHITE} shade={G3} sh={[3, 3]} />)}
      <Tube d={vagus} w={8} base={WHITE} shade={G3} sh={[3, 3]} />
      {SIGNALS.map((s, k) => {
        const o = sig(s);
        return o > 0 ? <g key={k} opacity={o} fill="none" strokeLinecap="round">{(s.up ? [vagus] : nerves).map((n, i) => <path key={i} d={n} stroke={YELLOW} strokeWidth={13} strokeDasharray="16 34" strokeDashoffset={dash(s)} />)}
</g> : null;
      })}
      {/* the diaphragm: two domes (a band of muscle with a pale central tendon), thicker line = the muscle */}
      <Tube d={DOME_L(aL)} w={46} base={BLUSH} shade={SKIN_B} sh={[8, 11]} />
      <Tube d={DOME_R(aR)} w={46} base={BLUSH} shade={SKIN_B} sh={[8, 11]} />
      <ellipse cx={360} cy={aL - 4} rx={70} ry={8} fill={WHITE} opacity={0.6} />
      <ellipse cx={720} cy={aR - 4} rx={64} ry={8} fill={WHITE} opacity={0.6} />
      <g fill="none" strokeLinecap="round" opacity={hi}><path d={DOME_L(aL)} stroke={YELLOW} strokeWidth={10} /><path d={DOME_R(aR)} stroke={YELLOW} strokeWidth={10} /></g>
      {/* the stomach, on the person's left (the right of the picture), with the air bubble and the fizz */}
      <Part d="M 640 1335 C 760 1295 880 1345 890 1455 C 895 1555 785 1625 705 1585 C 655 1560 665 1505 695 1475 C 645 1445 615 1375 640 1335 Z" base={BLUSH} o={0.7} shade={SKIN_B} so={0.8} sh={[9, 11]} />
      <ellipse cx={775} cy={1420 + 3 * Math.sin((2 * Math.PI * clock) / 5)} rx={bubbleR} ry={bubbleR * 0.86} fill={STEAM} />
      <ellipse cx={762} cy={1408 + 3 * Math.sin((2 * Math.PI * clock) / 5)} rx={bubbleR * 0.4} ry={bubbleR * 0.3} fill={WHITE} opacity={0.8} />
      {win(t, FIZZ.a, FIZZ.b, 0.4) > 0 && Array.from({ length: 9 }, (_, i) => {
        const ph = ((t * 0.7 + i * 0.37) % 1), x = 700 + ((i * 53) % 150) + 10 * Math.sin(t * 3 + i), y = 1560 - ph * 170;
        return <circle key={i} cx={x} cy={y} r={6 + (i % 3) * 3} fill={WHITE} opacity={win(t, FIZZ.a, FIZZ.b, 0.4) * (1 - ph * 0.6)} />;
      })}
      {CHUNKS.map((a, i) => {
        const u = (t - a) / 1.4;
        if (u < 0 || u > 1) return null;
        const e = easeInOut(u);
        return <circle key={i} cx={585 + 55 * e + 14 * Math.sin(u * 9)} cy={620 + 790 * e} r={17} fill={SKIN_B} opacity={1 - clamp01((u - 0.9) / 0.1)} />;
      })}
      {/* the voice box: a cartilage box with a dark airway, and the two vocal cords whose gap is the glottis */}
      <Part d="M 478 355 L 602 355 L 602 480 L 478 480 Z" base={G4} shade={G3} sh={[8, 9]} />
      <rect x={502} y={378} width={76} height={86} fill={G2} />
      <path d={`M 502 412 L ${540 - gap} 424 L 502 442 Z`} fill={WHITE} />
      <path d={`M 578 412 L ${540 + gap} 424 L 578 442 Z`} fill={WHITE} />
      {/* air running down the windpipe on an inhale: small white chevrons */}
      {r.air > 0 && [0, 1, 2].map((i) => {
        const y = 480 + ((((t * 1.6) + i / 3) % 1) * 300);
        return <path key={i} d={`M 524 ${y} L 540 ${y + 18} L 556 ${y}`} fill="none" stroke={STEAM} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={r.air} />;
      })}
    </g>
  );
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  const c = camAt(clock), sting = beat.kind === "sting", outro = beat.kind === "outro";
  const labels = LABELS.filter((l) => clock >= l.from && clock < l.to + 0.3);
  const tx = `translate(${W / 2} ${H / 2}) scale(${c.z}) translate(${-c.x} ${-c.y})`;
  const key = beat.id;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <g transform={tx}>
        <World clock={clock} />
        {labels.map((l) => <g key={l.text} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={l.x} y={l.y} fs={l.fs} t={clock} start={l.from} /></g>)}
        {HIK_AT.map((a) => clock >= a && clock < a + 1.6 && <Onomatopoeia key={a} text="HIK!" x={a < 30 ? 760 : 790} y={a < 30 ? 330 : 300} fs={104} rot={-8} t={clock} start={a} />)}
      </g>
      {/* the 35 ms card: screen space, between the picture and the caption */}
      {clock >= CARD.a && clock < CARD.out + 0.3 && (() => {
        const p = springAt(clock, CARD.a) * (1 - clamp01((clock - CARD.out) / 0.3)), n = Math.round(35 * easeInOut(clamp01((clock - CARD.count) / 1.0)));
        return <g transform={`translate(540 1330) scale(${Math.max(0, p)})`}>
          <rect x={-250} y={-92} width={500} height={184} rx={36} fill={WHITE} />
          <text x={-218} y={-48} fontSize={26} fill={YELLOW_D} letterSpacing={3} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>GERAK LAMBAT</text>
          <text x={-218} y={62} fontSize={108} fill={BLACK} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>{n}</text>
          <text x={-218 + 60 + String(n).length * 62} y={62} fontSize={54} fill={BLACK} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>milidetik</text>
        </g>;
      })()}
      {sting && <g>
        <g transform={`translate(540 720) scale(${Math.max(0, springAt(t, 0))}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={clock} squash={0.18 * (1 - springAt(t, 0))} /></g>
        <Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} />
      </g>}
      {!sting && !outro && <TopText key={key} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {!sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
