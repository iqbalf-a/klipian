/* Lotre vs petir — look text (B28): kinetic numbers and words in rounded cards, no objects. Outfit and DM Mono only, palette tokens only.
   The slab (a black card that bleeds past the frame) fills the band between the top text and the caption; cards, counters and tiles come in on the times of plan.ts T. */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, FONT_BOLD, FONT_MONO, G2, G3, G4, StoryVideo, TopText, WHITE, YELLOW, clamp01, easeInOut, easeOut, springAt,
  type BeatT, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { T } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const mono = { fontFamily: `"${FONT_MONO}", monospace`, fontWeight: 400 } as const;
const SLAB = { y0: 480, y1: 1500 } as const;
const dots = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const ramp = (t: number, at: number, dur = 0.5): number => easeOut(clamp01((t - at) / dur));

/** The slab and the slow camera: a push (and a drift) on everything inside it, so every beat moves inside its card. */
const Slab: React.FC<{ t: number; dur: number; push?: number; dx?: number; dy?: number; children: React.ReactNode }> = ({ t, dur, push = 0.04, dx = 0, dy = 0, children }) => {
  const k = easeInOut(clamp01(t / dur));
  return (
    <g transform={`translate(540 990) translate(${dx * k} ${dy * k}) scale(${1 + push * k}) translate(-540 -990)`}>
      <rect x={-300} y={SLAB.y0} width={1680} height={SLAB.y1 - SLAB.y0} fill={BLACK} />
      {children}
    </g>
  );
};

/** A white card that pops in (a spring around its own centre). */
const Card: React.FC<{ x: number; y: number; w: number; h: number; t: number; at: number; fill?: string; rot?: number; children?: React.ReactNode }> = ({ x, y, w, h, t, at, fill = WHITE, rot = 0, children }) => {
  const p = Math.max(0, springAt(t, at, true));
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) rotate(${rot}) scale(${0.9 + 0.1 * p}) translate(${-w / 2} ${-h / 2})`} opacity={Math.min(1, p * 2.2)}>
      <rect width={w} height={h} rx={34} fill={fill} />
      {children}
    </g>
  );
};

/** A small mono note on a card that slides up and fades in. */
const Note: React.FC<{ text: string; cx: number; y: number; t: number; at: number; fs?: number; fill?: string }> = ({ text, cx, y, t, at, fs = 38, fill = G3 }) => {
  const e = ramp(t, at, 0.45);
  return <text x={cx} y={y + (1 - e) * 24} textAnchor="middle" fontSize={fs} fill={fill} opacity={e} letterSpacing={2} style={mono}>{text.toUpperCase()}</text>;
};

/** A white pill with black text, sliding in (the label of a beat's number). */
const Pill: React.FC<{ text: string; cx: number; y: number; w: number; t: number; at: number; fs?: number }> = ({ text, cx, y, w, t, at, fs = 40 }) => {
  const e = ramp(t, at, 0.45);
  return (
    <g opacity={e} transform={`translate(0 ${(1 - e) * 28})`}>
      <rect x={cx - w / 2} y={y} width={w} height={84} rx={42} fill={WHITE} />
      <text x={cx} y={y + 56} textAnchor="middle" fontSize={fs} fill={BLACK} style={bold}>{text}</text>
    </g>
  );
};

/** A number that rolls up to `to` over `dur` seconds and lands with a small bump. */
const Counter: React.FC<{ to: number; decimals?: number; prefix?: string; suffix?: string; cx: number; y: number; fs: number; t: number; at: number; dur: number }> = ({ to, decimals = 0, prefix = "", suffix = "", cx, y, fs, t, at, dur }) => {
  const k = clamp01((t - at) / dur), e = easeOut(k);
  const v = to * e;
  const shown = decimals ? v.toFixed(decimals).replace(".", ",") : dots(v);
  const bump = k >= 1 ? 1 + 0.06 * Math.max(0, 1 - (t - at - dur) * 5) : 1;
  return (
    <g opacity={Math.min(1, k * 8)} transform={`translate(${cx} ${y}) scale(${bump}) translate(${-cx} ${-y})`}>
      <text x={cx} y={y} textAnchor="middle" fontSize={fs} fill={YELLOW} style={bold}>{prefix}{shown}{suffix}</text>
    </g>
  );
};

/** A grid of dots or tiles that sweeps in; `win` is the one that turns yellow and pops. */
const Grid: React.FC<{ n: number; cols: number; size: number; gap: number; cx: number; y: number; t: number; at: number; sweep: number; win: number; winAt: number; round?: boolean }> = ({ n, cols, size, gap, cx, y, t, at, sweep, win, winAt, round = true }) => {
  const step = size + gap, x0 = cx - (cols * step - gap) / 2;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const e = ramp(t, at + (i / n) * sweep, 0.3), isWin = i === win;
        const pop = isWin ? Math.max(0, springAt(t, winAt)) : 1;
        const cxI = x0 + (i % cols) * step + size / 2, cyI = y + Math.floor(i / cols) * step + size / 2;
        const s = isWin ? pop : e;
        const r = size / 2;
        return round
          ? <circle key={i} cx={cxI} cy={cyI} r={r * Math.max(0, s) * (isWin ? 1.25 : 1)} fill={isWin ? YELLOW : G2} opacity={isWin ? Math.min(1, pop * 3) : e} />
          : <rect key={i} x={cxI - r * Math.max(0, s) * (isWin ? 1.15 : 1)} y={cyI - r * Math.max(0, s) * (isWin ? 1.15 : 1)} width={2 * r * Math.max(0, s) * (isWin ? 1.15 : 1)} height={2 * r * Math.max(0, s) * (isWin ? 1.15 : 1)} rx={8} fill={isWin ? YELLOW : G4} opacity={isWin ? Math.min(1, pop * 3) : e} />;
      })}
    </g>
  );
};

const HookCards: React.FC<{ t: number; vs?: boolean }> = ({ t, vs = true }) => {
  const w = Math.min(1, springAt(t, T.hook.vs));
  const wig = t > T.hook.wiggle ? Math.sin((t - T.hook.wiggle) * 14) * 7 * Math.max(0, 1 - (t - T.hook.wiggle) * 1.5) : 0;
  const settle = (at: number) => 0.92 + 0.08 * Math.max(0, springAt(t, at, true));
  return (
    <g>
      {([["LOTRE", "jackpot", 40, T.hook.cardL], ["PETIR", "tersambar", 590, T.hook.cardR]] as const).map(([word, sub, x, at]) => (
        <g key={word} transform={`translate(${x + 225} 960) scale(${settle(at)}) translate(-225 -960)`}>
          <rect x={0} y={560} width={450} height={800} rx={40} fill={WHITE} transform={`translate(0 0)`} />
          <text x={225} y={650} textAnchor="middle" fontSize={34} fill={G2} letterSpacing={3} style={mono}>{sub.toUpperCase()}</text>
          <text x={225} y={990} textAnchor="middle" fontSize={92} fill={BLACK} style={bold}>{word}</text>
        </g>
      ))}
      {vs && (
        <g transform={`translate(540 960) rotate(${wig}) scale(${Math.max(0, w)})`}>
          <circle r={80} fill={YELLOW} />
          <text y={26} textAnchor="middle" fontSize={70} fill={BLACK} style={bold}>VS</text>
        </g>
      )}
    </g>
  );
};

const Hook: React.FC<{ t: number; dur: number }> = ({ t, dur }) => (
  <Slab t={t} dur={dur} push={0.05}><HookCards t={t} /></Slab>
);

const Jackpot: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const k = T.jackpot;
  return (
    <Slab t={t} dur={dur} push={0.05} dy={-30}>
      <Note text="Peluang jackpot Powerball" cx={540} y={590} t={t} at={k.label} fs={36} />
      <Counter prefix="1 : " to={292201338} cx={540} y={730} fs={98} t={t} at={k.roll} dur={k.rollDur} />
      <Note text="Amerika, satu tiket" cx={540} y={800} t={t} at={k.roll + 0.6} fs={32} fill={G3} />
      <Grid n={160} cols={20} size={30} gap={20} cx={540} y={880} t={t} at={k.grid} sweep={1.9} win={87} winAt={k.winner} />
      <Pill text="ilustrasi, bukan skala" cx={540} y={1330} w={640} t={t} at={k.tag} />
    </Slab>
  );
};

const Petir: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const k = T.petir;
  return (
    <Slab t={t} dur={dur} push={0.05} dx={-24}>
      <Note text="Tersambar petir, seumur hidup" cx={540} y={590} t={t} at={k.label} fs={36} />
      <Counter prefix="1 : " to={15300} cx={540} y={760} fs={168} t={t} at={k.roll} dur={k.rollDur} />
      <Note text="Dengan umur 80 tahun" cx={540} y={830} t={t} at={k.roll + 0.6} fs={32} fill={G3} />
      <Grid n={160} cols={20} size={30} gap={20} cx={540} y={910} t={t} at={k.grid} sweep={1.9} win={52} winAt={k.winner} />
      <Pill text="ilustrasi, bukan skala" cx={540} y={1330} w={640} t={t} at={k.tag} />
    </Slab>
  );
};

const Banding: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const k = T.banding, grow = ramp(t, k.barA, 1.0), tiny = ramp(t, k.barB, 0.3);
  return (
    <Slab t={t} dur={dur} push={0.04} dy={-40}>
      <Note text="Jackpot lawan petir" cx={540} y={590} t={t} at={k.label} fs={36} />
      <text x={70} y={680} fontSize={34} fill={G3} letterSpacing={2} style={mono} opacity={grow}>JACKPOT</text>
      <rect x={70} y={702} width={940 * grow} height={76} rx={20} fill={YELLOW} />
      <text x={70} y={850} fontSize={34} fill={G3} letterSpacing={2} style={mono} opacity={tiny}>PETIR</text>
      <rect x={70} y={872} width={Math.max(0, 6 * tiny)} height={76} rx={3} fill={WHITE} />
      <Note text="Garis kecil itu petir" cx={540} y={1010} t={t} at={k.barB + 0.4} fs={32} />
      <Counter prefix="≈ " suffix="×" to={19098} cx={540} y={1190} fs={150} t={t} at={k.roll} dur={k.rollDur} />
      <Card x={90} y={1250} w={900} h={170} t={t} at={k.formula}>
        <text x={450} y={105} textAnchor="middle" fontSize={64} fill={BLACK} style={bold}>292.201.338 ÷ 15.300</text>
      </Card>
    </Slab>
  );
};

const Setahun: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const k = T.setahun;
  return (
    <Slab t={t} dur={dur} push={0.05} dy={20}>
      <Note text="Petir dalam setahun: 1 : 1,2 juta" cx={540} y={585} t={t} at={k.label} fs={34} />
      <Grid n={239} cols={16} size={36} gap={8} cx={540} y={620} t={t} at={k.tiles} sweep={k.tilesDur} win={120} winAt={k.winner} round={false} />
      <Note text="Kotak kuning = petir" cx={540} y={1325} t={t} at={k.winner + 0.3} fs={32} fill={YELLOW} />
      <Counter prefix="≈ " suffix="×" to={239} cx={540} y={1450} fs={110} t={t} at={k.roll} dur={k.rollDur} />
      <Note text="Semua kotak = jackpot" cx={540} y={1385} t={t} at={k.tag} fs={32} fill={WHITE} />
    </Slab>
  );
};

const Fakta: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const k = T.fakta, s = ramp(t, k.stamp, 0.35), scale = 2.4 - 1.4 * s;
  return (
    <Slab t={t} dur={dur} push={0.04} dy={30}>
      <g transform={`translate(540 740) rotate(-4) scale(${scale})`} opacity={Math.min(1, s * 3)}>
        <rect x={-380} y={-170} width={760} height={340} rx={44} fill={YELLOW} />
        <text y={64} textAnchor="middle" fontSize={200} fill={BLACK} style={bold}>FAKTA</text>
      </g>
      <Card x={60} y={1000} w={430} h={270} t={t} at={k.cardL}>
        <text x={215} y={90} textAnchor="middle" fontSize={32} fill={G2} letterSpacing={3} style={mono}>JACKPOT</text>
        <text x={215} y={185} textAnchor="middle" fontSize={64} fill={BLACK} style={bold}>1 : 292 juta</text>
      </Card>
      <Card x={590} y={1000} w={430} h={270} t={t} at={k.cardR}>
        <text x={215} y={90} textAnchor="middle" fontSize={32} fill={G2} letterSpacing={3} style={mono}>PETIR</text>
        <text x={215} y={185} textAnchor="middle" fontSize={64} fill={BLACK} style={bold}>1 : 15.300</text>
      </Card>
      <g transform={`translate(540 1135) scale(${Math.max(0, springAt(t, k.less))})`}>
        <circle r={62} fill={YELLOW} />
        <text y={26} textAnchor="middle" fontSize={84} fill={BLACK} style={bold}>{"<"}</text>
      </g>
      <Pill text="jackpot: peluang lebih kecil" cx={540} y={1340} w={800} t={t} at={k.tag} fs={44} />
    </Slab>
  );
};

const Hadiah: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const k = T.hadiah;
  return (
    <Slab t={t} dur={dur} push={0.05} dx={20}>
      <Note text="Hadiah apa pun, Powerball" cx={540} y={590} t={t} at={k.label} fs={36} />
      <Counter prefix="1 : " to={24.87} decimals={2} cx={540} y={760} fs={168} t={t} at={k.roll} dur={k.rollDur} />
      <Note text="Per permainan 2 dolar" cx={540} y={830} t={t} at={k.roll + 0.6} fs={32} />
      <Grid n={25} cols={5} size={78} gap={12} cx={540} y={880} t={t} at={k.tiles} sweep={0.9} win={12} winAt={k.winner} round={false} />
      <Pill text="jackpot tetap 1 : 292 juta" cx={540} y={1370} w={860} t={t} at={k.tag} fs={44} />
    </Slab>
  );
};

const TIPS = [["1", "Baca sebagai|1 banding N", T.tips.t1], ["2", "Bandingkan dengan|kejadian nyata", T.tips.t2], ["3", "Cek angka resmi|penyelenggara", T.tips.t3]] as const;
const Tips: React.FC<{ t: number; dur: number }> = ({ t, dur }) => (
  <Slab t={t} dur={dur} push={0.03} dy={-20}>
    {TIPS.map(([n, text, at], i) => {
      const e = ramp(t, at, 0.5), y = 540 + i * 310;
      return (
        <g key={n} opacity={e} transform={`translate(${(1 - e) * 260} 0)`}>
          <rect x={70} y={y} width={940} height={270} rx={36} fill={WHITE} />
          <circle cx={190} cy={y + 135} r={64} fill={YELLOW} transform={`translate(190 ${y + 135}) scale(${0.9 + 0.1 * Math.max(0, springAt(t, at + 0.2))}) translate(-190 ${-(y + 135)})`} />
          <text x={190} y={y + 135 + 30} textAnchor="middle" fontSize={84} fill={BLACK} style={bold}>{n}</text>
          <text x={300} y={y + 112} fontSize={60} fill={BLACK} style={bold}>{text.split("|")[0]}</text>
          <text x={300} y={y + 190} fontSize={60} fill={BLACK} style={bold}>{text.split("|")[1]}</text>
        </g>
      );
    })}
  </Slab>
);

const BODY: Record<string, React.FC<{ t: number; dur: number }>> = { hook: Hook, jackpot: Jackpot, petir: Petir, banding: Banding, setahun: Setahun, fakta: Fakta, hadiah: Hadiah, tips: Tips };
const kickerOf = (b: BeatT): string => b.kicker ?? "Intip";

const Scene = ({ beat, t, clock }: SceneProps) => {
  const Body = BODY[beat.id];
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <Brand clock={clock} />
      {beat.kind === "sting" && (
        <g>
          <StingMark slug="peluang-menang-lotre-lebih-kec" t={t} clock={clock} />
        </g>
      )}
      {beat.kind === "outro" ? <Slab t={0} dur={1} push={0.05}><HookCards t={0} vs={false} /></Slab> : Body && <Body t={t} dur={beat.dur} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText kicker={kickerOf(beat)} headline={beat.headline ?? beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
