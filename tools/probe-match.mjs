/**
 * Offline matcher probe.
 *
 * Usage:
 *   npm i -D canvas
 *   npm run ar:probe -- public/ar/targets/qawsi-cards.mind photo-of-card.jpg
 *
 * Point it at a photo resembling what a player's camera will see. A reference
 * image matched against itself should report hundreds of points; anything in
 * the low tens will be unreliable on a moving phone and the card art or the
 * photograph needs improving before printing.
 *
 * Runs the exact detect→match path the browser uses, against a still image, so
 * a failure to recognize can be attributed to the compiled data rather than to
 * the camera, the video pipeline, or the controller wiring.
 */
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';
import { Detector } from 'mind-ar/src/image-target/detector/detector.js';
import { Matcher } from 'mind-ar/src/image-target/matching/matcher.js';
import * as msgpack from '@msgpack/msgpack';
import * as tf from '@tensorflow/tfjs';
import { createCanvas, loadImage } from 'canvas';
import fs from 'node:fs';

const [mindPath, queryPath, scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg ?? 1);

const data = msgpack.decode(new Uint8Array(fs.readFileSync(mindPath)));

const img = await loadImage(queryPath);
const w = Math.round(img.width * scale);
const h = Math.round(img.height * scale);
const canvas = createCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0, w, h);
const rgba = ctx.getImageData(0, 0, w, h).data;

// The detector wants single-channel luminance.
const grey = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) {
  grey[i] = (rgba[i*4] * 0.299 + rgba[i*4+1] * 0.587 + rgba[i*4+2] * 0.114);
}

const detector = new Detector(w, h);
const input = tf.tensor(grey, [grey.length], 'float32').reshape([h, w]);
const { featurePoints } = detector.detect(input);
console.log(`استعلام ${w}×${h} · نقاط مكتشفة: ${featurePoints.length}`);

const matcher = new Matcher(w, h);
data.dataList.forEach((target, i) => {
  const res = matcher.matchDetection(target.matchingData, featurePoints);
  const ok = res.keyframeIndex >= 0;
  const n = ok ? res.screenCoords.length : 0;
  console.log(`  هدف[${i}] ${target.targetImage.width}×${target.targetImage.height} → ${ok ? `تطابق ✓ إطار#${res.keyframeIndex} · ${n} نقطة` : 'لا تطابق ✗'}`);
});
