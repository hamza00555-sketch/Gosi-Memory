import * as THREE from 'three';
import type { TargetId } from '../../domain/ids';
import type { ObjectSetLoader } from '../loaders/objectSetLoader';
import { ObjectAnchor } from './ObjectAnchor';

/**
 * The Three.js side of AR. Framework-free on purpose: it knows about matrices
 * and meshes, never about React, the room, or whose turn it is.
 *
 * Several anchors can be visible at once — both cards of a turn commonly are —
 * so anchors are kept in a map and each carries its own tracker matrix.
 */
export class ArScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly clock = new THREE.Clock();
  private readonly anchors = new Map<TargetId, ObjectAnchor>();

  private renderer: THREE.WebGLRenderer | null = null;
  private frame = 0;
  private loader: ObjectSetLoader | null = null;

  constructor() {
    // The projection matrix comes from the tracker, so three must not
    // recompute one from fov/aspect.
    this.camera.matrixAutoUpdate = false;

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(0.6, 1.4, 1.2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xa0c8ff, 0.7);
    rim.position.set(-0.8, 0.4, -1);
    this.scene.add(rim);
  }

  mount(canvas: HTMLCanvasElement, loader: ObjectSetLoader): void {
    this.loader = loader;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    // Capped at 2: a 3x device pixel ratio triples fragment cost for no visible
    // gain on top of a camera feed.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize();
    this.start();
  }

  resize(): void {
    if (!this.renderer) return;
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
  }

  setProjectionMatrix(matrix: readonly number[] | null): void {
    if (!matrix || matrix.length < 16) return;
    this.camera.projectionMatrix.fromArray(matrix as number[]);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  /** Show (or update) the object for a target at the tracker's matrix. */
  upsertAnchor(targetId: TargetId, worldMatrix: readonly number[] | null, now: number): void {
    let anchor = this.anchors.get(targetId);

    if (!anchor) {
      const instance = this.loader?.instantiateDetailed(targetId);
      if (!instance) return;
      anchor = new ObjectAnchor(targetId, instance);
      this.anchors.set(targetId, anchor);
      this.scene.add(anchor.group);
    }

    if (worldMatrix) anchor.setMatrix(worldMatrix);
    anchor.found(now);
  }

  loseAnchor(targetId: TargetId, now: number): void {
    this.anchors.get(targetId)?.lost(now);
  }

  playReaction(targetId: TargetId, kind: 'match' | 'mismatch', now: number): void {
    const anchor = this.anchors.get(targetId);
    if (!anchor) return;
    if (kind === 'match') anchor.playMatch(now);
    else anchor.playMismatch(now);
  }

  /** Target ids whose object is currently on screen. */
  visibleTargets(): TargetId[] {
    return [...this.anchors.entries()].filter(([, a]) => a.visible).map(([id]) => id);
  }

  private start(): void {
    const loop = (): void => {
      this.frame = requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      const now = performance.now();
      for (const anchor of this.anchors.values()) anchor.update(delta, now);
      this.renderer?.render(this.scene, this.camera);
    };
    this.frame = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    for (const anchor of this.anchors.values()) {
      this.scene.remove(anchor.group);
      anchor.dispose();
    }
    this.anchors.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.loader = null;
  }
}
