import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CARDS, getDefaultObjectSet, getObjectSet } from '../../content';
import type { ObjectSetId, TargetId } from '../../domain/ids';
import type { ArObjectDefinition, PlaceholderShape } from '../../domain/objectSets';
import { resolveArObject } from '../../domain/objectSets';
import { getCachedGltf, loadGltf } from './gltfCache';

export type ObjectSetProgress = (loaded: number, total: number) => void;

export interface InstantiatedObject {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** True when the GLB was missing and a procedural stand-in was built. */
  isPlaceholder: boolean;
  definition: ArObjectDefinition;
}

/** Shared across every placeholder so a whole missing set costs four geometries. */
const placeholderGeometries = new Map<PlaceholderShape, THREE.BufferGeometry>();

function placeholderGeometry(shape: PlaceholderShape): THREE.BufferGeometry {
  const existing = placeholderGeometries.get(shape);
  if (existing) return existing;

  let geometry: THREE.BufferGeometry;
  switch (shape) {
    case 'orb':
      geometry = new THREE.SphereGeometry(0.3, 32, 20);
      break;
    case 'ring':
      geometry = new THREE.TorusGeometry(0.28, 0.09, 20, 48);
      break;
    case 'cube':
      geometry = new THREE.BoxGeometry(0.44, 0.44, 0.44);
      break;
    case 'prism':
    default:
      geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 6);
      break;
  }
  placeholderGeometries.set(shape, geometry);
  return geometry;
}

function buildPlaceholder(definition: ArObjectDefinition, targetId: TargetId): THREE.Object3D {
  const color = new THREE.Color(definition.placeholderColor);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.32,
    metalness: 0.1,
    emissive: color.clone().multiplyScalar(0.22),
  });
  const mesh = new THREE.Mesh(placeholderGeometry(definition.placeholderShape), material);
  mesh.name = `placeholder:${targetId}`;
  // A card lies flat on the table; stand the mesh up so it reads as an object
  // sitting on the card rather than a decal printed into it.
  mesh.position.y = 0.3;
  return mesh;
}

/**
 * Resolves every card's object for one set, preloads the GLBs, and hands out
 * instances. A set that is only half authored falls back to the default set per
 * resolveArObject; a GLB that will not load falls back to procedural art. The
 * pipeline is therefore always exercisable end to end — a blank card always
 * means a tracking bug, never a missing file.
 */
export class ObjectSetLoader {
  readonly objectSetId: ObjectSetId;

  private readonly definitions = new Map<TargetId, ArObjectDefinition>();
  private readonly missing = new Set<string>();
  private readonly ownedMaterials: THREE.Material[] = [];
  private preloading: Promise<void> | null = null;

  constructor(objectSetId: ObjectSetId) {
    this.objectSetId = objectSetId;
    const defaultSet = getDefaultObjectSet();
    const set = getObjectSet(objectSetId) ?? defaultSet;
    for (const card of CARDS) {
      const definition = resolveArObject(set, defaultSet, card.targetId);
      if (definition) this.definitions.set(card.targetId, definition);
    }
  }

  /** Model paths that failed to load, so the UI can admit placeholder art. */
  get missingModels(): string[] {
    return [...this.missing].sort();
  }

  get usesPlaceholders(): boolean {
    return this.missing.size > 0;
  }

  definitionFor(targetId: TargetId): ArObjectDefinition | null {
    return this.definitions.get(targetId) ?? null;
  }

  /** Never rejects: a failed model becomes a placeholder, not an exception. */
  preload(onProgress?: ObjectSetProgress): Promise<void> {
    this.preloading ??= this.preloadInternal(onProgress);
    return this.preloading;
  }

  private async preloadInternal(onProgress?: ObjectSetProgress): Promise<void> {
    const urls = [...new Set([...this.definitions.values()].map((d) => d.modelPath))];
    const total = urls.length;
    let loaded = 0;
    onProgress?.(0, total);

    await Promise.all(
      urls.map(async (url) => {
        try {
          await loadGltf(url);
        } catch {
          this.missing.add(url);
        } finally {
          loaded += 1;
          onProgress?.(loaded, total);
        }
      }),
    );

    if (this.missing.size > 0) {
      console.warn(
        `[ar] ${this.missing.size} model(s) unavailable for set "${this.objectSetId}"; ` +
          'using procedural placeholders. See docs/AR-TARGETS.md.',
        this.missingModels,
      );
    }
  }

  /**
   * Returns a wrapper carrying the definition's scale/position/rotation, so the
   * anchor can animate its own group without clobbering authored placement.
   */
  instantiate(targetId: TargetId): THREE.Object3D | null {
    return this.instantiateDetailed(targetId)?.object ?? null;
  }

  instantiateDetailed(targetId: TargetId): InstantiatedObject | null {
    const definition = this.definitions.get(targetId);
    if (!definition) return null;

    const gltf = getCachedGltf(definition.modelPath);
    let inner: THREE.Object3D;
    let clips: THREE.AnimationClip[];
    let isPlaceholder: boolean;

    if (gltf) {
      // SkeletonUtils.clone, not Object3D.clone: a plain clone shares the
      // skeleton, so two anchors of the same model would animate as one.
      inner = cloneSkinned(gltf.scene);
      clips = gltf.animations;
      isPlaceholder = false;
    } else {
      inner = buildPlaceholder(definition, targetId);
      if (inner instanceof THREE.Mesh) {
        const material: THREE.Material | THREE.Material[] = inner.material;
        if (Array.isArray(material)) this.ownedMaterials.push(...material);
        else this.ownedMaterials.push(material);
      }
      clips = [];
      isPlaceholder = true;
      this.missing.add(definition.modelPath);
    }

    const wrapper = new THREE.Group();
    wrapper.name = `object:${targetId}`;
    const [sx, sy, sz] = definition.scale;
    const [px, py, pz] = definition.position;
    const [rx, ry, rz] = definition.rotation;
    wrapper.scale.set(sx, sy, sz);
    wrapper.position.set(px, py, pz);
    wrapper.rotation.set(rx, ry, rz);
    wrapper.add(inner);

    return { object: wrapper, clips, isPlaceholder, definition };
  }

  clipsFor(targetId: TargetId): THREE.AnimationClip[] {
    const definition = this.definitions.get(targetId);
    if (!definition) return [];
    return getCachedGltf(definition.modelPath)?.animations ?? [];
  }

  /** Disposes only what this loader created; cached GLBs belong to gltfCache. */
  dispose(): void {
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.length = 0;
  }
}

/** Frees the shared placeholder geometries. Call when leaving AR entirely. */
export function disposePlaceholderGeometries(): void {
  for (const geometry of placeholderGeometries.values()) geometry.dispose();
  placeholderGeometries.clear();
}

/**
 * One-shot preload for the prepare screen. Returns which models were missing so
 * the UI can say plainly that placeholder art is in use rather than letting a
 * player discover it mid-match.
 */
export async function preloadObjectSet(
  objectSetId: ObjectSetId,
  onProgress?: ObjectSetProgress,
): Promise<{ loader: ObjectSetLoader; missingModels: string[] }> {
  const loader = new ObjectSetLoader(objectSetId);
  await loader.preload(onProgress);
  return { loader, missingModels: loader.missingModels };
}
