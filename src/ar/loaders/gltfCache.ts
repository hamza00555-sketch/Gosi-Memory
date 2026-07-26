import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * One fetch per url, ever. Both cards of a pair and both object sets routinely
 * point at the same GLB, and a phone re-downloading it per anchor is the
 * difference between an instant reveal and a two-second hole.
 */
const resolved = new Map<string, GLTF>();
const inFlight = new Map<string, Promise<GLTF>>();

let loader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  // Constructed lazily: nothing in this module may touch WebGL or the network
  // at import time.
  loader ??= new GLTFLoader();
  return loader;
}

export function loadGltf(url: string): Promise<GLTF> {
  const cached = resolved.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = getLoader()
    .loadAsync(url)
    .then((gltf) => {
      resolved.set(url, gltf);
      inFlight.delete(url);
      return gltf;
    })
    .catch((error: unknown) => {
      inFlight.delete(url);
      throw error;
    });

  inFlight.set(url, promise);
  return promise;
}

export function getCachedGltf(url: string): GLTF | undefined {
  return resolved.get(url);
}

export function isGltfCached(url: string): boolean {
  return resolved.has(url);
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

/** Releases GPU memory for every cached model. Call when leaving the AR screen. */
export function clearGltfCache(): void {
  for (const gltf of resolved.values()) {
    gltf.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const material: THREE.Material | THREE.Material[] = node.material;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else disposeMaterial(material);
    });
  }
  resolved.clear();
  inFlight.clear();
}
