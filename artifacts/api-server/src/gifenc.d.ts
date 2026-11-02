declare module "gifenc" {
  export interface GifEncoder {
    writeFrame(
      pixels: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: number[][];
        delay?: number;
        repeat?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoder;
  export function quantize(
    rgba: Uint8Array,
    maxColors: number,
    options?: { format?: "rgb565" | "rgb444" | "rgba4444" },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;
}
