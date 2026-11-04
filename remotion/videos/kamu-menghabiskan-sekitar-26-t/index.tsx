/* Kamu habiskan sekitar 26 tahun hidup untuk tidur — look text (B28): no objects, kinetic numbers and words in rounded cards like the caption. Counters roll,
   bars grow, cards slide, stack and flip; a slow camera push per beat; the top text (TopText) and the bottom caption (CaptionLayer) are the channel's.
   The times come from plan.ts (CUE), the same numbers the sound (sfx.ts) uses. Every word on a card is the story's own (the beats' texts and narration). */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, FONT_BOLD, FONT_MONO, G2, G3, G4, Mascot, Pill, StoryVideo, TopText, WHITE, YELLOW, YELLOW_D,
  clamp01, easeInOut, easeOut, hover, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { CUE } from "./plan.ts";

export const story = storyJson as unknown as StoryT;

const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const mono = { fontFamily: `"${FONT_MONO}", monospace`, fontWeight: 400 } as const;
const ramp = (t: number, from: number, dur = 0.5) => easeOut(clamp01((t - from) / dur));
const dots = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, ".");

/** A rounded card that pops in (or slides in from a side), then hovers a little all the time. */
const Card: React.FC<{ x: number; y: number; w: number; h: number; t: number; start: number; fill?: string; from?: "left" | "right"; flipY?: number; children: React.ReactNode }> =
  ({ x, y, w, h, t, start, fill = WHITE, from, flipY = 1, children }) => {
    const p = springAt(t, start, true), e = ramp(t, start, 0.55);
    const tx = from ? (from === "left" ? -1 : 1) * 220 * (1 - e) : 0;
    return (
      <g transform={`translate(${x + w / 2 + tx} ${y + h / 2 + hover(t + x * 0.003, 5)}) scale(${(0.92 + 0.08 * p)} ${(0.92 + 0.08 * p) * flipY}) translate(${-w / 2} ${-h / 2})`} opacity={Math.min(1, p * 2.2)}>
        <rect width={w} height={h} rx={36} fill={fill} />
        {children}
      </g>
    );
  };

/** A card that flips over: the front until `at`, the back after it (the card is edge-on in the middle). */
const FlipCard: React.FC<{ x: number; y: number; w: number; h: number; t: number; start: number; at: number; front: (k: number) => React.ReactNode; back: React.ReactNode; backFill?: string }> =
  ({ x, y, w, h, t, start, at, front, back, backFill = YELLOW }) => {
    const k = clamp01((t - at) / 0.6), flipY = Math.max(0.02, Math.abs(Math.cos(k * Math.PI)));
    const isBack = k >= 0.5;
    return <Card x={x} y={y} w={w} h={h} t={t} start={start} fill={isBack ? backFill : WHITE} flipY={flipY}>{isBack ? back : front(k)}</Card>;
  };

/** The 24 hours of a day as 24 cells in two rows; the first `n` fill with `fillFrom` on, one after another. */
const HourGrid: React.FC<{ x: number; y: number; cell: number; gap: number; t: number; start: number; groups: { n: number; start?: number; from: number; step: number; color: string }[] }> =
  ({ x, y, cell, gap, t, start, groups }) => (
    <g>
      {Array.from({ length: 24 }, (_, i) => {
        const cx = x + (i % 12) * (cell + gap), cy = y + Math.floor(i / 12) * (cell + gap), p = ramp(t, start + i * 0.02, 0.4);
        let color = G4, fillP = 0;
        for (const g of groups) if (i >= (g.start ?? 0) && i < g.n) { const q = ramp(t, g.from + (i - (g.start ?? 0)) * g.step, 0.25); if (q > fillP) { fillP = q; color = g.color; } }
        return (
          <g key={i} transform={`translate(${cx + cell / 2} ${cy + cell / 2}) scale(${0.6 + 0.4 * p})`} opacity={p}>
            <rect x={-cell / 2} y={-cell / 2} width={cell} height={cell} rx={cell * 0.28} fill={WHITE} />
            <rect x={-cell / 2} y={-cell / 2} width={cell} height={cell} rx={cell * 0.28} fill={color} opacity={fillP} />
            <text y={cell * 0.17} fontSize={cell * 0.42} fill={BLACK} opacity={0.55 + 0.45 * fillP} textAnchor="middle" style={mono}>{i + 1}</text>
          </g>
        );
      })}
    </g>
  );

const Label: React.FC<{ x: number; y: number; text: string; fs?: number; fill?: string; anchor?: "start" | "middle" | "end"; op?: number }> = ({ x, y, text, fs = 30, fill = G2, anchor = "start", op = 1 }) =>
  <text x={x} y={y} fontSize={fs} fill={fill} textAnchor={anchor} opacity={op} letterSpacing={2} style={mono}>{text}</text>;

// ---------------------------------------------------------------- the beats
const Hook: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.hook, roll = ramp(t, c.roll, c.rollDur);
  return (
    <Card x={150} y={540} w={780} h={800} t={t} start={c.card}>
      <Label x={390} y={96} text="SEPANJANG HIDUP" anchor="middle" op={ramp(t, c.card + 0.2)} />
      <text x={390} y={470} fontSize={430} fill={BLACK} textAnchor="middle" style={bold}>{Math.round(26 * roll)}</text>
      <text x={390} y={575} fontSize={96} fill={YELLOW_D} textAnchor="middle" style={bold}>tahun</text>
      <text x={390} y={690} fontSize={66} fill={BLACK} textAnchor="middle" opacity={ramp(t, c.sub)} style={bold}>habis untuk tidur</text>
      <rect x={130} y={724} width={520 * ramp(t, c.bar, 0.7)} height={16} rx={8} fill={YELLOW} />
    </Card>
  );
};

const Sting: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <Mascot x={540} y={720} w={220} expr="curious" t={t} />
    <Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} />
  </g>
);

const Rentang: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.rentang;
  return (
    <g>
      <Card x={110} y={500} w={370} h={400} t={t} start={c.c7} from="left">
        <Label x={185} y={78} text="DARI" anchor="middle" />
        <text x={185} y={286} fontSize={230} fill={BLACK} textAnchor="middle" style={bold}>7</text>
        <text x={185} y={360} fontSize={56} fill={YELLOW_D} textAnchor="middle" style={bold}>jam</text>
      </Card>
      <Card x={600} y={500} w={370} h={400} t={t} start={c.c9} from="right">
        <Label x={185} y={78} text="SAMPAI" anchor="middle" />
        <text x={185} y={286} fontSize={230} fill={BLACK} textAnchor="middle" style={bold}>9</text>
        <text x={185} y={360} fontSize={56} fill={YELLOW_D} textAnchor="middle" style={bold}>jam</text>
      </Card>
      <rect x={490} y={692} width={100 * ramp(t, c.span, 0.6)} height={18} rx={9} fill={YELLOW} />
      <Card x={110} y={960} w={860} h={110} t={t} start={c.lab} fill={YELLOW}>
        <text x={430} y={74} fontSize={54} fill={BLACK} textAnchor="middle" style={bold}>semalam, untuk dewasa</text>
      </Card>
      <Label x={110} y={1170} text="SEHARI = 24 JAM" op={ramp(t, c.grid)} />
      <HourGrid x={108} y={1196} cell={62} gap={8} t={t} start={c.grid}
        groups={[{ n: 7, from: c.fill7, step: 0.1, color: YELLOW }, { n: 9, start: 7, from: c.fill9, step: 0.25, color: YELLOW_D }]} />
    </g>
  );
};

const Sepertiga: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.sepertiga, seg = (i: number) => ramp(t, c.thirds + i * 0.2, 0.5);
  return (
    <g>
      <Label x={77} y={518} text="SEHARI = 24 JAM" op={ramp(t, c.grid)} />
      <HourGrid x={77} y={540} cell={68} gap={10} t={t} start={c.grid} groups={[{ n: 8, from: c.fill, step: c.fillStep, color: YELLOW }]} />
      <FlipCard x={120} y={790} w={840} h={300} t={t} start={c.card} at={c.flip}
        front={() => <text x={420} y={206} fontSize={170} fill={BLACK} textAnchor="middle" style={bold}>8 ÷ 24</text>}
        back={<text x={420} y={208} fontSize={190} fill={BLACK} textAnchor="middle" style={bold}>= 1/3</text>} />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${114 + i * 292} 1190) scale(${0.85 + 0.15 * seg(i)})`} opacity={seg(i)}>
          <rect width={280} height={150} rx={30} fill={i === 0 ? YELLOW : WHITE} />
          <text x={140} y={94} fontSize={52} fill={BLACK} textAnchor="middle" style={bold}>{i === 0 ? "tidur" : "bangun"}</text>
        </g>
      ))}
      <Label x={540} y={1400} text="1 HARI, DIBAGI TIGA" anchor="middle" op={ramp(t, c.lab)} />
    </g>
  );
};

const Umur: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.umur, roll = ramp(t, c.n78 + 0.1, 1.1), bar = ramp(t, c.bar, 1.1), mark = ramp(t, c.mark, 0.5), big = ramp(t, c.big + 0.1, 1.1);
  return (
    <g>
      <Card x={120} y={490} w={840} h={250} t={t} start={c.n78}>
        <Label x={40} y={72} text="UMUR" />
        <text x={420} y={214} fontSize={190} fill={BLACK} textAnchor="middle" style={bold}>{Math.round(78 * roll)}<tspan fontSize={70} fill={YELLOW_D}> tahun</tspan></text>
      </Card>
      <g transform={`translate(540 800) scale(${0.6 + 0.4 * springAt(t, c.div)})`} opacity={ramp(t, c.div, 0.3)}>
        <circle r={62} fill={YELLOW} />
        <text y={26} fontSize={74} fill={BLACK} textAnchor="middle" style={bold}>÷ 3</text>
      </g>
      {[0, 1, 2].map((i) => {
        const p = clamp01(bar * 3 - i);
        return (
          <g key={i}>
            <rect x={120 + i * 290} y={900} width={260 * p} height={110} rx={28} fill={G4} />
            <rect x={120 + i * 290} y={900} width={260 * (i === 0 ? mark : 0)} height={110} rx={28} fill={YELLOW} />
          </g>
        );
      })}
      <Label x={120} y={1046} text="0" op={bar} /><Label x={960} y={1046} text="78" anchor="end" op={bar} />
      <Label x={380} y={1046} text="26" anchor="middle" op={mark} fill={BLACK} />
      <Card x={120} y={1080} w={840} h={380} t={t} start={c.big} fill={YELLOW}>
        <text x={420} y={262} fontSize={290} fill={BLACK} textAnchor="middle" style={bold}>{Math.round(26 * big)}<tspan fontSize={82}> tahun</tspan></text>
      </Card>
    </g>
  );
};

const Setahun: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.setahun, roll = ramp(t, c.card + 0.1, 1.2);
  return (
    <g>
      <Card x={120} y={480} w={840} h={250} t={t} start={c.card}>
        <Label x={40} y={72} text="SETAHUN, 8 JAM SEMALAM" />
        <text x={420} y={214} fontSize={170} fill={BLACK} textAnchor="middle" style={bold}>{dots(2920 * roll)}<tspan fontSize={66} fill={YELLOW_D}> jam</tspan></text>
      </Card>
      <g>
        {Array.from({ length: 365 }, (_, i) => {
          const p = ramp(t, c.grid + i * 0.002, 0.35), fp = i < 122 ? ramp(t, c.fill + (i / 122) * c.fillDur, 0.25) : 0;
          return <circle key={i} cx={132 + (i % 25) * 33.2 + 14} cy={790 + Math.floor(i / 25) * 33 + 14} r={12.5 * (0.4 + 0.6 * p)} fill={fp > 0.5 ? YELLOW : G3} opacity={p * (fp > 0.5 ? 1 : 0.55)} />;
        })}
      </g>
      <Card x={120} y={1330} w={840} h={130} t={t} start={c.lab} fill={YELLOW}>
        <text x={420} y={88} fontSize={64} fill={BLACK} textAnchor="middle" style={bold}>120+ hari dari 365</text>
      </Card>
    </g>
  );
};

const RentangUmur: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.rentangUmur, rows = [{ at: c.r7, h: 7, v: 23 }, { at: c.r8, h: 8, v: 26 }, { at: c.r9, h: 9, v: 29 }];
  return (
    <g>
      {rows.map((r, i) => {
        const grow = ramp(t, r.at + 0.15, 0.8);
        return (
          <Card key={r.h} x={120} y={490 + i * 250} w={840} h={220} t={t} start={r.at} fill={WHITE}>
            <text x={40} y={92} fontSize={78} fill={BLACK} style={bold}>{r.h}<tspan fontSize={36} fill={YELLOW_D}> jam</tspan></text>
            <rect x={40} y={128} width={760 * (r.v / 29) * grow} height={52} rx={26} fill={r.h === 8 ? YELLOW : YELLOW_D} />
            <text x={800} y={92} fontSize={78} fill={BLACK} textAnchor="end" opacity={grow} style={bold}>{Math.round(r.v * grow)}<tspan fontSize={36} fill={G2}> tahun</tspan></text>
          </Card>
        );
      })}
      <Card x={120} y={1260} w={840} h={110} t={t} start={c.foot} fill={BLACK}>
        <text x={420} y={72} fontSize={38} fill={YELLOW} textAnchor="middle" letterSpacing={2} style={mono}>UMUR 78 TAHUN, DIHITUNG</text>
      </Card>
    </g>
  );
};

const Otak: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.otak, b1 = ramp(t, c.bar1, 0.9), b2 = ramp(t, c.bar2, 1.1), st = springAt(t, c.stamp);
  return (
    <g>
      <Card x={120} y={480} w={840} h={210} t={t} start={c.card}>
        <Label x={40} y={72} text="DIBUANG OTAK" />
        <text x={420} y={160} fontSize={82} fill={BLACK} textAnchor="middle" style={bold}>sisa metabolisme</text>
      </Card>
      <Card x={120} y={750} w={840} h={540} t={t} start={c.bar1 - 0.3}>
        <Label x={40} y={72} text="LAJU PEMBUANGAN, ILUSTRASI" />
        <text x={40} y={170} fontSize={56} fill={BLACK} style={bold}>terjaga</text>
        <rect x={40} y={196} width={250 * b1} height={70} rx={35} fill={G3} />
        <text x={40} y={380} fontSize={56} fill={BLACK} style={bold}>tidur</text>
        <rect x={40} y={406} width={760 * b2} height={70} rx={35} fill={YELLOW} />
      </Card>
      <g transform={`translate(700 1370) rotate(-5) scale(${0.4 + 0.6 * st})`} opacity={clamp01(st * 2)}>
        <rect x={-190} y={-52} width={380} height={104} rx={26} fill={BLACK} />
        <text y={24} fontSize={58} fill={YELLOW} textAnchor="middle" style={bold}>LEBIH CEPAT</text>
      </g>
    </g>
  );
};

const Akhir: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.akhir;
  return (
    <g>
      <Card x={120} y={490} w={840} h={330} t={t} start={c.c1} fill={YELLOW}>
        <text x={420} y={242} fontSize={210} fill={BLACK} textAnchor="middle" style={bold}>26<tspan fontSize={80}> tahun</tspan></text>
      </Card>
      <FlipCard x={120} y={880} w={840} h={200} t={t} start={c.c2 - 0.1} at={c.c2} front={() => <g />} backFill={WHITE}
        back={<text x={420} y={128} fontSize={78} fill={BLACK} textAnchor="middle" style={bold}>bukan waktu hilang</text>} />
      <Card x={120} y={1140} w={840} h={200} t={t} start={c.c3} fill={BLACK}>
        <text x={420} y={128} fontSize={74} fill={YELLOW} textAnchor="middle" style={bold}>bagian dari hidupmu</text>
      </Card>
    </g>
  );
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  const outro = beat.kind === "outro", sting = beat.kind === "sting";
  // a slow camera push over the beat (B25): the content only, never the top text or the caption
  const zoom = 1 + 0.045 * easeInOut(clamp01(t / beat.dur));
  const body = { hook: Hook, rentang: Rentang, sepertiga: Sepertiga, umur: Umur, setahun: Setahun, "rentang-umur": RentangUmur, otak: Otak, akhir: Akhir }[beat.id as string] as React.FC<{ t: number }> | undefined;
  const Body = sting ? Sting : body;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <Brand clock={clock} spot={{ x: 540, y: 930 }} />
      {!outro && Body && <g transform={sting ? undefined : `translate(540 960) scale(${zoom}) translate(-540 -960)`}><Body t={t} /></g>}
      {!sting && !outro && <TopText kicker={beat.kicker} headline={beat.headline ?? beat.text} t={t} />}
      {!sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
