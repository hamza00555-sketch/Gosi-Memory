/**
 * AR object registry.
 *
 * Defines what gets rendered on top of a recognized card target.
 * Today all modelPaths are null — real .glb files slot in here without
 * touching the adapter or any game logic.
 *
 * The MindARAdapter (when implemented) will:
 *   1. Look up the ArTarget by targetIndex.
 *   2. Look up the ArObject by arObjectId.
 *   3. Instantiate the three.js object and attach it to the MindAR anchor.
 */

export type ArObjectType = 'model_3d' | 'image_overlay' | 'particle_effect';

export interface ArObject {
  /** Must match arObjectId in AR_TARGETS. */
  arObjectId: string;
  objectType: ArObjectType;
  /** Path to the .glb model in /public/ar/models/. Null until model is ready. */
  modelPath: string | null;
  /** Uniform scale applied to the object in AR world space. */
  scale: [number, number, number];
  /** XYZ offset from the anchor center (in AR world units). */
  positionOffset: [number, number, number];
}

export const AR_OBJECTS: ArObject[] = [
  {
    arObjectId: 'ar_obj_qawsi_seal',
    objectType: 'model_3d',
    modelPath: null, // TODO: replace with '/ar/models/qawsi-seal.glb' when ready
    scale: [1, 1, 1],
    positionOffset: [0, 0, 0],
  },
  // TODO: add one entry per AR_TARGETS entry
];

/** Look up an AR object by its id (undefined if not registered). */
export function arObjectById(arObjectId: string): ArObject | undefined {
  return AR_OBJECTS.find((o) => o.arObjectId === arObjectId);
}
