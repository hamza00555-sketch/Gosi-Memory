import { beforeEach, describe, expect, it } from 'vitest';
import { LocalGameService } from './LocalGameService';

const host = { playerId: 'p1', displayName: 'لاعب', avatarUrl: null };
const guest = { playerId: 'p2', displayName: 'خصم', avatarUrl: null };

function service() {
  // Fresh storage between tests.
  globalThis.localStorage?.clear?.();
  return new LocalGameService();
}

describe('room/game state transitions', () => {
  let svc: LocalGameService;
  beforeEach(() => {
    svc = service();
  });

  it('creates a solo room in waiting then becomes ready when host readies up', async () => {
    const created = await svc.createRoom({ mode: 'solo_ai', host, difficulty: 'easy' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe('waiting');
    // AI member is auto-added and already ready.
    expect(created.value.members).toHaveLength(2);

    const ready = await svc.setReady({
      roomId: created.value.id,
      playerId: 'p1',
      isReady: true,
    });
    expect(ready.ok && ready.value.status).toBe('ready');
  });

  it('starts a solo game with the host moving first', async () => {
    const created = await svc.createRoom({ mode: 'solo_ai', host });
    if (!created.ok) return;
    await svc.setReady({ roomId: created.value.id, playerId: 'p1', isReady: true });
    const started = await svc.startGame({ roomId: created.value.id, playerId: 'p1' });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.status).toBe('in_progress');
    expect(started.value.currentTurnPlayerId).toBe('p1');
    expect(started.value.deck.length).toBeGreaterThan(0);
  });

  it('does not start until the room is ready', async () => {
    const created = await svc.createRoom({ mode: 'solo_ai', host });
    if (!created.ok) return;
    const started = await svc.startGame({ roomId: created.value.id, playerId: 'p1' });
    expect(started.ok).toBe(false);
  });

  it('joins a 1v1 room by code and fills to ready', async () => {
    const created = await svc.createRoom({ mode: 'one_vs_one', host });
    if (!created.ok) return;
    const code = created.value.code;

    const joined = await svc.joinRoom({ code, player: guest });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.value.members).toHaveLength(2);

    await svc.setReady({ roomId: created.value.id, playerId: 'p1', isReady: true });
    const r = await svc.setReady({ roomId: created.value.id, playerId: 'p2', isReady: true });
    expect(r.ok && r.value.status).toBe('ready');
  });

  it('rejects joining a full 1v1 room', async () => {
    const created = await svc.createRoom({ mode: 'one_vs_one', host });
    if (!created.ok) return;
    await svc.joinRoom({ code: created.value.code, player: guest });
    const third = await svc.joinRoom({
      code: created.value.code,
      player: { playerId: 'p3', displayName: 'ثالث', avatarUrl: null },
    });
    expect(third.ok).toBe(false);
  });

  it('reconnects to an existing room without destroying it', async () => {
    const created = await svc.createRoom({ mode: 'one_vs_one', host });
    if (!created.ok) return;
    const re = await svc.reconnectToRoom({ roomId: created.value.id, playerId: 'p1' });
    expect(re.ok).toBe(true);
    if (re.ok) expect(re.value.room.id).toBe(created.value.id);
  });
});
