/* Fakta seru tentang cegukan yang jarang diketahui — custom video (videos/fakta-seru-tentang-cegukan/).
   Hero: IsoDiaphragm & Lungs (otot diafragma dan paru-paru dalam gaya 2.5D isometrik).
   Diafragma berdenyut dan mengalami spasme/sentakan mendadak saat cegukan terjadi, pita suara menutup di bagian atas,
   dan saraf frenikus menyalurkan sinyal refleks dari otak.
   Insert pendukung: IsoBrain (pusat refleks) & IsoHeart (cegukan janin). */
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  BLACK, Brand, CaptionLayer, FPS, FRAME, G1, G2, ISO, IsoBrain, IsoHeart, LayoutDebug, Mascot, RED, TopText, WALL, WHITE, YELLOW, YELLOW_D,
  bobPx, clamp01, easeInOut, springAt, useFonts,
  type StoryT,
} from "../../src/design/index.ts";
import { makePlan, type Plan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const W = FRAME.width, H = FRAME.height;
const bold = { fontFamily: '"Outfit", sans-serif', fontWeight: 700 } as const;

type P2 = [number, number];
const ptsAttr = (pts: P2[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** 2.5D Relief: stepped polygon copies to bottom-right for thickness, face, and lighter inset. */
const ReliefPolygon: React.FC<{ pts: P2[]; tones: readonly [string, string, string]; depth?: number }> = ({ pts, tones, depth = 14 }) => {
  const steps = 4;
  return (
    <g>
      {Array.from({ length: steps }, (_, i) => {
        const k = (steps - i) / steps;
        const dPts: P2[] = pts.map(([x, y]) => [x + depth * k * 0.7, y + depth * k]);
        return <polygon key={i} points={ptsAttr(dPts)} fill={tones[2]} stroke={tones[2]} strokeWidth={1} strokeLinejoin="round" />;
      })}
      <polygon points={ptsAttr(pts)} fill={tones[1]} stroke={tones[1]} strokeWidth={1} strokeLinejoin="round" />
      <polygon points={ptsAttr(pts.map(([x, y]) => [x - 4, y - 5]))} fill={tones[0]} opacity={0.65} />
    </g>
  );
};

/** The Hero: IsoDiaphragm & Lungs.
 * Menampilkan trakea, pita suara (glotis), kedua paru-paru dengan bronkus, serta otot diafragma melengkung yang mengalami spasme ke bawah. */
export const IsoDiaphragm: React.FC<{
  x: number;
  y: number;
  u: number;
  t: number;
  spasm?: number; // 0 (rileks) sampai 1 (spasme kontraksi penuh ke bawah)
  glottisClosed?: boolean;
}> = ({ x, y, u, t, spasm = 0, glottisClosed = false }) => {
  // nafas alami halus
  const breathe = 1 + 0.03 * Math.sin(t * 3.2);
  const jerk = spasm * 32; // sentakan diafragma ke bawah

  // Titik poligon paru kiri (viewer's left)
  const lungLeftPts: P2[] = [
    [x - u * 0.12, y - u * 0.42 * breathe],
    [x - u * 0.36, y - u * 0.50 * breathe],
    [x - u * 0.68, y - u * 0.32 * breathe],
    [x - u * 0.86, y - u * 0.02 * breathe],
    [x - u * 0.88, y + u * 0.34 * breathe],
    [x - u * 0.68, y + u * 0.46 * breathe],
    [x - u * 0.42, y + u * 0.38 * breathe],
    [x - u * 0.16, y + u * 0.32 * breathe],
    [x - u * 0.12, y - u * 0.02 * breathe],
  ];

  // Titik poligon paru kanan (viewer's right)
  const lungRightPts: P2[] = [
    [x + u * 0.12, y - u * 0.42 * breathe],
    [x + u * 0.12, y - u * 0.02 * breathe],
    [x + u * 0.16, y + u * 0.32 * breathe],
    [x + u * 0.42, y + u * 0.38 * breathe],
    [x + u * 0.68, y + u * 0.46 * breathe],
    [x + u * 0.88, y + u * 0.34 * breathe],
    [x + u * 0.86, y - u * 0.02 * breathe],
    [x + u * 0.68, y - u * 0.32 * breathe],
    [x + u * 0.36, y - u * 0.50 * breathe],
  ];

  // Lengkungan otot Diafragma (dome muscle)
  // Rileks = kubah melengkung tinggi (y lebih kecil); Spasme = mendatar & tersentak ke bawah (y lebih besar)
  const domeApexY = y + u * (0.24 + 0.18 * spasm) + jerk;
  const domeBaseY = y + u * 0.52 + jerk * 0.4;
  const dThick = u * 0.16;

  const diaphragmPath = `
    M ${x - u * 0.90} ${domeBaseY}
    Q ${x} ${domeApexY} ${x + u * 0.90} ${domeBaseY}
    L ${x + u * 0.90} ${domeBaseY + dThick}
    Q ${x} ${domeApexY + dThick} ${x - u * 0.90} ${domeBaseY + dThick}
    Z
  `;

  // Trakea (batang tenggorokan)
  const tracTop = y - u * 0.95;
  const tracBot = y - u * 0.38;
  const tracW = u * 0.22;

  return (
    <g transform={`translate(${bobPx(t, 0.2, 4)} ${bobPx(t, 0.5, 3)})`}>
      {/* Saraf Frenikus (sinyal kuning mengalir dari leher ke diafragma) */}
      <path
        d={`M ${x - u * 0.2} ${tracTop} Q ${x - u * 0.95} ${y} ${x - u * 0.75} ${domeApexY}`}
        fill="none"
        stroke={YELLOW_D}
        strokeWidth={5}
        strokeDasharray="14 10"
        opacity={0.85}
      />
      <path
        d={`M ${x + u * 0.2} ${tracTop} Q ${x + u * 0.95} ${y} ${x + u * 0.75} ${domeApexY}`}
        fill="none"
        stroke={YELLOW_D}
        strokeWidth={5}
        strokeDasharray="14 10"
        opacity={0.85}
      />

      {/* Trakea (batang nafas) dengan cincin tulang rawan */}
      <rect x={x - tracW / 2} y={tracTop} width={tracW} height={tracBot - tracTop} rx={10} fill={ISO.plastic[1]} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const ry = tracTop + 15 + i * 22;
        return <rect key={i} x={x - tracW / 2 - 2} y={ry} width={tracW + 4} height={9} rx={4} fill={ISO.plastic[0]} />;
      })}

      {/* Pita Suara / Glotis di bagian atas trakea */}
      <g transform={`translate(${x} ${tracTop + 14})`}>
        <rect x={-tracW / 2} y={-10} width={tracW} height={20} rx={6} fill={G1} />
        {glottisClosed ? (
          // Tertutup rapat (saat bunyi 'hik!')
          <line x1={-tracW / 2 + 4} y1={0} x2={tracW / 2 - 4} y2={0} stroke={RED} strokeWidth={6} strokeLinecap="round" />
        ) : (
          // Terbuka (udara lewat)
          <g>
            <polygon points={`${-tracW / 2 + 4},-8 0,-2 ${-tracW / 2 + 4},4`} fill={ISO.organ[0]} />
            <polygon points={`${tracW / 2 - 4},-8 0,-2 ${tracW / 2 - 4},4`} fill={ISO.organ[0]} />
          </g>
        )}
      </g>

      {/* Cabang Bronkus utama */}
      <path d={`M ${x} ${tracBot} Q ${x - u * 0.18} ${tracBot + 30} ${x - u * 0.42} ${y - u * 0.05}`} fill="none" stroke={ISO.plastic[0]} strokeWidth={12} strokeLinecap="round" />
      <path d={`M ${x} ${tracBot} Q ${x + u * 0.18} ${tracBot + 30} ${x + u * 0.42} ${y - u * 0.05}`} fill="none" stroke={ISO.plastic[0]} strokeWidth={12} strokeLinecap="round" />

      {/* Paru-Paru Kiri & Kanan (2.5D Relief Polygons) */}
      <ReliefPolygon pts={lungLeftPts} tones={ISO.organ} depth={16} />
      <ReliefPolygon pts={lungRightPts} tones={ISO.organ} depth={16} />

      {/* Garis lekukan lobus paru */}
      <path d={`M ${x - u * 0.75} ${y - u * 0.1} Q ${x - u * 0.5} ${y + u * 0.05} ${x - u * 0.25} ${y + u * 0.02}`} fill="none" stroke={ISO.organ[2]} strokeWidth={4} strokeLinecap="round" />
      <path d={`M ${x + u * 0.75} ${y - u * 0.1} Q ${x + u * 0.5} ${y + u * 0.05} ${x + u * 0.25} ${y + u * 0.02}`} fill="none" stroke={ISO.organ[2]} strokeWidth={4} strokeLinecap="round" />

      {/* Highlight kilap atas paru */}
      <path d={`M ${x - u * 0.65} ${y - u * 0.32} Q ${x - u * 0.45} ${y - u * 0.44} ${x - u * 0.25} ${y - u * 0.38}`} fill="none" stroke={WHITE} strokeWidth={6} strokeLinecap="round" opacity={0.65} />
      <path d={`M ${x + u * 0.65} ${y - u * 0.32} Q ${x + u * 0.45} ${y - u * 0.44} ${x + u * 0.25} ${y - u * 0.38}`} fill="none" stroke={WHITE} strokeWidth={6} strokeLinecap="round" opacity={0.65} />

      {/* Otot Diafragma (kubah berotot dengan ketebalan 2.5D) */}
      <g>
        {/* Lapisan bayangan bawah diafragma */}
        <path d={diaphragmPath} fill={ISO.organ[2]} transform="translate(6 10)" opacity={0.7} />
        {/* Lapisan utama diafragma */}
        <path d={diaphragmPath} fill={spasm > 0.4 ? RED : ISO.organ[1]} stroke={G1} strokeWidth={3} />
        {/* Tendon pusat putih di puncak kubah */}
        <ellipse cx={x} cy={domeApexY + dThick * 0.45} rx={u * 0.28} ry={dThick * 0.32} fill={WHITE} opacity={0.85} />
        {/* Garis serat otot diafragma radial */}
        {[-0.6, -0.3, 0.3, 0.6].map((k, i) => (
          <line
            key={i}
            x1={x + u * k * 0.5}
            y1={domeApexY + dThick * 0.4}
            x2={x + u * k * 1.15}
            y2={domeBaseY + dThick * 0.5}
            stroke={ISO.organ[2]}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Efek visual sentakan cegukan (gelombang kejut kuning & tanda panah sentak saat spasme) */}
      {spasm > 0.5 && (
        <g>
          <ellipse cx={x} cy={domeApexY + 20} rx={u * 0.85} ry={35} fill="none" stroke={YELLOW} strokeWidth={6} opacity={spasm} />
          {/* Panah arah sentak ke bawah */}
          <path d={`M ${x} ${domeApexY - 20} L ${x} ${domeApexY + 30} M ${x - 14} ${domeApexY + 16} L ${x} ${domeApexY + 30} L ${x + 14} ${domeApexY + 16}`} fill="none" stroke={BLACK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
};

/** Floating text badge. */
const FloatLabel: React.FC<{ text: string; x: number; y: number; fs: number; t: number; from: number; color?: string; bg?: string }> = ({
  text, x, y, fs, t, from, color = BLACK, bg,
}) => {
  const p = springAt(t, from, false);
  if (p <= 0.001) return null;
  const bob = bobPx(t, 0.3, 5);
  const padX = fs * 0.5;
  const h = fs * 1.4;
  const w = text.length * fs * 0.58 + padX * 2;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${Math.max(0, p)}) translate(${-x} ${-y - bob})`}>
      {bg && <rect x={x - w / 2} y={y + bob - h / 2} width={w} height={h} rx={h / 2} fill={bg} />}
      <text x={x} y={y + bob + 2} fontSize={fs} fill={color} textAnchor="middle" dominantBaseline="central" style={bold}>{text}</text>
    </g>
  );
};

/** Circle insert for detail moments (IsoBrain or IsoHeart). */
const CircleInsert: React.FC<{ P: Plan; kind: string; t: number; from: number; to: number }> = ({ P, kind, t, from, to }) => {
  const sm = (k: number) => k * k * (3 - 2 * k);
  const ramp = (v: number, a: number, d: number) => Math.max(0, Math.min(1, (v - a) / d));
  const k = sm(Math.min(ramp(t, from, 0.5), ramp(to - t, 0, 0.4)));
  if (k <= 0.001) return null;
  const [cx, cy] = P.HERO;
  const clipId = `ins-${kind}`;
  const r = 1700 * k;
  return (
    <g>
      <defs><clipPath id={clipId}><circle cx={P.originX} cy={P.originY} r={r} /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={W} height={H} fill={WALL} />
        <Brand clock={t} spot={{ x: cx, y: cy, r: 460 }} />
        {kind === "brain" && <IsoBrain u={260} o={[cx, cy]} t={t} busy={0.8} />}
        {kind === "heart" && <IsoHeart u={230} o={[cx, cy]} t={t} bpm={84} />}
      </g>
    </g>
  );
};

const Picture: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => {
  useFonts();
  const frame = useCurrentFrame(), t = frame / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const { m } = P;
  const beat = s.beats.find((b) => t >= P.beat(b.id).a && t < P.beat(b.id).b) ?? s.beats[s.beats.length - 1];
  const bt = t - P.beat(beat.id).a;
  const top = P.tops.find((x) => t >= x.a && t < x.b);
  const lw = P.loopWeight(t);
  const [hx, hy] = P.HERO;

  // Waktu efektif yang menyatu kembali ke t = 0 saat loop (outro)
  const tEff = (1 - lw) * t;

  // Logika spasme diafragma berdasarkan beat
  let spasm = 0;
  let glottisClosed = false;

  if (beat.id === "hook") {
    // Spasme cegukan di detik ke-1.0 s/d 1.5 (t = 0 mulai dalam keadaan tenang)
    if (bt >= 1.0 && bt < 1.6) {
      const p = (bt - 1.0) / 0.6;
      spasm = Math.sin(p * Math.PI);
      glottisClosed = true;
    }
  } else if (beat.id === "diafragma") {
    // Spasme kuat saat kata "kontraksi mendadak" disebut (t ~ 2.8s ke atas)
    const p = clamp01((bt - 2.6) / 0.4);
    spasm = p > 0 && p < 1 ? Math.sin(p * Math.PI) : ((bt > 4) ? 0.3 * Math.sin(bt * 8) : 0);
  } else if (beat.id === "bunyi") {
    // Pita suara menutup tiba-tiba & bunyi hik! (t ~ 3s)
    const p = clamp01((bt - 3.0) / 0.5);
    spasm = p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
    glottisClosed = bt >= 2.0 && bt <= 4.2;
  } else if (beat.id === "outro") {
    // Outro kembali tenang menuju t = 0 (loop-back sempurna)
    spasm = 0;
    glottisClosed = false;
  }

  // Insert brain (pusat kendali refleks) & heart (janin)
  const insKind = beat.id === "janin" ? "heart" : (beat.id === "diafragma" && bt >= 0.8 && bt < 2.4) ? "brain" : null;
  const insFrom = insKind ? P.beat(beat.id).a + (beat.id === "janin" ? 0.4 : 0.8) : 0;
  const insTo = insKind ? (beat.id === "janin" ? P.beat(beat.id).b - 0.2 : P.beat(beat.id).a + 2.4) : 0;

  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        {/* Brand Wall background */}
        <g opacity={1 - lw}><Brand clock={t} spot={{ x: 540, y: 920, r: 480 }} /></g>
        {lw > 0 && <g opacity={lw}><Brand clock={0} spot={{ x: 540, y: 920, r: 480 }} /></g>}

        {/* HERO: IsoDiaphragm & Lungs (Paru-paru & Otot Diafragma) */}
        {!insKind && (
          <IsoDiaphragm
            x={hx}
            y={hy - 30}
            u={260}
            t={tEff}
            spasm={spasm * (1 - lw)}
            glottisClosed={glottisClosed && lw < 0.5}
          />
        )}

        {/* Insert Layer (IsoBrain untuk pusat saraf, IsoHeart untuk janin) */}
        {insKind && <CircleInsert P={P} kind={insKind} t={t} from={insFrom} to={insTo} />}

        {/* Overlay beat diafragma: Label penunjuk */}
        {beat.id === "diafragma" && bt >= 2.4 && (
          <g>
            <FloatLabel text="kontraksi mendadak!" x={540} y={hy + 210} fs={58} t={t} from={P.beat("diafragma").a + 2.6} color={BLACK} bg={YELLOW} />
            <FloatLabel text="diafragma" x={540} y={hy + 120} fs={68} t={t} from={P.beat("diafragma").a + 2.5} color={WHITE} bg={RED} />
          </g>
        )}

        {/* Overlay beat bunyi: Pita suara menutup & bunyi hik! */}
        {beat.id === "bunyi" && (
          <g>
            {bt >= 0.8 && <FloatLabel text="udara masuk cepat" x={540} y={hy - 340} fs={56} t={t} from={P.beat("bunyi").a + 0.8} />}
            {bt >= 1.8 && <FloatLabel text="katup suara menutup!" x={540} y={hy - 260} fs={60} t={t} from={P.beat("bunyi").a + 1.8} color={BLACK} bg={YELLOW} />}
            {bt >= 3.0 && <FloatLabel text="HIK!" x={540} y={hy + 220} fs={140} t={t} from={P.beat("bunyi").a + 3.0} color={BLACK} bg={YELLOW} />}
          </g>
        )}

        {/* Overlay beat janin (di atas insert heart) */}
        {beat.id === "janin" && (
          <g>
            <FloatLabel text="dalam kandungan" x={540} y={640} fs={62} t={t} from={P.beat("janin").a + 0.6} />
            <FloatLabel text="9 minggu" x={540} y={880} fs={140} t={t} from={P.beat("janin").a + 1.2} color={BLACK} bg={YELLOW} />
            <FloatLabel text="latihan diafragma" x={540} y={1200} fs={60} t={t} from={P.beat("janin").a + 3.4} />
          </g>
        )}

        {/* Overlay beat rekor (Charles Osborne) */}
        {beat.id === "rekor" && (
          <g>
            <FloatLabel text="68 tahun" x={540} y={hy - 240} fs={140} t={t} from={P.beat("rekor").a + 0.5} color={BLACK} bg={YELLOW} />
            <FloatLabel text="1922 – 1990" x={540} y={hy + 180} fs={66} t={t} from={P.beat("rekor").a + 1.6} />
            <FloatLabel text="Charles Osborne, AS" x={540} y={hy + 260} fs={52} t={t} from={P.beat("rekor").a + 2.8} />
          </g>
        )}

        {/* Overlay beat tips */}
        {beat.id === "tips" && (() => {
          const s1 = springAt(t, P.beat("tips").a + 0.6, false);
          const s2 = springAt(t, P.beat("tips").a + 4.2, false);
          const tip1y = 520 + bobPx(t, 0.1, 4);
          const tip2y = 1350 + bobPx(t, 0.5, 4);
          return (
            <g>
              {s1 > 0.001 && (
                <g>
                  <circle cx={110} cy={tip1y} r={54} fill={YELLOW} opacity={Math.max(0, s1)} />
                  <text x={110} y={tip1y} fontSize={60} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>1</text>
                  <g transform={`translate(200 ${tip1y}) scale(${Math.max(0, s1)}) translate(-200 ${-tip1y})`}>
                    <text x={200} y={tip1y} fontSize={56} fill={BLACK} textAnchor="start" dominantBaseline="central" style={bold}>tahan napas sejenak</text>
                  </g>
                  <g transform={`translate(200 ${tip1y + 65}) scale(${Math.max(0, easeInOut(clamp01((t - P.beat("tips").a - 0.9) / 0.3)))}) translate(-200 ${-(tip1y + 65)})`}>
                    <text x={200} y={tip1y + 65} fontSize={46} fill={G2} textAnchor="start" dominantBaseline="central" style={bold}>naikkan CO₂</text>
                  </g>
                </g>
              )}
              {s2 > 0.001 && (
                <g>
                  <circle cx={110} cy={tip2y} r={54} fill={YELLOW} opacity={Math.max(0, s2)} />
                  <text x={110} y={tip2y} fontSize={60} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>2</text>
                  <g transform={`translate(200 ${tip2y}) scale(${Math.max(0, s2)}) translate(-200 ${-tip2y})`}>
                    <text x={200} y={tip2y} fontSize={56} fill={BLACK} textAnchor="start" dominantBaseline="central" style={bold}>minum air perlahan</text>
                  </g>
                </g>
              )}
            </g>
          );
        })()}

        {/* Mascot & Pill Sting (Intip yuk!) */}
        {t >= m.sting - 0.1 && t < m.stingEnd + 0.15 && (() => {
          const S = P.STING, p = springAt(t, m.sting), out2 = 1 - easeInOut(clamp01((t - m.stingEnd + 0.18) / 0.25));
          return (
            <g>
              <g transform={`translate(${S.mx} ${S.my}) scale(${Math.max(0, p) * out2}) translate(${-S.mx} ${-S.my})`}>
                <Mascot x={S.mx} y={S.my} w={S.mw} expr="curious" t={t - m.sting} clock={t} squash={0.18 * (1 - p)} />
              </g>
              <g transform={`translate(${S.px} ${S.py}) scale(${Math.max(0, springAt(t, m.sting + 0.25)) * out2}) translate(${-S.px} ${-S.py})`}>
                <rect x={S.px - S.pillW / 2} y={S.py - 46} width={S.pillW} height={92} rx={46} fill={YELLOW} />
                <text x={S.px} y={S.py + 18} fontSize={S.fs} textAnchor="middle" fill={BLACK} style={bold}>{P.stingPill}</text>
              </g>
            </g>
          );
        })()}

        {/* Top text & Captions */}
        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={t - top.a} />}
        {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={bt} />}
      </svg>
      {layoutDebug && <LayoutDebug report={{ moved: new Map(), problems: [], boxes: [] }} hasBanner={!!top} />}
    </div>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => <Picture story={s} layoutDebug={layoutDebug} />;
