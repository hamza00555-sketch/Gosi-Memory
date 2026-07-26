/**
 * mind-ar ships no type declarations. We only ever touch the HEADLESS image
 * controller — the `mindar-image-three` build bundles its own copy of three.js,
 * which would give the app two THREE instances and two WebGL renderers.
 *
 * Everything below mirrors the runtime shape of
 * node_modules/mind-ar/dist/controller-*.js at 1.2.5.
 */
declare module 'mind-ar/dist/mindar-image.prod.js' {
  /** Column-major 4x4, 16 entries — feeds THREE.Matrix4.fromArray directly. */
  export type MindArMatrix = number[];

  export interface MindArUpdateEvent {
    type: 'updateMatrix' | 'processDone';
    /** Position of the image inside the compiled .mind file. */
    targetIndex?: number;
    /** null means the controller has given up tracking this target. */
    worldMatrix?: MindArMatrix | null;
  }

  export interface MindArControllerOptions {
    inputWidth: number;
    inputHeight: number;
    onUpdate?: ((event: MindArUpdateEvent) => void) | null;
    debugMode?: boolean;
    /** How many targets may be tracked at once. Costs GPU time per extra one. */
    maxTrack?: number;
    /** Frames a target must be tracked before it is reported at all. */
    warmupTolerance?: number | null;
    /** Frames a tracked target may be missed before worldMatrix goes null. */
    missTolerance?: number | null;
    filterMinCF?: number | null;
    filterBeta?: number | null;
  }

  export interface MindArAddTargetsResult {
    /** [width, height] in target-image pixels, indexed by targetIndex. */
    dimensions: Array<[number, number]>;
  }

  export class Controller {
    constructor(options: MindArControllerOptions);
    readonly inputWidth: number;
    readonly inputHeight: number;
    addImageTargets(mindFileUrl: string): Promise<MindArAddTargetsResult>;
    addImageTargetsFromBuffer(buffer: ArrayBuffer): MindArAddTargetsResult;
    /** Synchronous GPU warm-up. Must run after targets are added. */
    dummyRun(video: HTMLVideoElement): void;
    processVideo(video: HTMLVideoElement): void;
    stopProcessVideo(): void;
    getProjectionMatrix(): MindArMatrix;
    dispose(): void;
  }

  export class Compiler {
    compileImageTargets(
      images: HTMLImageElement[],
      onProgress?: (percent: number) => void,
    ): Promise<unknown>;
    exportData(): Promise<ArrayBuffer>;
  }

  export class UI {
    constructor(options: unknown);
  }
}
