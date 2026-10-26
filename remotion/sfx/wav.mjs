/* Minimal WAV reading and writing (16-bit PCM, any channel count) for the sound effects and the mixer. */
import { readFileSync, writeFileSync } from "node:fs";

export function writeWav(file, channels, rate) {
  const n = channels[0].length, ch = channels.length, data = Buffer.alloc(n * ch * 2);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, channels[c][i]));
    data.writeInt16LE(Math.round(v * 32767), (i * ch + c) * 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); head.writeUInt16LE(ch, 22); head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * ch * 2, 28);
  head.writeUInt16LE(ch * 2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([head, data]));
}

export function readWav(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${file}: not a WAV file`);
  let pos = 12, ch = 1, rate = 48000, bits = 16, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4), size = b.readUInt32LE(pos + 4);
    if (id === "fmt ") { ch = b.readUInt16LE(pos + 10); rate = b.readUInt32LE(pos + 12); bits = b.readUInt16LE(pos + 22); }
    if (id === "data") { data = b.subarray(pos + 8, pos + 8 + size); break; }
    pos += 8 + size + (size & 1);
  }
  if (!data || bits !== 16) throw new Error(`${file}: only 16-bit PCM is supported`);
  const n = Math.floor(data.length / (2 * ch)), out = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c][i] = data.readInt16LE((i * ch + c) * 2) / 32768;
  return { channels: out, rate };
}
