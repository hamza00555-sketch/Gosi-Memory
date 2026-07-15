import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ResolvedTrack } from '../recognition/FusionResolver';
import type { CardSet, SetPair } from '../lib/sets';
import { pairOf, setAssetUrl } from '../lib/sets';
import { QR_FRACTION } from '../lib/printLayout';

/**
 * The AR stage: a transparent three.js canvas over the live camera video.
 *
 * World units are CARD WIDTHS (MindAR's convention once the postMatrix is
 * applied): an object with scale 1 spans the physical card exactly.
 *
 * Two anchoring modes per track, matching what recognition can offer:
 * - pose      (image tracking): full 6-DoF worldMatrix — object sits ON the card.
 * - billboard (QR / mock): screen-anchored at the code's position, facing the
 *   camera at a fixed depth, scaled from the printed QR's known size.
 */

const BILLBOARD_DEPTH = 7; // card-width units in front of the camera
const APPEAR_MS = 320;
const MISS_FADE_MS = 500;

/** Platform perf trap: TF.js tracking shares the GPU — cap the pixel ratio. */
const MAX_PIXEL_RATIO = 1.5;

interface StageObject {
  /** Tracking transform (matrixAutoUpdate=false, set from pose/billboard). */
  group: THREE.Group;
  /** Placement from the set config (offset/rotation/scale) — reset per frame. */
  inner: THREE.Group;
  /** Idle spin + pop/dim animation live here so they never fight placement. */
  spinner: THREE.Group;
  pair: SetPair;
  bornAt: number;
  spinAngle: number;
  state: 'active' | 'missed';
  missedAt: number;
}

export class ArStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(63, 1, 0.05, 1000);
  private container: HTMLElement;
  private video: HTMLVideoElement;
  private raf = 0;
  private clock = new THREE.Clock();
  private objects = new Map<string, StageObject>(); // by cardId
  private modelCache = new Map<string, Promise<THREE.Object3D>>();
  private set: CardSet;
  private tracksProvider: () => ResolvedTrack[] = () => [];
  private targetDims: (targetIndex: number) => [number, number] | null = () => null;
  private customProjection = false;
  private disposed = false;

  constructor(container: HTMLElement, video: HTMLVideoElement, set: CardSet) {
    this.container = container;
    this.video = video;
    this.set = set;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    container.appendChild(el);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(1, 3, 2);
    this.scene.add(sun);

    this.layout();
    window.addEventListener('resize', this.layout);
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Live tracks are pulled every frame from the resolver (no event plumbing). */
  setTracksProvider(fn: () => ResolvedTrack[]): void {
    this.tracksProvider = fn;
  }

  /** Wire the MindAR camera model in when image tracking is running. */
  useMindArProjection(
    projectionMatrix: number[],
    targetDims: (targetIndex: number) => [number, number] | null,
  ): void {
    this.camera.projectionMatrix.fromArray(projectionMatrix);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.customProjection = true;
    this.targetDims = targetDims;
  }

  /**
   * Cover-fit the video inside the container MANUALLY (no object-fit), and
   * give the canvas the exact same rect. This keeps three coordinates, MindAR
   * projection, and QR video-space anchors all in one consistent frame.
   */
  layout = (): void => {
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const vw = this.video.videoWidth || 1280;
    const vh = this.video.videoHeight || 720;
    const scale = Math.max(cw / vw, ch / vh);
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    const left = Math.round((cw - w) / 2);
    const top = Math.round((ch - h) / 2);

    for (const el of [this.video, this.renderer.domElement] as const) {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.position = 'absolute';
    }
    this.renderer.setSize(w, h, false);
    if (!this.customProjection) {
      this.camera.aspect = vw / vh;
      this.camera.updateProjectionMatrix();
    }
  };

  /** Match celebration: quick pop on both objects. */
  celebrateMatch(cardIds: string[]): void {
    for (const id of cardIds) {
      const obj = this.objects.get(id);
      if (obj) obj.bornAt = performance.now() - APPEAR_MS * 0.4; // replay the pop
    }
  }

  /** Miss feedback: objects dim & sink until the reveal ends. */
  markMissed(cardIds: string[]): void {
    for (const id of cardIds) {
      const obj = this.objects.get(id);
      if (obj) {
        obj.state = 'missed';
        obj.missedAt = performance.now();
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.layout);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --------------------------------------------------------------------------

  private tick = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = this.clock.getDelta();
    const now = performance.now();

    const tracks = this.tracksProvider();
    const liveCardIds = new Set(tracks.map((t) => t.cardId));

    // Remove objects whose track disappeared (card flipped back / off screen).
    for (const [cardId, obj] of this.objects) {
      if (!liveCardIds.has(cardId)) {
        this.scene.remove(obj.group);
        this.objects.delete(cardId);
      }
    }

    for (const track of tracks) {
      const obj = this.ensureObject(track);
      if (!obj) continue;
      this.applyTransform(obj, track);
      this.animate(obj, dt, now);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private ensureObject(track: ResolvedTrack): StageObject | null {
    const existing = this.objects.get(track.cardId);
    if (existing) return existing;

    const pair = pairOf(this.set, track.pairId);
    if (!pair) return null;

    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    const inner = new THREE.Group();
    const spinner = new THREE.Group();
    inner.add(spinner);
    group.add(inner);
    const obj: StageObject = {
      group,
      inner,
      spinner,
      pair,
      bornAt: performance.now(),
      spinAngle: 0,
      state: 'active',
      missedAt: 0,
    };
    this.objects.set(track.cardId, obj);
    this.scene.add(group);

    void this.loadPairObject(pair).then((model) => {
      // The track may already be gone by the time the GLB arrives.
      if (this.objects.get(track.cardId) === obj) spinner.add(model.clone(true));
    });
    return obj;
  }

  private applyTransform(obj: StageObject, track: ResolvedTrack): void {
    const { pair } = obj;
    if (track.worldMatrix && track.targetIndex !== undefined) {
      // Pose mode: anchor.matrix = worldMatrix × postMatrix (MindAR convention:
      // origin at marker center, 1 unit = marker width).
      const dims = this.targetDims(track.targetIndex) ?? [1, 1];
      const [w, h] = dims;
      const post = new THREE.Matrix4().compose(
        new THREE.Vector3(w / 2, w / 2 + (h - w) / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(w, w, w),
      );
      const world = new THREE.Matrix4().fromArray(track.worldMatrix);
      obj.group.matrix.multiplyMatrices(world, post);
      // Lay content just above the card plane, facing up.
      obj.inner.position.set(0, 0, pair.object.yOffset);
      obj.inner.rotation.set(Math.PI / 2, 0, 0); // card plane (xy) -> object up (z)
      obj.inner.scale.setScalar(pair.object.scale);
      return;
    }

    if (track.anchor) {
      // Billboard mode: fixed depth along the ray through the QR center.
      const ndc = new THREE.Vector3(track.anchor.x * 2 - 1, -(track.anchor.y * 2 - 1), 0.5);
      ndc.unproject(this.camera);
      const dir = ndc.sub(this.camera.position).normalize();
      const pos = this.camera.position.clone().add(dir.multiplyScalar(BILLBOARD_DEPTH));

      // Printed QR width is a known fraction of the card width — recover the
      // card's world width from the code's on-screen size.
      const vFov = (this.camera.fov * Math.PI) / 180;
      const frustumH = 2 * BILLBOARD_DEPTH * Math.tan(vFov / 2);
      const frustumW = frustumH * this.camera.aspect;
      const cardWidthWorld = Math.min(
        (track.anchor.size / QR_FRACTION) * frustumW,
        frustumW * 0.7,
      );

      const m = new THREE.Matrix4().compose(
        pos,
        this.camera.quaternion.clone(),
        new THREE.Vector3(cardWidthWorld, cardWidthWorld, cardWidthWorld),
      );
      obj.group.matrix.copy(m);
      obj.inner.position.set(0, pair.object.yOffset * 0.5, 0);
      obj.inner.rotation.set(0, 0, 0);
      obj.inner.scale.setScalar(pair.object.scale);
    }
  }

  private animate(obj: StageObject, dt: number, now: number): void {
    // Appear pop: overshoot ease.
    const age = now - obj.bornAt;
    const t = Math.min(1, age / APPEAR_MS);
    const pop = t < 1 ? 1.15 * (1 - Math.pow(1 - t, 3)) - 0.15 * (1 - t) : 1;

    let dim = 1;
    if (obj.state === 'missed') {
      const mt = Math.min(1, (now - obj.missedAt) / MISS_FADE_MS);
      dim = 1 - 0.6 * mt;
    }
    obj.spinner.scale.setScalar(Math.max(0.001, pop * dim));

    // Idle spin around the object's up axis.
    obj.spinAngle += obj.pair.object.spin * dt;
    obj.spinner.rotation.set(0, obj.spinAngle, 0);
  }

  private loadPairObject(pair: SetPair): Promise<THREE.Object3D> {
    const url = setAssetUrl(this.set.setId, pair.object.src);
    let cached = this.modelCache.get(url);
    if (!cached) {
      cached =
        pair.object.kind === 'model'
          ? new GLTFLoader().loadAsync(url).then((gltf) => gltf.scene)
          : this.loadImageBillboard(url);
      this.modelCache.set(url, cached);
    }
    return cached;
  }

  /** Flat image content: a texture on a unit-width plane (aspect preserved). */
  private async loadImageBillboard(url: string): Promise<THREE.Object3D> {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    const img = texture.image as { width: number; height: number };
    const aspect = img.height / img.width;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, aspect),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
    return mesh;
  }
}
