import QRCode from 'qrcode';
import { CARD_RASTER_PX, FACE_MARGIN_FRACTION, QR_FRACTION } from './printLayout';

/**
 * Renders a printable card face. Used by BOTH the print sheet and the MindAR
 * compiler so the tracked reference matches the physical card as closely as
 * possible. The compiler variant leaves the QR box empty: the box edges are
 * stable shared features, while the inner QR pattern differs between the two
 * cards of a pair (side a/b) and would only add mismatched noise.
 */

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${url}`));
    img.src = url;
  });
}

export interface CardFaceOptions {
  /** QR text; omit to draw the empty QR box (compiler variant). */
  qrPayload?: string;
  size?: number;
}

export async function drawCardFace(
  canvas: HTMLCanvasElement,
  face: CanvasImageSource & { width: number; height: number },
  options: CardFaceOptions = {},
): Promise<void> {
  const size = options.size ?? CARD_RASTER_PX;
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;

  // White base + inner art area (small quiet margin all around).
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  const margin = Math.round(size * FACE_MARGIN_FRACTION);
  const inner = size - margin * 2;

  // Cover-fit the art into the inner square.
  const iw = face.width;
  const ih = face.height;
  const scale = Math.max(inner / iw, inner / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  g.save();
  g.beginPath();
  g.rect(margin, margin, inner, inner);
  g.clip();
  g.drawImage(face, margin + (inner - dw) / 2, margin + (inner - dh) / 2, dw, dh);
  g.restore();

  // QR box: bottom corner, with a white quiet zone (physical layout constant —
  // the AR stage derives card size from the printed QR via QR_FRACTION).
  const qrSize = Math.round(size * QR_FRACTION);
  const pad = Math.round(qrSize * 0.1);
  const boxSize = qrSize + pad * 2;
  const boxX = margin;
  const boxY = size - margin - boxSize;
  g.fillStyle = '#ffffff';
  g.fillRect(boxX, boxY, boxSize, boxSize);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = Math.max(1, size * 0.003);
  g.strokeRect(boxX + 0.5, boxY + 0.5, boxSize - 1, boxSize - 1);

  if (options.qrPayload) {
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, options.qrPayload, {
      width: qrSize,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    g.drawImage(qrCanvas, boxX + pad, boxY + pad, qrSize, qrSize);
  }
}
