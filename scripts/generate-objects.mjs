/**
 * Generates the beach-day set's low-poly GLB objects programmatically:
 * three.js primitive geometries -> merged vertex-colored meshes -> GLB via
 * gltf-transform. No textures, no external assets, no copyright risk.
 *
 * Units: 1.0 = one card width. Objects stand on the origin, +Y up, and are
 * sized ~0.6-0.9 so they sit nicely on a card with the default scale.
 *
 * Run: node scripts/generate-objects.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { Document, NodeIO } from '@gltf-transform/core';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../public/sets/beach-day/objects');

/** One colored primitive placed in the model. */
function part(geometry, hexColor, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const matrix = new Matrix4().compose(
    new Vector3(...pos),
    new Quaternion().setFromEuler(new Euler(...rot)),
    new Vector3(...scale),
  );
  return { geometry, hexColor, matrix };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  // sRGB -> linear (glTF COLOR_0 is linear).
  const srgb = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  return srgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
}

/** Merge parts into flat non-indexed position/normal/color arrays. */
function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const normalMatrix = new Matrix4();
  for (const { geometry, hexColor, matrix } of parts) {
    const geo = geometry.toNonIndexed();
    geo.applyMatrix4(matrix);
    void normalMatrix; // normals handled by applyMatrix4 (three normalizes)
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const rgb = hexToRgb(hexColor);
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(...rgb);
    }
    geo.dispose();
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
  };
}

async function writeGlb(name, parts) {
  const { positions, normals, colors } = mergeParts(parts);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const material = doc
    .createMaterial('vertexColored')
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.85);

  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer),
    )
    .setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer),
    )
    .setAttribute(
      'COLOR_0',
      doc.createAccessor().setType('VEC3').setArray(colors).setBuffer(buffer),
    )
    .setMaterial(material);

  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene(name).addChild(node);

  const glb = await new NodeIO().writeBinary(doc);
  writeFileSync(join(OUT_DIR, `${name}.glb`), glb);
  console.log(`  ${name}.glb (${(glb.byteLength / 1024).toFixed(1)} KB, ${positions.length / 3} verts)`);
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

const S = (r, w = 12, h = 8) => new SphereGeometry(r, w, h);
const Cyl = (rt, rb, h, s = 10) => new CylinderGeometry(rt, rb, h, s);
const Cone = (r, h, s = 10) => new ConeGeometry(r, h, s);
const Box = (x, y, z) => new BoxGeometry(x, y, z);

function crab() {
  const body = '#e8542f';
  const dark = '#c23c1d';
  const parts = [
    part(S(0.22, 16, 12), body, { pos: [0, 0.2, 0], scale: [1.25, 0.75, 1] }),
    // Eyes on stalks
    part(Cyl(0.02, 0.02, 0.12, 6), dark, { pos: [-0.08, 0.38, 0.1] }),
    part(Cyl(0.02, 0.02, 0.12, 6), dark, { pos: [0.08, 0.38, 0.1] }),
    part(S(0.045, 8, 6), '#ffffff', { pos: [-0.08, 0.46, 0.1] }),
    part(S(0.045, 8, 6), '#ffffff', { pos: [0.08, 0.46, 0.1] }),
    part(S(0.022, 6, 5), '#101418', { pos: [-0.08, 0.465, 0.135] }),
    part(S(0.022, 6, 5), '#101418', { pos: [0.08, 0.465, 0.135] }),
    // Claws
    part(S(0.1, 10, 8), dark, { pos: [-0.34, 0.26, 0.12], scale: [1, 0.9, 1] }),
    part(S(0.1, 10, 8), dark, { pos: [0.34, 0.26, 0.12], scale: [1, 0.9, 1] }),
    part(Box(0.07, 0.05, 0.1), dark, { pos: [-0.38, 0.33, 0.16], rot: [0, 0, 0.4] }),
    part(Box(0.07, 0.05, 0.1), dark, { pos: [0.38, 0.33, 0.16], rot: [0, 0, -0.4] }),
  ];
  // Legs: 3 per side
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      parts.push(
        part(Cyl(0.018, 0.025, 0.24, 6), dark, {
          pos: [side * 0.26, 0.12, -0.06 + i * 0.09],
          rot: [0, 0, side * 1.1],
        }),
      );
    }
  }
  return parts;
}

function palm() {
  const trunk = '#8a5a2b';
  const leaf = '#2fa757';
  const parts = [];
  // Curved trunk from stacked, slightly shifted segments.
  for (let i = 0; i < 6; i++) {
    parts.push(
      part(Cyl(0.05 - i * 0.004, 0.06 - i * 0.004, 0.14, 8), trunk, {
        pos: [Math.sin(i * 0.12) * 0.1 - 0.05, 0.07 + i * 0.13, 0],
        rot: [0, 0, -0.1],
      }),
    );
  }
  const top = [Math.sin(5 * 0.12) * 0.1 - 0.03, 0.9, 0];
  // Leaves: flattened stretched cones fanned around the crown.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(
      part(Cone(0.09, 0.5, 6), leaf, {
        pos: [top[0] + Math.cos(a) * 0.2, top[1] + 0.02, top[2] + Math.sin(a) * 0.2],
        rot: [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25],
        scale: [1, 1, 0.3],
      }),
    );
  }
  parts.push(part(S(0.055, 8, 6), '#6b4423', { pos: [top[0] - 0.06, top[1] - 0.06, 0.04] }));
  parts.push(part(S(0.055, 8, 6), '#6b4423', { pos: [top[0] + 0.06, top[1] - 0.08, -0.04] }));
  // Sand mound
  parts.push(part(S(0.22, 12, 8), '#e7cf9b', { pos: [0, -0.02, 0], scale: [1.4, 0.35, 1.4] }));
  return parts;
}

function ball() {
  // Classic beach ball: 6 colored longitudinal segments + white caps.
  const colors = ['#e8433b', '#ffffff', '#2f7fe8', '#ffd23f', '#ffffff', '#2fa757'];
  const parts = colors.map((c, i) =>
    part(new SphereGeometry(0.3, 8, 12, (i * Math.PI) / 3, Math.PI / 3), c, {
      pos: [0, 0.32, 0],
    }),
  );
  parts.push(part(S(0.075, 10, 6), '#ffffff', { pos: [0, 0.62, 0], scale: [1, 0.5, 1] }));
  parts.push(part(S(0.075, 10, 6), '#ffffff', { pos: [0, 0.02, 0], scale: [1, 0.5, 1] }));
  return parts;
}

function boat() {
  const hullC = '#c9622f';
  const parts = [
    // Hull: wide box + tapered bow/stern
    part(Box(0.55, 0.14, 0.24), hullC, { pos: [0, 0.12, 0] }),
    part(Box(0.2, 0.14, 0.24), hullC, { pos: [0.32, 0.12, 0], rot: [0, 0.5, 0] }),
    part(Box(0.2, 0.14, 0.24), hullC, { pos: [-0.32, 0.12, 0], rot: [0, -0.5, 0] }),
    part(Box(0.5, 0.03, 0.2), '#e7cf9b', { pos: [0, 0.2, 0] }),
    // Mast + boom
    part(Cyl(0.018, 0.022, 0.62, 8), '#7a4a22', { pos: [0, 0.5, 0] }),
    // Sail: big flattened cone reads as a triangle sail
    part(Cone(0.19, 0.5, 4), '#f7f3e8', { pos: [0.11, 0.52, 0], rot: [0, 0, -0.06], scale: [1, 1, 0.08] }),
    part(Cone(0.13, 0.34, 4), '#e8433b', { pos: [-0.1, 0.46, 0], rot: [0, 0, 0.1], scale: [1, 1, 0.08] }),
    // Flag
    part(Box(0.09, 0.05, 0.01), '#e8433b', { pos: [0.05, 0.83, 0] }),
  ];
  return parts;
}

function sun() {
  const parts = [part(S(0.26, 16, 12), '#ffcf3f', { pos: [0, 0.42, 0] })];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(
      part(Cone(0.055, 0.18, 6), '#ffb03a', {
        pos: [Math.cos(a) * 0.36, 0.42 + Math.sin(a) * 0.36, 0],
        rot: [0, 0, a - Math.PI / 2],
      }),
    );
  }
  // Cheeks + smile give it character (kids recognize it instantly).
  parts.push(part(S(0.03, 8, 6), '#e8542f', { pos: [-0.1, 0.38, 0.24] }));
  parts.push(part(S(0.03, 8, 6), '#e8542f', { pos: [0.1, 0.38, 0.24] }));
  parts.push(part(S(0.025, 8, 6), '#3a2a18', { pos: [-0.08, 0.48, 0.25] }));
  parts.push(part(S(0.025, 8, 6), '#3a2a18', { pos: [0.08, 0.48, 0.25] }));
  parts.push(
    part(new TorusGeometry(0.07, 0.018, 6, 10, Math.PI), '#3a2a18', {
      pos: [0, 0.4, 0.25],
      rot: [0, 0, Math.PI],
    }),
  );
  return parts;
}

function shell() {
  const base = '#f2b6c1';
  const ridge = '#d98a9c';
  const parts = [
    // Scallop: squashed half-dome
    part(S(0.3, 16, 10), base, { pos: [0, 0.12, 0], scale: [1, 0.45, 0.85] }),
    part(Cone(0.09, 0.14, 6), ridge, { pos: [0, 0.08, -0.3], rot: [0.5, 0, 0], scale: [1, 1, 0.6] }),
  ];
  // Radiating ridges over the dome.
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.28;
    parts.push(
      part(Box(0.035, 0.05, 0.5), ridge, {
        pos: [Math.sin(a) * 0.15, 0.2, 0.02 + Math.cos(a) * 0.03],
        rot: [0, a, 0],
      }),
    );
  }
  // Pearl
  parts.push(part(S(0.07, 12, 10), '#fdfdf6', { pos: [0, 0.3, 0.1] }));
  return parts;
}

function seagull() {
  const white = '#f7f7f2';
  const grey = '#c9d2d8';
  const parts = [
    part(S(0.16, 14, 10), white, { pos: [0, 0.34, 0], scale: [1.5, 0.9, 0.9] }),
    part(S(0.1, 12, 8), white, { pos: [0.2, 0.5, 0] }),
    part(Cone(0.035, 0.12, 6), '#f2a13a', { pos: [0.32, 0.5, 0], rot: [0, 0, -Math.PI / 2] }),
    part(S(0.02, 6, 5), '#101418', { pos: [0.24, 0.54, 0.06] }),
    part(S(0.02, 6, 5), '#101418', { pos: [0.24, 0.54, -0.06] }),
    // Wings spread
    part(Box(0.34, 0.03, 0.13), grey, { pos: [-0.02, 0.42, 0.22], rot: [0.35, 0.25, 0] }),
    part(Box(0.34, 0.03, 0.13), grey, { pos: [-0.02, 0.42, -0.22], rot: [-0.35, -0.25, 0] }),
    // Tail
    part(Box(0.16, 0.03, 0.1), grey, { pos: [-0.24, 0.36, 0], rot: [0, 0, 0.2] }),
    // Legs
    part(Cyl(0.012, 0.012, 0.18, 6), '#f2a13a', { pos: [0.02, 0.16, 0.05] }),
    part(Cyl(0.012, 0.012, 0.18, 6), '#f2a13a', { pos: [0.02, 0.16, -0.05] }),
  ];
  return parts;
}

function icecream() {
  return [
    part(Cone(0.16, 0.42, 12), '#d9a05b', { pos: [0, 0.21, 0], rot: [Math.PI, 0, 0] }),
    part(S(0.17, 14, 10), '#f2b6c1', { pos: [0, 0.5, 0] }), // strawberry
    part(S(0.14, 14, 10), '#f7f3e8', { pos: [0, 0.72, 0] }), // vanilla
    part(S(0.035, 8, 6), '#e8433b', { pos: [0, 0.86, 0] }), // cherry
    part(Cyl(0.012, 0.012, 0.1, 6), '#7a4a22', { pos: [0.03, 0.93, 0], rot: [0, 0, -0.3] }),
    // Sprinkles
    ...[...Array(8)].map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return part(Box(0.025, 0.01, 0.01), ['#e8433b', '#2f7fe8', '#ffd23f', '#2fa757'][i % 4], {
        pos: [Math.cos(a) * 0.1, 0.72 + Math.sin(a) * 0.08, 0.1],
        rot: [0, 0, a],
      });
    }),
  ];
}

// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
console.log('Generating beach-day GLB objects...');
await writeGlb('crab', crab());
await writeGlb('palm', palm());
await writeGlb('ball', ball());
await writeGlb('boat', boat());
await writeGlb('sun', sun());
await writeGlb('shell', shell());
await writeGlb('seagull', seagull());
await writeGlb('icecream', icecream());
console.log('Done.');
