/**
 * MindAR target compiler for Node.
 *
 * Usage:
 *   npm i -D canvas          # native, and .npmrc disables install scripts,
 *                            # so install it explicitly when compiling
 *   npm run ar:compile -- public/ar/targets/source/card_01_a.jpg \
 *                          public/ar/targets/source/card_01_b.jpg \
 *                          public/ar/targets/qawsi-cards.mind
 *   npm run ar:inspect -- public/ar/targets/qawsi-cards.mind
 *
 * Image order on the command line IS targetIndex — it must match
 * src/content/targets-manifest.json. See docs/AR-TARGETS.md.
 *
 * mind-ar ships its compiler as a Vite bundle: it pulls the worker in through
 * `?worker&inline`, which Node cannot resolve, and it reads pixels through a
 * DOM canvas. Subclassing CompilerBase and supplying those two pieces — a
 * node-canvas rasterizer and an inline (worker-free) tracking pass — reuses the
 * upstream feature extraction exactly, so the .mind this produces is the same
 * file the browser tool would emit.
 */
// The detector runs on custom TF.js kernels that mind-ar registers as a side
// effect of this import. Without it the CPU backend has no 'BinomialFilter'.
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';
import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js';
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js';
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js';
import { createCanvas, loadImage } from 'canvas';
import fs from 'node:fs';

class NodeCompiler extends CompilerBase {
  createProcessCanvas(img) {
    const canvas = createCanvas(img.width, img.height);
    return canvas;
  }

  async compileTrack({ progressCallback, targetImages, basePercent }) {
    const percentPerImage = 100.0 / targetImages.length;
    let percent = 0.0;
    const list = [];
    for (const targetImage of targetImages) {
      const imageList = buildTrackingImageList(targetImage);
      const percentPerAction = percentPerImage / imageList.length;
      list.push(
        extractTrackingFeatures(imageList, () => {
          percent += percentPerAction;
          progressCallback(basePercent + (percent * basePercent) / 100);
        }),
      );
    }
    return list;
  }
}

const argv = process.argv.slice(2);
const out = argv.pop();
const images = [];
for (const f of argv) images.push(await loadImage(f));

const compiler = new NodeCompiler();
let last = -1;
await compiler.compileImageTargets(images, (p) => {
  const r = Math.floor(p / 10) * 10;
  if (r !== last) { last = r; process.stdout.write(`${r}% `); }
});
console.log();

fs.writeFileSync(out, Buffer.from(compiler.exportData()));
console.log(`✓ ${out} — ${(fs.statSync(out).size / 1024).toFixed(0)}KB · ${images.length} أهداف`);
