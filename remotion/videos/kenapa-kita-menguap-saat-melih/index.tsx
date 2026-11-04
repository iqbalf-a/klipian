/* Kenapa kita menguap saat melihat orang menguap — look text (B28): no objects, kinetic numbers and words in rounded cards like the caption. A counter rolls,
   dots fill, bars grow, cards slide, stack and flip; a slow camera push per beat; the top text (TopText) and the bottom caption (CaptionLayer) are the channel's.
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

const Label: React.FC<{ x: number; y: number; text: string; fs?: number; fill?: string; anchor?: "start" | "middle" | "end"; op?: number }> = ({ x, y, text, fs = 30, fill = G2, anchor = "start", op = 1 }) =>
  <text x={x} y={y} fontSize={fs} fill={fill} textAnchor={anchor} opacity={op} letterSpacing={2} style={mono}>{text}</text>;

// ---------------------------------------------------------------- the beats
const Hook: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.hook, w = springAt(t, c.word), wob = Math.sin(t * 3.2) * 2;
  return (
    <Card x={170} y={560} w={740} h={760} t={t} start={c.card}>
      <Label x={370} y={100} text="LIHAT ORANG MENGUAP" anchor="middle" op={ramp(t, c.card + 0.2)} />
      <g transform={`translate(370 400) rotate(${wob}) scale(${0.5 + 0.5 * w})`} opacity={clamp01(w * 2)}>
        <text fontSize={168} fill={BLACK} textAnchor="middle" style={bold}>HOAAM</text>
      </g>
      <text x={370} y={560} fontSize={72} fill={YELLOW_D} textAnchor="middle" opacity={ramp(t, c.sub)} style={bold}>kamu ikut juga?</text>
      <rect x={110} y={620} width={520 * ramp(t, c.bar, 0.7)} height={16} rx={8} fill={YELLOW} />
    </Card>
  );
};

const Sting: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <Mascot x={540} y={720} w={220} expr="curious" t={t} />
    <Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} />
  </g>
);

const Tular: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.tular, roll = ramp(t, c.roll, c.rollDur);
  return (
    <g>
      <Card x={120} y={490} w={840} h={380} t={t} start={c.card}>
        <Label x={40} y={72} text="ORANG DEWASA YANG IKUT MENGUAP" />
        <text x={420} y={290} fontSize={250} fill={BLACK} textAnchor="middle" style={bold}>{Math.round(50 * roll)}<tspan fontSize={110} fill={YELLOW_D}>%</tspan></text>
        <text x={420} y={348} fontSize={42} fill={G2} textAnchor="middle" opacity={ramp(t, c.roll + 0.8)} style={mono}>SEKITAR SEPARUH</text>
      </Card>
      <Label x={120} y={950} text="10 ORANG DEWASA" op={ramp(t, c.grid)} />
      {Array.from({ length: 10 }, (_, i) => {
        const p = ramp(t, c.grid + i * 0.05, 0.4), q = i < 5 ? ramp(t, c.fill + i * c.fillStep, 0.3) : 0;
        const cx = 120 + 84 + (i % 5) * 168, cy = 1060 + Math.floor(i / 5) * 190;
        return (
          <g key={i} transform={`translate(${cx} ${cy + hover(t + i * 0.4, 4)}) scale(${0.5 + 0.5 * p})`} opacity={p}>
            <circle r={68} fill={WHITE} /><circle r={68} fill={YELLOW} opacity={q} />
          </g>
        );
      })}
      <Card x={120} y={1330} w={840} h={110} t={t} start={c.lab} fill={YELLOW}>
        <text x={420} y={74} fontSize={52} fill={BLACK} textAnchor="middle" style={bold}>5 dari 10 ikut menguap</text>
      </Card>
      <Label x={540} y={1500} text="ANGKA BERVARIASI, 40 SAMPAI 60 %" anchor="middle" op={ramp(t, c.note)} />
    </g>
  );
};

const Indera: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.indera, rows = [{ at: c.c1, n: "1", w: "LIHAT", s: "orang menguap", from: undefined }, { at: c.c2, n: "2", w: "DENGAR", s: "suara menguap", from: "left" as const }, { at: c.c3, n: "3", w: "BACA", s: "tulisan tentang menguap", from: "right" as const }];
  return (
    <g>
      {rows.map((r, i) => (
        <Card key={r.n} x={120} y={490 + i * 250} w={840} h={220} t={t} start={r.at} from={r.from} fill={i === 2 ? YELLOW : WHITE}>
          <text x={40} y={118} fontSize={110} fill={i === 2 ? BLACK : YELLOW_D} style={bold}>{r.n}</text>
          <text x={150} y={106} fontSize={86} fill={BLACK} style={bold}>{r.w}</text>
          <text x={150} y={170} fontSize={38} fill={G2} letterSpacing={1} style={mono}>{r.s}</text>
        </Card>
      ))}
      <FlipCard x={120} y={1270} w={840} h={190} t={t} start={c.card} at={c.flip}
        front={() => <text x={420} y={122} fontSize={64} fill={BLACK} textAnchor="middle" style={bold}>kamu baca ini...</text>}
        back={<text x={420} y={124} fontSize={64} fill={BLACK} textAnchor="middle" style={bold}>sudah ingin menguap?</text>} />
    </g>
  );
};

const Dekat: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.dekat, rows = [{ at: c.r0, w: "keluarga", v: 1 }, { at: c.r1, w: "teman", v: 0.74 }, { at: c.r2, w: "kenalan", v: 0.5 }, { at: c.r3, w: "orang asing", v: 0.28 }];
  return (
    <g>
      {rows.map((r, i) => {
        const grow = ramp(t, r.at + 0.2, 0.9);
        return (
          <Card key={r.w} x={120} y={490 + i * 205} w={840} h={180} t={t} start={r.at} from={i % 2 ? "right" : "left"}>
            <text x={40} y={76} fontSize={58} fill={BLACK} style={bold}>{r.w}</text>
            <rect x={40} y={102} width={760 * r.v * grow} height={46} rx={23} fill={i === 0 ? YELLOW : i === 3 ? G3 : YELLOW_D} />
          </Card>
        );
      })}
      <Label x={120} y={1360} text="MAKIN DEKAT, MAKIN MENULAR" op={ramp(t, c.r3 + 1.2)} />
      <Card x={120} y={1390} w={840} h={110} t={t} start={c.note} fill={BLACK}>
        <text x={420} y={72} fontSize={36} fill={YELLOW} textAnchor="middle" letterSpacing={2} style={mono}>ILUSTRASI URUTAN, BUKAN ANGKA</text>
      </Card>
    </g>
  );
};

const Anak: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.anak, roll = ramp(t, c.roll, c.rollDur), mk = springAt(t, c.mark);
  return (
    <g>
      <Card x={120} y={490} w={840} h={340} t={t} start={c.card}>
        <Label x={40} y={72} text="MULAI TERTULAR SEKITAR UMUR" />
        <text x={420} y={268} fontSize={230} fill={BLACK} textAnchor="middle" style={bold}>{Math.round(4 * roll)}<tspan fontSize={84} fill={YELLOW_D}> tahun</tspan></text>
      </Card>
      <Label x={120} y={920} text="UMUR ANAK, TAHUN" op={ramp(t, c.grid)} />
      {Array.from({ length: 7 }, (_, i) => {
        const p = ramp(t, c.grid + i * 0.06, 0.4), s = ramp(t, c.scan + i * c.scanStep, 0.25), on = i >= 4 ? mk : 0;
        const cx = 120 + 52 + i * 122, cy = 1030;
        return (
          <g key={i} transform={`translate(${cx} ${cy + hover(t + i * 0.3, 4)}) scale(${(0.6 + 0.4 * p) * (1 + 0.12 * on * (i === 4 ? 1 : 0))})`} opacity={p}>
            <rect x={-52} y={-52} width={104} height={104} rx={30} fill={WHITE} />
            <rect x={-52} y={-52} width={104} height={104} rx={30} fill={G4} opacity={s * (1 - on)} />
            <rect x={-52} y={-52} width={104} height={104} rx={30} fill={YELLOW} opacity={on} />
            <text y={24} fontSize={66} fill={BLACK} textAnchor="middle" style={bold}>{i}</text>
          </g>
        );
      })}
      <Card x={120} y={1180} w={840} h={150} t={t} start={c.lab} fill={YELLOW}>
        <text x={420} y={96} fontSize={56} fill={BLACK} textAnchor="middle" style={bold}>sebelum itu, biasanya belum</text>
      </Card>
    </g>
  );
};

const Teori: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.teori, q = springAt(t, c.q);
  return (
    <g>
      <Card x={120} y={490} w={840} h={250} t={t} start={c.c1}>
        <Label x={40} y={72} text="SALAH SATU DUGAAN" />
        <text x={420} y={196} fontSize={74} fill={BLACK} textAnchor="middle" style={bold}>kaitan dengan empati</text>
      </Card>
      <FlipCard x={120} y={810} w={840} h={290} t={t} start={c.c2} at={c.flip}
        front={() => <text x={420} y={196} fontSize={150} fill={BLACK} textAnchor="middle" style={bold}>EMPATI?</text>}
        back={<text x={420} y={192} fontSize={96} fill={BLACK} textAnchor="middle" style={bold}>BELUM TERBUKTI</text>} />
      <g transform={`translate(840 1260) rotate(-8) scale(${0.4 + 0.6 * q})`} opacity={clamp01(q * 2)}>
        <circle r={72} fill={YELLOW} />
        <text y={32} fontSize={100} fill={BLACK} textAnchor="middle" style={bold}>?</text>
      </g>
      <Card x={120} y={1160} w={640} h={200} t={t} start={c.c3} fill={BLACK}>
        <text x={320} y={86} fontSize={50} fill={YELLOW} textAnchor="middle" style={bold}>peneliti masih</text>
        <text x={320} y={150} fontSize={50} fill={YELLOW} textAnchor="middle" style={bold}>berdebat</text>
      </Card>
    </g>
  );
};

const Akhir: React.FC<{ t: number }> = ({ t }) => {
  const c = CUE.akhir, wob = Math.sin(t * 3.2) * 2.5;
  return (
    <g>
      <Card x={120} y={490} w={840} h={330} t={t} start={c.c1} fill={YELLOW}>
        <text x={420} y={226} fontSize={150} fill={BLACK} textAnchor="middle" style={bold} transform={`rotate(${wob} 420 190)`}>MENULAR</text>
      </Card>
      <FlipCard x={120} y={880} w={840} h={200} t={t} start={c.c2} at={c.flip} front={() => <text x={420} y={124} fontSize={68} fill={BLACK} textAnchor="middle" style={bold}>ikut menguap?</text>} backFill={WHITE}
        back={<text x={420} y={128} fontSize={78} fill={BLACK} textAnchor="middle" style={bold}>itu hal wajar</text>} />
      <Card x={120} y={1140} w={840} h={200} t={t} start={c.c3} fill={BLACK}>
        <text x={420} y={128} fontSize={74} fill={YELLOW} textAnchor="middle" style={bold}>menguap itu menular</text>
      </Card>
      <g transform={`translate(540 1470) scale(${0.5 + 0.5 * springAt(t, c.c4)})`} opacity={clamp01(springAt(t, c.c4) * 2)}>
        <text fontSize={90} fill={YELLOW_D} textAnchor="middle" style={bold}>hoaam~</text>
      </g>
    </g>
  );
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  const outro = beat.kind === "outro", sting = beat.kind === "sting";
  // a slow camera push over the beat (B25): the content only, never the top text or the caption
  const zoom = 1 + 0.045 * easeInOut(clamp01(t / beat.dur));
  const body = { hook: Hook, tular: Tular, indera: Indera, dekat: Dekat, anak: Anak, teori: Teori, akhir: Akhir }[beat.id as string] as React.FC<{ t: number }> | undefined;
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
