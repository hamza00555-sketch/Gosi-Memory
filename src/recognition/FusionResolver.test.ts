import { describe, expect, it, vi } from 'vitest';
import { decodeQrPayload, encodeQrPayload } from '../lib/sets';
import { FusionResolver, type ResolvedTrack } from './FusionResolver';
import type { CardSighting } from './types';

function sighting(partial: Partial<CardSighting>): CardSighting {
  return {
    key: 'k1',
    source: 'qr',
    setId: 'beach-day',
    pairId: 'pair_crab',
    side: 'a',
    confidence: 1,
    at: 1000,
    ...partial,
  };
}

function makeResolver(resolveSide: (pairId: string) => 'a' | 'b' | null = () => 'a') {
  const resolver = new FusionResolver({ activeSetId: 'beach-day', resolveSide });
  const seen: ResolvedTrack[] = [];
  resolver.onCardSeen((t) => seen.push(t));
  // Feed events directly through a fake adapter.
  const emit = (e: Parameters<Parameters<typeof resolver.attach>[0]['onEvent']>[0]) => e;
  void emit;
  const push = (e: any) => (resolver as any).handleEvent(e);
  return { resolver, seen, push };
}

describe('QR payload codec', () => {
  it('round-trips a card payload', () => {
    const text = encodeQrPayload({ setId: 'beach-day', pairId: 'pair_crab', side: 'b' });
    expect(text).toBe('gosi1:beach-day:pair_crab:b');
    expect(decodeQrPayload(text)).toEqual({
      setId: 'beach-day',
      pairId: 'pair_crab',
      side: 'b',
    });
  });

  it('rejects foreign QR codes', () => {
    expect(decodeQrPayload('https://example.com')).toBeNull();
    expect(decodeQrPayload('gosi1:only:three')).toBeNull();
    expect(decodeQrPayload('gosi1:s:p:c')).toBeNull();
  });
});

describe('FusionResolver', () => {
  it('emits one cardSeen per new sighting and tracks it', () => {
    const { resolver, seen, push } = makeResolver();
    push({ type: 'found', sighting: sighting({}) });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.cardId).toBe('pair_crab:a');
    expect(resolver.getTracks()).toHaveLength(1);
  });

  it('dedups the same card seen by both adapters within the window', () => {
    const { seen, push } = makeResolver();
    push({ type: 'found', sighting: sighting({ key: 'qr1', source: 'qr', at: 1000 }) });
    push({
      type: 'found',
      sighting: sighting({ key: 'img1', source: 'image', side: null, at: 1500 }),
    });
    expect(seen).toHaveLength(1);
  });

  it('assigns sides to image sightings via the game-state callback', () => {
    const resolveSide = vi.fn().mockReturnValue('b');
    const { seen, push } = makeResolver(resolveSide);
    push({ type: 'found', sighting: sighting({ source: 'image', side: null }) });
    expect(resolveSide).toHaveBeenCalledWith('pair_crab');
    expect(seen[0]!.cardId).toBe('pair_crab:b');
  });

  it('flags QR codes from a different set as noise, without emitting a scan', () => {
    const { resolver, seen, push } = makeResolver();
    const noise = vi.fn();
    resolver.onNoise(noise);
    push({ type: 'found', sighting: sighting({ setId: 'other-set' }) });
    expect(seen).toHaveLength(0);
    expect(noise).toHaveBeenCalledWith('foreign_set');
  });

  it('prefers the pose track when the same card has qr + image tracks', () => {
    const { resolver, push } = makeResolver();
    push({
      type: 'found',
      sighting: sighting({ key: 'qr1', anchor: { x: 0.5, y: 0.5, size: 0.2 } }),
    });
    push({
      type: 'found',
      sighting: sighting({
        key: 'img1',
        source: 'image',
        side: null,
        at: 1400,
        worldMatrix: new Array(16).fill(1),
      }),
    });
    const tracks = resolver.getTracks();
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.worldMatrix).toBeDefined();
  });

  it('drops tracks on lost events', () => {
    const { resolver, push } = makeResolver();
    push({ type: 'found', sighting: sighting({}) });
    push({ type: 'lost', key: 'k1' });
    expect(resolver.getTracks()).toHaveLength(0);
  });
});
