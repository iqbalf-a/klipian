export function writeWav(file: string, channels: Float32Array[], rate: number): void;
export function readWav(file: string): { channels: Float32Array[]; rate: number };
