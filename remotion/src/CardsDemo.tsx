/* The cards, pointer labels and written sounds on one screen, for looking at them (npm run assets-sheet renders it too). Not part of a story. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FRAME, FONT_MONO, G3 } from "./tokens.ts";
import { Brand } from "./components/Backgrounds.tsx";
import { BarChart, CalendarCard, LineChart, NumberCard, Onomatopoeia, PointerLabel, SearchCard, SourceCard } from "./components/Cards.tsx";
import { SocketOutside } from "./components/Socket.tsx";
import { CaptionLayer, TopText } from "./components/Captions.tsx";
import { FPS } from "./timeline.ts";
import { useFonts } from "./FunFact.tsx";

export const CardsDemo: React.FC = () => {
  useFonts();
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        <Brand clock={t} />
        <TopText kicker="pin cuma nempel di" headline="Tiga kartu data" t={t} />
        <g transform="scale(0.66)">
          <SourceCard x={30} y={420} quote="Sambungan yang longgar menaikkan hambatan dan membuatnya panas." org="Badan keselamatan konsumen" domain="cpsc.gov" date="2023" t={t} start={0.1} />
          <SearchCard x={820} y={420} query="kenapa colokan panas" results={[{ title: "Tanda colokan longgar dan cara mengatasinya", domain: "esfi.org" }, { title: "Kontak longgar penyebab panas", domain: "cpsc.gov" }]} t={t} start={0.3} />
          <NumberCard x={30} y={880} label="Suhu titik kontak" value={96} unit="°C" note="batas aman 70 °C" t={t} start={0.5} accent="red" />
          <CalendarCard x={820} y={880} month="Oktober" startDay={3} highlight={[8, 9, 10]} t={t} start={0.7} />
          <BarChart x={30} y={1490} w={760} h={460} title="Hambatan kontak" bars={[{ label: "rapat", value: 20 }, { label: "longgar", value: 85, hot: true }]} unit="" t={t} start={0.9} />
          <LineChart x={820} y={1490} w={760} h={460} title="Suhu naik" points={[28, 30, 36, 48, 70, 96]} labels={["0 mnt", "30 mnt"]} hot t={t} start={1.1} />
        </g>
        <g transform="translate(270 1440)"><g transform="scale(0.9)"><SocketOutside /></g></g>
        <PointerLabel text="titik panas" x={720} y={1360} ax={290} ay={1445} magnify red t={t} start={1.3} />
        <Onomatopoeia text="PLOK!" x={760} y={1500} fs={72} t={t} start={1.5} />
        <CaptionLayer beat={{ narration: "Sambungan yang longgar bikin titik kontaknya panas banget", dur: 4 }} t={t + 1.2} />
        <text x={40} y={1888} fontSize={20} fill={G3} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>cards · pointer label · onomatopoeia · captions · top text</text>
      </svg>
    </AbsoluteFill>
  );
};
