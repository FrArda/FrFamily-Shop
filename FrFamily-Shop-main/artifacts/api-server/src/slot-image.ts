import { readFile } from "node:fs/promises";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import sharp from "sharp";

export const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

const REEL_CENTERS = [370, 536, 697];
const REEL_TOP = 493;
const REEL_WIDTH = 120;
const REEL_HEIGHT = 174;

let machineImage: Promise<Buffer> | undefined;

export function randomSlotSymbol(): SlotSymbol {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
}

function symbolArtwork(symbol: SlotSymbol, x: number, y: number): string {
  const start = `<g transform="translate(${x} ${y})" filter="url(#symbolShadow)">`;
  const end = "</g>";

  switch (symbol) {
    case "7️⃣":
      return `${start}
        <path d="M-49 -56 H49 V-31 L13 52 H-25 L11 -20 H-49 Z"
          fill="url(#sevenFill)" stroke="#fff0a3" stroke-width="8" stroke-linejoin="round"/>
        <path d="M-49 -56 H49 V-38 H-49 Z" fill="#ffffff" opacity=".72"/>
        ${end}`;
    case "🍒":
      return `${start}
        <path d="M-4 3 C-9 -36 -26 -53 -33 -67 M1 3 C3 -34 25 -47 34 -65"
          fill="none" stroke="#69db76" stroke-width="9" stroke-linecap="round"/>
        <path d="M-23 -70 C-46 -91 -65 -71 -52 -57 C-36 -51 -24 -60 -23 -70"
          fill="#75d96f" stroke="#e0ff98" stroke-width="3"/>
        <circle cx="-27" cy="23" r="37" fill="url(#cherryFill)" stroke="#ffbec1" stroke-width="4"/>
        <circle cx="29" cy="20" r="37" fill="url(#cherryFill)" stroke="#ffbec1" stroke-width="4"/>
        <ellipse cx="-39" cy="8" rx="9" ry="14" fill="#fff" opacity=".7"/>
        <ellipse cx="17" cy="5" rx="9" ry="14" fill="#fff" opacity=".7"/>
        ${end}`;
    case "🍋":
      return `${start}
        <path d="M-62 0 C-43 -18 -41 -42 -13 -44 C5 -64 31 -43 52 -31 C67 -14 62 10 51 28 C31 47 2 53 -23 43 C-47 35 -61 18 -62 0 Z"
          fill="url(#lemonFill)" stroke="#fff2a2" stroke-width="5"/>
        <path d="M-17 -44 C-1 -69 27 -71 42 -57 C24 -39 5 -35 -17 -44 Z"
          fill="#60c96b" stroke="#b7f27e" stroke-width="4"/>
        <path d="M-38 4 C-15 -13 11 -15 39 -7" fill="none" stroke="#fff7cc" stroke-width="6" opacity=".7"/>
        ${end}`;
    case "🔔":
      return `${start}
        <path d="M-49 32 Q-33 15 -30 -17 Q-26 -56 0 -62 Q26 -56 30 -17 Q33 15 49 32 Z"
          fill="url(#bellFill)" stroke="#fff0a5" stroke-width="6" stroke-linejoin="round"/>
        <path d="M-51 34 H51 Q48 48 34 49 H-34 Q-48 47 -51 34 Z"
          fill="#ed9b24" stroke="#ffe6a0" stroke-width="4"/>
        <path d="M-13 -62 Q0 -82 13 -62" fill="none" stroke="#fff0a5" stroke-width="8" stroke-linecap="round"/>
        <circle cx="0" cy="54" r="10" fill="#ffcc47" stroke="#fff0a5" stroke-width="3"/>
        ${end}`;
    case "⭐":
      return `${start}
        <path d="M0 -68 L20 -22 L68 -18 L32 13 L44 61 L0 36 L-44 61 L-32 13 L-68 -18 L-20 -22 Z"
          fill="url(#starFill)" stroke="#fff7b1" stroke-width="6" stroke-linejoin="round"/>
        <path d="M-18 -20 L0 -54 L7 -12 Z" fill="#fff" opacity=".45"/>
        ${end}`;
    case "💎":
      return `${start}
        <path d="M-60 -24 L-35 -56 H35 L60 -24 L0 63 Z"
          fill="url(#diamondFill)" stroke="#c8ffff" stroke-width="6" stroke-linejoin="round"/>
        <path d="M-35 -56 L-24 -20 L0 63 L0 -56 Z" fill="#fff" opacity=".32"/>
        <path d="M35 -56 L24 -20 L0 63 L0 -56 Z" fill="#38b9ef" opacity=".45"/>
        <path d="M-60 -24 H60" stroke="#e8ffff" stroke-width="5"/>
        ${end}`;
  }
}

function slotOverlay(reels: readonly SlotSymbol[]): string {
  const reelBackgrounds = REEL_CENTERS.map((center) => {
    const x = center - REEL_WIDTH / 2;
    return `<g>
      <rect x="${x - 4}" y="${REEL_TOP - 4}" width="${REEL_WIDTH + 8}" height="${REEL_HEIGHT + 8}" rx="13"
        fill="#10213c" stroke="#ffe08a" stroke-width="5"/>
      <rect x="${x}" y="${REEL_TOP}" width="${REEL_WIDTH}" height="${REEL_HEIGHT}" rx="9"
        fill="url(#reelFill)" stroke="#d59635" stroke-width="3"/>
      <path d="M${x + 8} ${REEL_TOP + 13} H${x + REEL_WIDTH - 8}"
        stroke="#fff2c5" stroke-width="4" opacity=".42"/>
      <path d="M${x + 8} ${REEL_TOP + REEL_HEIGHT - 13} H${x + REEL_WIDTH - 8}"
        stroke="#090d1a" stroke-width="4" opacity=".55"/>
    </g>`;
  }).join("");

  const symbols = reels.map((symbol, index) =>
    symbolArtwork(symbol, REEL_CENTERS[index], REEL_TOP + REEL_HEIGHT / 2),
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1100" viewBox="0 0 1100 1100">
    <defs>
      <linearGradient id="reelFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#272847"/>
        <stop offset=".46" stop-color="#11172b"/>
        <stop offset="1" stop-color="#29203b"/>
      </linearGradient>
      <linearGradient id="sevenFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff5770"/>
        <stop offset=".5" stop-color="#e9163b"/>
        <stop offset="1" stop-color="#a90b29"/>
      </linearGradient>
      <radialGradient id="cherryFill" cx=".32" cy=".25" r=".8">
        <stop offset="0" stop-color="#ff737d"/>
        <stop offset=".42" stop-color="#f01e45"/>
        <stop offset="1" stop-color="#9a082e"/>
      </radialGradient>
      <linearGradient id="lemonFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff188"/>
        <stop offset=".5" stop-color="#ffda32"/>
        <stop offset="1" stop-color="#d99a10"/>
      </linearGradient>
      <linearGradient id="bellFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff2a1"/>
        <stop offset=".48" stop-color="#ffbf39"/>
        <stop offset="1" stop-color="#cc6b13"/>
      </linearGradient>
      <linearGradient id="starFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff18a"/>
        <stop offset=".45" stop-color="#ffbf31"/>
        <stop offset="1" stop-color="#e87518"/>
      </linearGradient>
      <linearGradient id="diamondFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e6ffff"/>
        <stop offset=".42" stop-color="#60e3ff"/>
        <stop offset="1" stop-color="#2173db"/>
      </linearGradient>
      <filter id="symbolShadow" x="-.4" y="-.4" width="1.8" height="1.8">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/>
        <feOffset dy="5" result="offset"/>
        <feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="marquee" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#173b8f"/>
        <stop offset="1" stop-color="#07183f"/>
      </linearGradient>
    </defs>
    <rect x="329" y="218" width="442" height="88" rx="32" fill="url(#marquee)" stroke="#ffd45c" stroke-width="5"/>
    <text x="550" y="278" text-anchor="middle" font-family="DejaVu Sans, sans-serif"
      font-size="48" font-weight="900" letter-spacing="3" fill="#ffd764" stroke="#8d230f"
      stroke-width="3" paint-order="stroke">FR FAMILY</text>
    ${reelBackgrounds}
    ${symbols}
  </svg>`;
}

export async function renderSlotMachineImage(reels: readonly SlotSymbol[]): Promise<Buffer> {
  if (reels.length !== 3) throw new Error("Slot image needs exactly three reel symbols");
  const baseImage = machineImage ??= readFile(
    new URL("../public/shop-assets/fr-family-slot-machine.jpg", import.meta.url),
  );
  const image = await baseImage;
  return sharp(image)
    .composite([{ input: Buffer.from(slotOverlay(reels)) }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export async function renderSlotMachineGif(finalReels: readonly SlotSymbol[]): Promise<Buffer> {
  if (finalReels.length !== 3) throw new Error("Slot GIF needs exactly three final symbols");

  const width = 320;
  const height = 320;
  const timeline: Array<{ reels: SlotSymbol[]; delay: number }> = [];

  for (let frame = 0; frame < 7; frame += 1) {
    timeline.push({
      reels: [randomSlotSymbol(), randomSlotSymbol(), randomSlotSymbol()],
      delay: 80,
    });
  }
  for (let frame = 0; frame < 5; frame += 1) {
    timeline.push({
      reels: [finalReels[0], randomSlotSymbol(), randomSlotSymbol()],
      delay: 95,
    });
  }
  for (let frame = 0; frame < 4; frame += 1) {
    timeline.push({
      reels: [finalReels[0], finalReels[1], randomSlotSymbol()],
      delay: 110,
    });
  }
  timeline.push({ reels: [...finalReels], delay: 1_800 });

  const baseImage = machineImage ??= readFile(
    new URL("../public/shop-assets/fr-family-slot-machine.jpg", import.meta.url),
  );
  const image = await baseImage;
  const resizedMachine = await sharp(image).resize(width, height).png().toBuffer();
  const rgbaFrames: Buffer[] = [];

  for (const frame of timeline) {
    const overlay = await sharp(Buffer.from(slotOverlay(frame.reels)))
      .resize(width, height)
      .png()
      .toBuffer();
    const pixels = await sharp(resizedMachine)
      .composite([{ input: overlay }])
      .ensureAlpha()
      .raw()
      .toBuffer();
    rgbaFrames.push(pixels);
  }

  // A shared palette keeps the photo and symbols from shifting color between frames.
  const palette = quantize(Buffer.concat(rgbaFrames), 256, { format: "rgb565" });
  const encoder = GIFEncoder();
  for (let index = 0; index < rgbaFrames.length; index += 1) {
    const indexedPixels = applyPalette(rgbaFrames[index], palette, "rgb565");
    encoder.writeFrame(indexedPixels, width, height, {
      ...(index === 0 ? { palette, repeat: -1 } : {}),
      delay: timeline[index].delay,
    });
  }
  encoder.finish();
  return Buffer.from(encoder.bytes());
}
