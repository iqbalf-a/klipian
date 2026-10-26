/* When things happen in the Dissect3D composition, as plain numbers (seconds): the sound effects read these, and Dissect3D.tsx uses the same
   constants, so what is heard is what is seen. No React or three here: tests and the mixer import this file. */
export const DISSECT_SECONDS = 7.5;
export const SPLIT_AT = 2.0;                       // the shell comes apart (front, then back 0.1 s later)
export const PARTS_AT = 3.0;                       // the parts inside separate, one after another
export const PART_AT = { pcb: PARTS_AT, trafo: PARTS_AT + 0.15, cap1: PARTS_AT + 0.45, cap2: PARTS_AT + 0.75, chip: PARTS_AT + 1.05 } as const;
export const HEAT_FROM = 5.0, HEAT_FOR = 1.2;      // the chip heats up
/** Label times (seconds), in the order of LABELS in Dissect3D.tsx; the last one is the danger label. */
export const LABEL_AT = [2.5, 3.5, 3.9, 4.2, 4.4, 4.6, 5.8] as const;
