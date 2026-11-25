/* The picture was timed to the first voice; the second voice (Pak Sugeng, 2026-11-25) is a little slower. ANCHORS pairs a moment of the first timing with the same moment of
   the new voice (the cut of every shot), and the scene is played in the old time: toOld(new time) for the camera, the people and the sound, toNew(old time) for what keys to words. */
export const ANCHORS: [number, number][] = [[0.0, 0.0], [3.98, 5.17], [5.98, 7.22], [8.36, 9.46], [11.54, 12.82], [13.06, 14.54], [14.46, 16.48], [17.24, 19.08], [19.08, 20.98], [20.26, 22.54], [21.46, 23.72], [24.72, 27.73], [26.28, 30.02], [29.24, 32.74], [30.38, 33.44], [32.28, 35.7], [34.66, 37.64], [37.1, 40.08], [39.64, 42.42], [41.22, 44.02], [43.14, 46.04], [44.46, 47.58], [46.58, 49.56], [47.36, 50.6], [50.14, 53.66]];
const run = (t: number, from: 0 | 1, to: 0 | 1) => {
  const A = ANCHORS;
  if (t <= A[0][from]) return t - A[0][from] + A[0][to];
  for (let i = 1; i < A.length; i++) if (t <= A[i][from]) { const [p, q] = [A[i - 1], A[i]]; return p[to] + ((t - p[from]) / (q[from] - p[from])) * (q[to] - p[to]); }
  const l = A[A.length - 1]; return t - l[from] + l[to];
};
export const toOld = (t: number) => run(t, 1, 0);
export const toNew = (t: number) => run(t, 0, 1);
