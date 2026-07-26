import { jsPDF } from "jspdf";
import type { MiniFigEntry, CreatureSize, PaperFormat } from "./types";

const FONT_FAMILY = "MedievalSharp, serif";
const FONT_URL =
  "https://fonts.gstatic.com/s/medievalsharp/v26/EvOJzAlL3oU5AQl2mP5KdgptAq96MwvX.ttf";

const fontReady = document.fonts.load(`bold 20px ${FONT_FAMILY}`);

let jspdfFontLoaded = false;
async function ensureJsPdfFont(pdf: jsPDF) {
  if (jspdfFontLoaded) {
    pdf.setFont("MedievalSharp");
    return;
  }
  const resp = await fetch(FONT_URL);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  pdf.addFileToVFS("MedievalSharp.ttf", base64);
  pdf.addFont("MedievalSharp.ttf", "MedievalSharp", "normal");
  pdf.setFont("MedievalSharp");
  jspdfFontLoaded = true;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
const SPACING_MM = 0;

const PAPER_SIZES: Record<PaperFormat, { widthMm: number; heightMm: number }> =
  {
    a4: { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM },
    a3: { widthMm: 297, heightMm: 420 },
  };

// --- Band content sizing (millimetres) ---
const LABEL_HEIGHT_MM = 6; // height reserved for the name label text
const NUMBER_HEIGHT_MM = 10; // height reserved for the quantity number text
const STAND_BUFFER_MM = 10; // solid spacer at the outer end of each band (the "stand"/tab)
const LABEL_GAP_MM = 2; // gap between the figure edge and the label block

const SCALE = 12; // canvas pixels per millimetre (mm → px conversion for rendering)
const LABEL_PX = LABEL_HEIGHT_MM * SCALE;
const NUMBER_PX = NUMBER_HEIGHT_MM * SCALE;
const BUFFER_PX = STAND_BUFFER_MM * SCALE;
const GAP_PX = LABEL_GAP_MM * SCALE;

// ---------------------------------------------------------------------------
// LAYOUT GLOSSARY — shared vocabulary for one printed miniature
// ---------------------------------------------------------------------------
// A single miniature is rendered as a vertical, foldable strip. From top to
// bottom it is composed of these regions (all the code below uses these names):
//
//   1. TOP BAND        — decorative reflection area above the back figure.
//                        It shows a blurred, darkened copy of the figure's
//                        lower edge ("strip") and also holds the fold-side
//                        label/number text (rotated 180°).
//   2. BACK FIGURE     — the figure image drawn upside-down (vertically
//                        mirrored). This is the half you see through the paper
//                        after folding; it sits above the fold line.
//   3. FRONT FIGURE    — the figure image drawn right-side-up. This is the
//                        main, sharp image the viewer looks at.
//   4. BOTTOM BAND     — decorative reflection area below the front figure.
//                        Mirror of the TOP BAND: blurred strip + labels.
//
// STRIP — a thin slice sampled from the *bottom edge* of the source artwork
//         (see renderEdgeStrip). Both bands are built from this same strip so
//         the reflection reads as if the figure is standing on/in a surface.
//
// FADE ZONE — the overlapping pixels where a band blends into the adjacent
//             figure so there is no hard seam between band and figure.
// ---------------------------------------------------------------------------

// --- Reflection band tuning (TOP BAND + BOTTOM BAND) ---
// Blur strength of the reflected STRIP, as a fraction of the strip width.
// This is the value to change to make the reflected images more/less blurry.
const BLUR_RADIUS_FACTOR = 0.025;
// Opacity of the black overlay painted over each band (0 = none, 1 = solid).
// Higher = darker reflections and more contrast for the band's white text.
const OVERLAY_ALPHA = 0.5;
// Height of the FADE ZONE (band↔figure blend), as a fraction of figure height.
// Higher = longer, softer transition; lower = shorter, more abrupt seam.
const FADE_ZONE_FACTOR = 0.18;

// Multipliers scale the base miniSize to the creature's tile footprint.
// D&D 5e: 1 tile = 5 ft. For a Medium creature at miniSize mm scale,
// each tile is miniSize mm wide. Footprints in tiles:
// tiny=0.5 (2.5ft), small/medium=1 (5ft), large=2 (10ft),
// huge=3 (15ft), gargantuan=4 (20ft).
const CREATURE_SIZE_MULTIPLIERS: Record<CreatureSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

export function getEffectiveWidthMm(entry: MiniFigEntry): number {
  return entry.miniSize * CREATURE_SIZE_MULTIPLIERS[entry.creatureSize];
}

export function getUsablePageWidthMm(format: PaperFormat): number {
  return PAPER_SIZES[format].widthMm - PAGE_MARGIN_MM * 2;
}

export function isEntryOversized(
  entry: MiniFigEntry,
  format: PaperFormat,
): boolean {
  return getEffectiveWidthMm(entry) > getUsablePageWidthMm(format);
}

function imageHeightMm(img: HTMLImageElement, widthMm: number): number {
  return widthMm * (img.height / img.width);
}

/**
 * Height of the FADE ZONE in pixels (band↔figure blend), derived from the
 * figure height via FADE_ZONE_FACTOR, with a small minimum.
 */
function getFadeZonePx(widthPx: number, img: HTMLImageElement): number {
  return Math.max(
    12,
    Math.round(widthPx * (img.height / img.width) * FADE_ZONE_FACTOR),
  );
}

function miniHeightMm(
  img: HTMLImageElement,
  widthMm: number,
  showName: boolean,
  hasNumber: boolean,
): number {
  const imgH = imageHeightMm(img, widthMm);
  let labels = 0;
  if (showName || hasNumber) labels += LABEL_GAP_MM;
  if (showName) labels += LABEL_HEIGHT_MM;
  if (hasNumber) labels += NUMBER_HEIGHT_MM;
  return STAND_BUFFER_MM + labels + imgH * 2 + labels + STAND_BUFFER_MM;
}

export function getEntryImageSource(entry: MiniFigEntry): string | null {
  return entry.imageDataUrl || entry.imageUrl;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      const description = source.startsWith("data:")
        ? "embedded data URL"
        : source.length > 200
          ? `${source.slice(0, 197)}...`
          : source;
      reject(new Error(`Could not load image: ${description}`));
    };
    if (/^https?:\/\//i.test(source)) img.crossOrigin = "anonymous";
    img.src = source;
  });
}

/**
 * Builds the STRIP: samples a thin slice from the top or bottom edge of the
 * source artwork after scaling it to the target width. Both reflection bands
 * are built from this strip. `edge` selects which edge is sampled.
 */
function renderEdgeStrip(
  img: HTMLImageElement,
  w: number,
  h: number,
  edge: "top" | "bottom",
): HTMLCanvasElement {
  // Draw the full image scaled to target width
  const imgScaledH = Math.round(w * (img.naturalHeight / img.naturalWidth));
  const full = document.createElement("canvas");
  full.width = w;
  full.height = imgScaledH;
  const fctx = full.getContext("2d")!;
  fctx.drawImage(img, 0, 0, w, imgScaledH);

  // Crop the edge strip we care about
  const sy = edge === "bottom" ? Math.max(0, imgScaledH - h) : 0;
  const crop = document.createElement("canvas");
  crop.width = w;
  crop.height = h;
  const cctx = crop.getContext("2d")!;
  cctx.drawImage(full, 0, sy, w, h, 0, 0, w, h);

  return crop;
}

/**
 * Returns a blurred copy of the STRIP. Blur amount is BLUR_RADIUS_FACTOR of the
 * strip width. This is what makes the reflection bands look soft.
 *
 * The strip is rendered onto a canvas padded by the blur radius and overscanned
 * (content stretched to fill the padding) before blurring, then cropped back to
 * the original size. This keeps the blur from sampling transparent pixels at the
 * edges, which would otherwise leave a visible faded rim around each band.
 */
function renderBlurredStrip(source: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = source;
  const blurRadius = Math.max(2, Math.round(w * BLUR_RADIUS_FACTOR));
  // Pad generously (2x radius) so no transparent pixels fall within blur reach.
  const pad = blurRadius * 2;

  const padded = document.createElement("canvas");
  padded.width = w + pad * 2;
  padded.height = h + pad * 2;
  const pctx = padded.getContext("2d")!;
  pctx.filter = `blur(${blurRadius}px)`;
  // Overscan: stretch the strip to fill the padded area so content reaches the
  // edges instead of leaving transparent margins for the blur to bleed into.
  pctx.drawImage(source, 0, 0, w, h, 0, 0, w + pad * 2, h + pad * 2);
  pctx.filter = "none";

  // Crop back to the original strip size from the centre of the padded canvas.
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(padded, pad, pad, w, h, 0, 0, w, h);

  return canvas;
}

/**
 * Draws a strip into a context, optionally vertically mirrored (`flipY`).
 * Used to orient the reflected strip for the TOP BAND vs the BOTTOM BAND.
 */
function drawTransformedStrip(
  ctx: CanvasRenderingContext2D,
  strip: CanvasImageSource,
  height: number,
  transform: "none" | "flipY",
) {
  ctx.save();
  if (transform === "flipY") {
    ctx.translate(0, height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(strip, 0, 0);
  ctx.restore();
}

/**
 * Renders one reflection band (TOP BAND or BOTTOM BAND).
 *
 * The band = blurred STRIP + dark OVERLAY + a FADE ZONE that dissolves the
 * edge adjacent to the figure so band and figure blend seamlessly.
 * The returned canvas is `contentH + fadeZone` px tall.
 *
 * `side` = "top": solid content occupies the top `contentH` px; the bottom
 *   `fadeZone` px fade out (blending down into the BACK FIGURE below).
 * `side` = "bottom": solid content occupies the bottom `contentH` px; the top
 *   `fadeZone` px fade out (blending up into the FRONT FIGURE above).
 */
function renderFadedBlurBand(
  img: HTMLImageElement,
  w: number,
  contentH: number,
  fadeZone: number,
  side: "top" | "bottom",
): HTMLCanvasElement {
  const extH = contentH + fadeZone;
  // Both bands reflect away from the lower edge of the figure artwork.
  // For the top band, that lower-edge sample sits above the already mirrored
  // figure, so it should not be vertically flipped again.
  const edge = "bottom";
  const strip = renderEdgeStrip(img, w, extH, edge);
  // Blur the reflection strip itself so both bands read as soft reflections.
  const blur = renderBlurredStrip(strip);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = extH;
  const ctx = canvas.getContext("2d")!;

  drawTransformedStrip(ctx, blur, extH, side === "top" ? "none" : "flipY");

  ctx.fillStyle = `rgba(0, 0, 0, ${OVERLAY_ALPHA})`;
  ctx.fillRect(0, 0, w, extH);

  // Fade out the edge adjacent to the image for a smooth transition.
  ctx.globalCompositeOperation = "destination-out";
  if (side === "top") {
    const g = ctx.createLinearGradient(0, contentH, 0, extH);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.45, "rgba(0,0,0,0.18)");
    g.addColorStop(0.78, "rgba(0,0,0,0.62)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, contentH, w, fadeZone);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, fadeZone);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.22, "rgba(0,0,0,0.62)");
    g.addColorStop(0.55, "rgba(0,0,0,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, fadeZone);
  }
  ctx.globalCompositeOperation = "source-over";

  return canvas;
}

function fitCanvasFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
): number {
  let fs = startSize;
  ctx.font = `bold ${fs}px ${FONT_FAMILY}`;
  while (ctx.measureText(text).width > maxWidth && fs > 4) {
    fs -= 1;
    ctx.font = `bold ${fs}px ${FONT_FAMILY}`;
  }
  return fs;
}

function drawTextOnCtx(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
) {
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.fillText(text, x + w / 2, y + h / 2, w * 0.9);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

// --- Canvas preview ---

function drawMiniFigToCanvas(
  img: HTMLImageElement,
  name: string,
  showName: boolean,
  number: number | null,
  widthMm: number,
): HTMLCanvasElement {
  const widthPx = Math.round(widthMm * SCALE);
  const hasNumber = number != null;
  const hasName = showName && !!name;
  const imgPx = Math.round(widthPx * (img.height / img.width));

  let labels = 0;
  if (hasName || hasNumber) labels += GAP_PX;
  if (hasName) labels += LABEL_PX;
  if (hasNumber) labels += NUMBER_PX;
  const bandH = BUFFER_PX + labels;

  const totalW = widthPx;
  const fadeZone = getFadeZonePx(widthPx, img);
  const totalH = bandH + imgPx * 2 + bandH;

  const canvas = document.createElement("canvas");
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, totalW, totalH);

  // === Draw figures ===
  const imgTopY = bandH;

  // BACK FIGURE — drawn upside-down (vertically mirrored), above the fold.
  ctx.save();
  ctx.translate(0, imgTopY + imgPx);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0, totalW, imgPx);
  ctx.restore();

  // FRONT FIGURE — drawn right-side-up, below the fold.
  ctx.drawImage(img, 0, imgTopY + imgPx, totalW, imgPx);

  // === TOP BAND (blurred reflection), fading down into the BACK FIGURE ===
  const topBand = renderFadedBlurBand(img, totalW, bandH, fadeZone, "top");
  ctx.drawImage(topBand, 0, 0);

  // === BOTTOM BAND (blurred reflection), fading up into the FRONT FIGURE ===
  const botBand = renderFadedBlurBand(img, totalW, bandH, fadeZone, "bottom");
  ctx.drawImage(botBand, 0, imgTopY + imgPx * 2 - fadeZone);

  // === Text on TOP BAND (rotated 180° so it reads correctly when folded) ===
  let ty = BUFFER_PX;
  if (hasNumber) {
    ctx.save();
    ctx.translate(totalW, ty + NUMBER_PX);
    ctx.scale(-1, -1);
    drawTextOnCtx(ctx, `${number}`, 0, 0, totalW, NUMBER_PX, NUMBER_PX * 0.85);
    ctx.restore();
    ty += NUMBER_PX;
  }
  if (hasName) {
    ctx.save();
    ctx.translate(totalW, ty + LABEL_PX);
    ctx.scale(-1, -1);
    const fs = fitCanvasFontSize(ctx, name, totalW * 0.9, LABEL_PX * 0.7);
    drawTextOnCtx(ctx, name, 0, 0, totalW, LABEL_PX, fs);
    ctx.restore();
  }

  // === Text on BOTTOM BAND ===
  let by = imgTopY + imgPx * 2 + (hasName || hasNumber ? GAP_PX : 0);
  if (hasName) {
    const fs = fitCanvasFontSize(ctx, name, totalW * 0.9, LABEL_PX * 0.7);
    drawTextOnCtx(ctx, name, 0, by, totalW, LABEL_PX, fs);
    by += LABEL_PX;
  }
  if (hasNumber) {
    drawTextOnCtx(ctx, `${number}`, 0, by, totalW, NUMBER_PX, NUMBER_PX * 0.85);
  }

  return canvas;
}

// --- PDF rendering ---

function renderFlippedImageToDataUrl(
  img: HTMLImageElement,
  widthPx: number,
): string {
  const heightPx = Math.round(widthPx * (img.naturalHeight / img.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(0, heightPx);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0, widthPx, heightPx);
  return canvas.toDataURL("image/png");
}

function renderPdfBand(
  img: HTMLImageElement,
  widthMm: number,
  contentH: number,
  fadeZone: number,
  side: "top" | "bottom",
  labels: { text: string; hPx: number; fontSize: number }[],
): string {
  const w = Math.round(widthMm * SCALE);
  const band = renderFadedBlurBand(img, w, contentH, fadeZone, side);
  const extH = contentH + fadeZone;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = extH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(band, 0, 0);

  // Top band: spacer → labels → gap. Bottom band: gap → labels → spacer.
  // The bottom band's content sits below the fade zone overlapping the image.
  const flipped = side === "top";
  const hasLabels = labels.length > 0;
  let y = flipped ? BUFFER_PX : fadeZone + (hasLabels ? GAP_PX : 0);
  for (const label of labels) {
    if (flipped) {
      ctx.save();
      ctx.translate(w, y + label.hPx);
      ctx.scale(-1, -1);
      drawTextOnCtx(ctx, label.text, 0, 0, w, label.hPx, label.fontSize);
      ctx.restore();
    } else {
      drawTextOnCtx(ctx, label.text, 0, y, w, label.hPx, label.fontSize);
    }
    y += label.hPx;
  }

  return canvas.toDataURL("image/png");
}

interface MiniPdfData {
  img: HTMLImageElement;
  name: string;
  showName: boolean;
  number: number | null;
  heightMm: number;
  widthMm: number;
}

function drawMiniToPdf(pdf: jsPDF, mini: MiniPdfData, ox: number, oy: number) {
  const { img, name, showName, number, widthMm } = mini;
  const widthPx = Math.round(widthMm * SCALE);
  const hasNumber = number != null;
  const hasName = showName && !!name;
  const imgHMm = imageHeightMm(img, widthMm);

  const backDataUrl = renderFlippedImageToDataUrl(img, widthPx);
  const tmpCtx = document.createElement("canvas").getContext("2d")!;

  // Build label list for top (number first, then name — outermost to innermost)
  const topLabels: { text: string; hPx: number; fontSize: number }[] = [];
  if (hasNumber)
    topLabels.push({
      text: `${number}`,
      hPx: NUMBER_PX,
      fontSize: NUMBER_PX * 0.85,
    });
  if (hasName)
    topLabels.push({
      text: name,
      hPx: LABEL_PX,
      fontSize: fitCanvasFontSize(tmpCtx, name, widthPx * 0.9, LABEL_PX * 0.7),
    });

  // Build label list for bottom (name first, then number — innermost to outermost)
  const botLabels: { text: string; hPx: number; fontSize: number }[] = [];
  if (hasName)
    botLabels.push({
      text: name,
      hPx: LABEL_PX,
      fontSize: fitCanvasFontSize(tmpCtx, name, widthPx * 0.9, LABEL_PX * 0.7),
    });
  if (hasNumber)
    botLabels.push({
      text: `${number}`,
      hPx: NUMBER_PX,
      fontSize: NUMBER_PX * 0.85,
    });

  let labelsPx = 0;
  const hasAnyLabel = hasName || hasNumber;
  if (hasAnyLabel) labelsPx += GAP_PX;
  if (hasName) labelsPx += LABEL_PX;
  if (hasNumber) labelsPx += NUMBER_PX;
  const bandH = BUFFER_PX + labelsPx;
  const bandMm =
    STAND_BUFFER_MM +
    (hasAnyLabel ? LABEL_GAP_MM : 0) +
    (hasName ? LABEL_HEIGHT_MM : 0) +
    (hasNumber ? NUMBER_HEIGHT_MM : 0);

  // Fade zone overlaps the band into the adjacent image for a smooth blur transition.
  const fadeZone = getFadeZonePx(widthPx, img);
  const fadeMm = fadeZone / SCALE;

  const mirrorY = oy + bandMm;
  const frontY = mirrorY + imgHMm;
  const botBandY = frontY + imgHMm;

  // Draw images first, then overlay the blurred bands so their faded edges
  // blend smoothly into the images.

  // Mirrored image (back side)
  pdf.addImage(backDataUrl, "PNG", ox, mirrorY, widthMm, imgHMm);

  // Front image
  pdf.addImage(img, "PNG", ox, frontY, widthMm, imgHMm);

  // Top band (blurred, mirrored), fading down into the mirrored image
  const topUrl = renderPdfBand(img, widthMm, bandH, fadeZone, "top", topLabels);
  pdf.addImage(topUrl, "PNG", ox, oy, widthMm, bandMm + fadeMm);

  // Bottom band (blurred, mirrored), fading up into the front image
  const botUrl = renderPdfBand(
    img,
    widthMm,
    bandH,
    fadeZone,
    "bottom",
    botLabels,
  );
  pdf.addImage(botUrl, "PNG", ox, botBandY - fadeMm, widthMm, bandMm + fadeMm);
}

export async function generatePdf(
  entries: MiniFigEntry[],
  format: PaperFormat = "a4",
  catalogueName = "paper-minis",
): Promise<void> {
  await fontReady;
  const validEntries = entries.filter(
    (entry) => entry.quantity > 0 && getEntryImageSource(entry),
  );
  if (validEntries.length === 0) return;

  const { widthMm: pageW, heightMm: pageH } = PAPER_SIZES[format];
  const usableW = pageW - PAGE_MARGIN_MM * 2;
  const usableH = pageH - PAGE_MARGIN_MM * 2;

  const allMinis: MiniPdfData[] = [];

  for (const entry of validEntries) {
    const img = await loadImage(getEntryImageSource(entry)!);
    const widthMm = getEffectiveWidthMm(entry);
    for (let i = 0; i < entry.quantity; i++) {
      const number = entry.quantity > 1 ? i + 1 : null;
      const heightMm = miniHeightMm(
        img,
        widthMm,
        entry.showName && !!entry.name,
        number != null,
      );
      allMinis.push({
        img,
        name: entry.name,
        showName: entry.showName,
        number,
        heightMm,
        widthMm,
      });
    }
  }

  // Sort by name/creature so identical types are grouped together
  allMinis.sort((a, b) => a.name.localeCompare(b.name));

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format });
  await ensureJsPdfFont(pdf);

  let pageX = PAGE_MARGIN_MM;
  let pageY = PAGE_MARGIN_MM;
  let rowMaxH = 0;

  for (let i = 0; i < allMinis.length; i++) {
    const mini = allMinis[i];

    if (pageX + mini.widthMm > usableW + PAGE_MARGIN_MM) {
      pageX = PAGE_MARGIN_MM;
      pageY += rowMaxH + SPACING_MM;
      rowMaxH = 0;
    }

    if (pageY + mini.heightMm > usableH + PAGE_MARGIN_MM) {
      pdf.addPage();
      await ensureJsPdfFont(pdf);
      pageX = PAGE_MARGIN_MM;
      pageY = PAGE_MARGIN_MM;
      rowMaxH = 0;
    }

    drawMiniToPdf(pdf, mini, pageX, pageY);

    if (mini.heightMm > rowMaxH) rowMaxH = mini.heightMm;
    pageX += mini.widthMm + SPACING_MM;
  }

  const safeName =
    catalogueName.replace(/[^a-z0-9_\-\s]/gi, "").trim() || "paper-minis";
  pdf.save(`${safeName}.pdf`);
}

export async function renderPreview(
  entry: MiniFigEntry,
  number: number | null,
): Promise<string> {
  await fontReady;
  const source = getEntryImageSource(entry);
  if (!source) return "";
  const img = await loadImage(source);
  const widthMm = getEffectiveWidthMm(entry);
  const canvas = drawMiniFigToCanvas(
    img,
    entry.name,
    entry.showName,
    number,
    widthMm,
  );
  return canvas.toDataURL("image/png");
}
