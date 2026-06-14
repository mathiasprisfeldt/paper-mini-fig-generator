import { jsPDF } from "jspdf";
import type { MiniFigEntry } from "./types";

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

const MINI_WIDTH_MM = 28;
const LABEL_HEIGHT_MM = 6;
const NUMBER_HEIGHT_MM = 10;
const STAND_BUFFER_MM = 10;
const LABEL_GAP_MM = 2;

const SCALE = 12;
const WIDTH_PX = MINI_WIDTH_MM * SCALE;
const LABEL_PX = LABEL_HEIGHT_MM * SCALE;
const NUMBER_PX = NUMBER_HEIGHT_MM * SCALE;
const BUFFER_PX = STAND_BUFFER_MM * SCALE;
const GAP_PX = LABEL_GAP_MM * SCALE;

const BLUR_PASSES = 3;
const BLUR_DOWNSCALE = 8;
const OVERLAY_ALPHA = 0.3;

function imageHeightMm(img: HTMLImageElement): number {
  return MINI_WIDTH_MM * (img.height / img.width);
}

function miniHeightMm(
  img: HTMLImageElement,
  showName: boolean,
  hasNumber: boolean
): number {
  const imgH = imageHeightMm(img);
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
  number: number | null
): HTMLCanvasElement {
  const hasNumber = number != null;
  const hasName = showName && !!name;
  const imgPx = Math.round(WIDTH_PX * (img.height / img.width));

  let labels = 0;
  if (hasName || hasNumber) labels += GAP_PX;
  if (hasName) labels += LABEL_PX;
  if (hasNumber) labels += NUMBER_PX;
  const bandH = BUFFER_PX + labels;

  const totalW = WIDTH_PX;
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

  // === One single blur for top band + fade ===
  const topExtH = bandH + fadeZone;
  const topBlur = renderBlurredStrip(img, totalW, topExtH, "bottom");

  const topMask = document.createElement("canvas");
  topMask.width = totalW;
  topMask.height = topExtH;
  const tmCtx = topMask.getContext("2d")!;
  tmCtx.translate(0, topExtH);
  tmCtx.scale(1, -1);
  tmCtx.drawImage(topBlur, 0, 0);
  tmCtx.setTransform(1, 0, 0, 1, 0, 0);
  const tg = tmCtx.createLinearGradient(0, bandH, 0, topExtH);
  tg.addColorStop(0, "rgba(0,0,0,0)");
  tg.addColorStop(1, "rgba(0,0,0,1)");
  tmCtx.globalCompositeOperation = "destination-out";
  tmCtx.fillStyle = tg;
  tmCtx.fillRect(0, bandH, totalW, fadeZone);
  ctx.drawImage(topMask, 0, 0);

  // === One single blur for bottom band + fade ===
  const botExtH = fadeZone + bandH;
  const botBlur = renderBlurredStrip(img, totalW, botExtH, "bottom");

  const botMask = document.createElement("canvas");
  botMask.width = totalW;
  botMask.height = botExtH;
  const bmCtx = botMask.getContext("2d")!;
  bmCtx.drawImage(botBlur, 0, 0);
  const bg = bmCtx.createLinearGradient(0, 0, 0, fadeZone);
  bg.addColorStop(0, "rgba(0,0,0,1)");
  bg.addColorStop(1, "rgba(0,0,0,0)");
  bmCtx.globalCompositeOperation = "destination-out";
  bmCtx.fillStyle = bg;
  bmCtx.fillRect(0, 0, totalW, fadeZone);
  ctx.drawImage(botMask, 0, imgTopY + imgPx * 2 - fadeZone);

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

interface MiniPdfData {
  img: HTMLImageElement;
  name: string;
  showName: boolean;
  number: number | null;
  heightMm: number;
}

function drawMiniToPdf(pdf: jsPDF, mini: MiniPdfData, ox: number, oy: number) {
  const { img, name, showName, number } = mini;

  // Use the same canvas renderer as the preview to get consistent blur fades
  const canvas = drawMiniFigToCanvas(img, name, showName, number);
  const dataUrl = canvas.toDataURL("image/png");
  pdf.addImage(dataUrl, "PNG", ox, oy, MINI_WIDTH_MM, mini.heightMm);
}

export async function generatePdf(entries: MiniFigEntry[]): Promise<void> {
  await fontReady;
  const validEntries = entries.filter((e) => e.imageDataUrl);
  if (validEntries.length === 0) return;

  const allMinis: MiniPdfData[] = [];

  for (const entry of validEntries) {
    const img = await loadImage(entry.imageDataUrl!);
    for (let i = 0; i < entry.quantity; i++) {
      const number = entry.quantity > 1 ? i + 1 : null;
      const heightMm = miniHeightMm(
        img,
        entry.showName && !!entry.name,
        number != null
      );
      allMinis.push({
        img,
        name: entry.name,
        showName: entry.showName,
        number,
        heightMm,
      });
    }
  }

  // Sort by name/creature so identical types are grouped together
  allMinis.sort((a, b) => a.name.localeCompare(b.name));

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await ensureJsPdfFont(pdf);

  let pageX = PAGE_MARGIN_MM;
  let pageY = PAGE_MARGIN_MM;
  let rowMaxH = 0;

  for (let i = 0; i < allMinis.length; i++) {
    const mini = allMinis[i];

    if (pageX + MINI_WIDTH_MM > A4_WIDTH_MM - PAGE_MARGIN_MM) {
      pageX = PAGE_MARGIN_MM;
      pageY += rowMaxH + SPACING_MM;
      rowMaxH = 0;
    }

    if (pageY + mini.heightMm > A4_HEIGHT_MM - PAGE_MARGIN_MM) {
      pdf.addPage();
      await ensureJsPdfFont(pdf);
      pageX = PAGE_MARGIN_MM;
      pageY = PAGE_MARGIN_MM;
      rowMaxH = 0;
    }

    drawMiniToPdf(pdf, mini, pageX, pageY);

    if (mini.heightMm > rowMaxH) rowMaxH = mini.heightMm;
    pageX += MINI_WIDTH_MM + SPACING_MM;
  }

  pdf.save("paper-minis.pdf");
}

export async function renderPreview(
  entry: MiniFigEntry,
  number: number | null
): Promise<string> {
  await fontReady;
  if (!entry.imageDataUrl) return "";
  const img = await loadImage(entry.imageDataUrl);
  const canvas = drawMiniFigToCanvas(img, entry.name, entry.showName, number);
  return canvas.toDataURL("image/png");
}
