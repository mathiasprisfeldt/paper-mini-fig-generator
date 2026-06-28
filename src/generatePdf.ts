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

const PAPER_SIZES: Record<PaperFormat, { widthMm: number; heightMm: number }> = {
  a4: { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM },
  a3: { widthMm: 297, heightMm: 420 },
};

const LABEL_HEIGHT_MM = 6;
const NUMBER_HEIGHT_MM = 10;
const STAND_BUFFER_MM = 10;
const LABEL_GAP_MM = 2;

const SCALE = 12;
const LABEL_PX = LABEL_HEIGHT_MM * SCALE;
const NUMBER_PX = NUMBER_HEIGHT_MM * SCALE;
const BUFFER_PX = STAND_BUFFER_MM * SCALE;
const GAP_PX = LABEL_GAP_MM * SCALE;

const BLUR_PASSES = 3;
const BLUR_DOWNSCALE = 8;
const OVERLAY_ALPHA = 0.3;

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

function getEffectiveWidthMm(entry: MiniFigEntry): number {
  return entry.miniSize * CREATURE_SIZE_MULTIPLIERS[entry.creatureSize];
}

export function getUsablePageWidthMm(format: PaperFormat): number {
  return PAPER_SIZES[format].widthMm - PAGE_MARGIN_MM * 2;
}

export function isEntryOversized(entry: MiniFigEntry, format: PaperFormat): boolean {
  return getEffectiveWidthMm(entry) > getUsablePageWidthMm(format);
}

function imageHeightMm(img: HTMLImageElement, widthMm: number): number {
  return widthMm * (img.height / img.width);
}

function miniHeightMm(
  img: HTMLImageElement,
  widthMm: number,
  showName: boolean,
  hasNumber: boolean
): number {
  const imgH = imageHeightMm(img, widthMm);
  let labels = 0;
  if (showName || hasNumber) labels += LABEL_GAP_MM;
  if (showName) labels += LABEL_HEIGHT_MM;
  if (hasNumber) labels += NUMBER_HEIGHT_MM;
  return STAND_BUFFER_MM + labels + imgH * 2 + labels + STAND_BUFFER_MM;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Renders a blurred + darkened strip sampled from an edge of the image.
 * `edge` = "top" samples from the top of the source, "bottom" from the bottom.
 * The strip is w x h pixels.
 */
function renderBlurredStrip(
  img: HTMLImageElement,
  w: number,
  h: number,
  edge: "top" | "bottom"
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

  // Blur by repeated downscale/upscale
  const smallW = Math.max(2, Math.round(w / BLUR_DOWNSCALE));
  const smallH = Math.max(2, Math.round(h / BLUR_DOWNSCALE));
  const small = document.createElement("canvas");
  small.width = smallW;
  small.height = smallH;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "low";

  let src: HTMLCanvasElement = crop;
  for (let i = 0; i < BLUR_PASSES; i++) {
    sctx.clearRect(0, 0, smallW, smallH);
    sctx.drawImage(src, 0, 0, smallW, smallH);
    const mid = document.createElement("canvas");
    mid.width = w;
    mid.height = h;
    const mctx = mid.getContext("2d")!;
    mctx.imageSmoothingEnabled = true;
    mctx.imageSmoothingQuality = "high";
    mctx.drawImage(small, 0, 0, w, h);
    src = mid;
  }

  // Final output with dark overlay
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = `rgba(0, 0, 0, ${OVERLAY_ALPHA})`;
  ctx.fillRect(0, 0, w, h);

  return canvas;
}

/**
 * Renders a blurred band with a smooth fade into the adjacent image.
 * The blurred strip is rotated 180° (mirrored) so it reads as a reflection
 * of the figure. The returned canvas is `contentH + fadeZone` px tall.
 *
 * `side` = "top": the solid band occupies the top `contentH` px and the
 *   bottom `fadeZone` px fade to transparent (blending into the image below).
 * `side` = "bottom": the solid band occupies the bottom `contentH` px and the
 *   top `fadeZone` px fade to transparent (blending into the image above).
 */
function renderFadedBlurBand(
  img: HTMLImageElement,
  w: number,
  contentH: number,
  fadeZone: number,
  side: "top" | "bottom"
): HTMLCanvasElement {
  const extH = contentH + fadeZone;
  const blur = renderBlurredStrip(img, w, extH, "bottom");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = extH;
  const ctx = canvas.getContext("2d")!;

  // Rotate the blurred strip 180° (mirror) so it mirrors the figure.
  ctx.save();
  ctx.translate(w, extH);
  ctx.scale(-1, -1);
  ctx.drawImage(blur, 0, 0);
  ctx.restore();

  // Fade out the edge adjacent to the image for a smooth transition.
  ctx.globalCompositeOperation = "destination-out";
  if (side === "top") {
    const g = ctx.createLinearGradient(0, contentH, 0, extH);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, contentH, w, fadeZone);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, fadeZone);
    g.addColorStop(0, "rgba(0,0,0,1)");
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
  startSize: number
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
  fontSize: number
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
  widthMm: number
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
  const totalH = bandH + imgPx * 2 + bandH;
  const fadeZone = Math.round(imgPx * 0.2);

  const canvas = document.createElement("canvas");
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, totalW, totalH);

  // === Draw images ===
  const imgTopY = bandH;

  ctx.save();
  ctx.translate(0, imgTopY + imgPx);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0, totalW, imgPx);
  ctx.restore();

  ctx.drawImage(img, 0, imgTopY + imgPx, totalW, imgPx);

  // === Blurred top band with smooth fade into the image below ===
  const topBand = renderFadedBlurBand(img, totalW, bandH, fadeZone, "top");
  ctx.drawImage(topBand, 0, 0);

  // === Blurred bottom band with smooth fade into the image above ===
  const botBand = renderFadedBlurBand(img, totalW, bandH, fadeZone, "bottom");
  ctx.drawImage(botBand, 0, imgTopY + imgPx * 2 - fadeZone);

  // === Text on top band (rotated 180° so it reads correctly when folded) ===
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

  // === Text on bottom band ===
  let by = imgTopY + imgPx * 2 + ((hasName || hasNumber) ? GAP_PX : 0);
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

function renderFlippedImageToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(0, img.naturalHeight);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function renderPdfBand(
  img: HTMLImageElement,
  widthMm: number,
  contentH: number,
  fadeZone: number,
  side: "top" | "bottom",
  labels: { text: string; hPx: number; fontSize: number }[]
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

  const backDataUrl = renderFlippedImageToDataUrl(img);
  const tmpCtx = document.createElement("canvas").getContext("2d")!;

  // Build label list for top (number first, then name — outermost to innermost)
  const topLabels: { text: string; hPx: number; fontSize: number }[] = [];
  if (hasNumber) topLabels.push({ text: `${number}`, hPx: NUMBER_PX, fontSize: NUMBER_PX * 0.85 });
  if (hasName) topLabels.push({ text: name, hPx: LABEL_PX, fontSize: fitCanvasFontSize(tmpCtx, name, widthPx * 0.9, LABEL_PX * 0.7) });

  // Build label list for bottom (name first, then number — innermost to outermost)
  const botLabels: { text: string; hPx: number; fontSize: number }[] = [];
  if (hasName) botLabels.push({ text: name, hPx: LABEL_PX, fontSize: fitCanvasFontSize(tmpCtx, name, widthPx * 0.9, LABEL_PX * 0.7) });
  if (hasNumber) botLabels.push({ text: `${number}`, hPx: NUMBER_PX, fontSize: NUMBER_PX * 0.85 });

  let labelsPx = 0;
  const hasAnyLabel = hasName || hasNumber;
  if (hasAnyLabel) labelsPx += GAP_PX;
  if (hasName) labelsPx += LABEL_PX;
  if (hasNumber) labelsPx += NUMBER_PX;
  const bandH = BUFFER_PX + labelsPx;
  const bandMm = STAND_BUFFER_MM + (hasAnyLabel ? LABEL_GAP_MM : 0) + (hasName ? LABEL_HEIGHT_MM : 0) + (hasNumber ? NUMBER_HEIGHT_MM : 0);

  // Fade zone overlaps the band into the adjacent image for a smooth blur transition.
  const imgPx = Math.round(widthPx * (img.height / img.width));
  const fadeZone = Math.round(imgPx * 0.2);
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
  const botUrl = renderPdfBand(img, widthMm, bandH, fadeZone, "bottom", botLabels);
  pdf.addImage(botUrl, "PNG", ox, botBandY - fadeMm, widthMm, bandMm + fadeMm);
}

export async function generatePdf(entries: MiniFigEntry[], format: PaperFormat = "a4", catalogueName = "paper-minis"): Promise<void> {
  await fontReady;
  const validEntries = entries.filter((e) => e.imageDataUrl);
  if (validEntries.length === 0) return;

  const { widthMm: pageW, heightMm: pageH } = PAPER_SIZES[format];
  const usableW = pageW - PAGE_MARGIN_MM * 2;
  const usableH = pageH - PAGE_MARGIN_MM * 2;

  const allMinis: MiniPdfData[] = [];

  for (const entry of validEntries) {
    const img = await loadImage(entry.imageDataUrl!);
    const widthMm = getEffectiveWidthMm(entry);
    for (let i = 0; i < entry.quantity; i++) {
      const number = entry.quantity > 1 ? i + 1 : null;
      const heightMm = miniHeightMm(
        img,
        widthMm,
        entry.showName && !!entry.name,
        number != null
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

  const safeName = catalogueName.replace(/[^a-z0-9_\-\s]/gi, "").trim() || "paper-minis";
  pdf.save(`${safeName}.pdf`);
}

export async function renderPreview(
  entry: MiniFigEntry,
  number: number | null
): Promise<string> {
  await fontReady;
  if (!entry.imageDataUrl) return "";
  const img = await loadImage(entry.imageDataUrl);
  const widthMm = getEffectiveWidthMm(entry);
  const canvas = drawMiniFigToCanvas(img, entry.name, entry.showName, number, widthMm);
  return canvas.toDataURL("image/png");
}
