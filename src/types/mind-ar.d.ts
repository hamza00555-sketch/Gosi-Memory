/**
 * Hand-written ambient types for the parts of mind-ar we actually use.
 * The package ships no TypeScript types; keep these minimal and honest.
 */
declare module 'mind-ar/dist/mindar-image.prod.js' {
  export interface MindArControllerOptions {
    inputWidth: number;
    inputHeight: number;
    maxTrack?: number;
    warmupTolerance?: number | null;
    missTolerance?: number | null;
    filterMinCF?: number | null;
    filterBeta?: number | null;
    debugMode?: boolean;
    onUpdate?: (data: {
      type: 'updateMatrix' | 'processDone';
      targetIndex?: number;
      /** Column-major 4x4; null when the target is lost. */
      worldMatrix?: number[] | null;
    }) => void;
  }

  export class Controller {
    constructor(options: MindArControllerOptions);
    /** [ [width, height], ... ] per compiled target, set after addImageTargets*. */
    markerDimensions: Array<[number, number]> | null;
    addImageTargets(url: string): Promise<{ dimensions: Array<[number, number]> }>;
    addImageTargetsFromBuffer(buffer: ArrayBuffer): { dimensions: Array<[number, number]> };
    /** Warm up the GPU pipeline so the first real detection isn't janky. */
    dummyRun(input: HTMLVideoElement): Promise<void>;
    processVideo(input: HTMLVideoElement): void;
    stopProcessVideo(): void;
    dispose(): void;
    /** Column-major 16-float projection matrix for the input dimensions. */
    getProjectionMatrix(): number[];
  }

  export class Compiler {
    compileImageTargets(
      images: Array<HTMLImageElement | HTMLCanvasElement | ImageBitmap>,
      onProgress?: (progress: number) => void,
    ): Promise<unknown>;
    exportData(): Promise<ArrayBuffer>;
  }
}
