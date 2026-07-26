import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_OBJECT_SET_ID } from '../domain/objectSets';
import type { ObjectSetId } from '../domain/ids';
import type { RoomId, TeamId } from '../domain/ids';

/**
 * Per-device preferences and the pointer back into an in-progress match.
 *
 * Deliberately NOT game state: the match lives in the backend and arrives via
 * subscription. What is kept here is only what this phone needs to rejoin and
 * to render its own cosmetic choices, which is exactly what must survive a
 * refresh.
 */
interface DeviceState {
  /** Anonymous auth uid, cached so a refresh does not look like a new device. */
  deviceUid: string | null;
  /** The room this device is currently in, for reconnect-after-refresh. */
  roomId: RoomId | null;
  /** Which side of the table this device is playing. */
  teamId: TeamId | null;

  selectedObjectSetId: ObjectSetId;
  /** Store scaffolding — the default set is owned by everyone, free. */
  ownedObjectSetIds: ObjectSetId[];

  onboardingSeen: boolean;
  soundEnabled: boolean;

  setIdentity: (uid: string) => void;
  setRoom: (roomId: RoomId | null, teamId: TeamId | null) => void;
  selectObjectSet: (id: ObjectSetId) => void;
  grantObjectSet: (id: ObjectSetId) => void;
  ownsObjectSet: (id: ObjectSetId) => boolean;
  completeOnboarding: () => void;
  toggleSound: () => void;
  clearRoom: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceUid: null,
      roomId: null,
      teamId: null,
      selectedObjectSetId: DEFAULT_OBJECT_SET_ID,
      ownedObjectSetIds: [DEFAULT_OBJECT_SET_ID],
      onboardingSeen: false,
      soundEnabled: true,

      setIdentity: (uid) => set({ deviceUid: uid }),
      setRoom: (roomId, teamId) => set({ roomId, teamId }),
      selectObjectSet: (id) => set({ selectedObjectSetId: id }),
      grantObjectSet: (id) =>
        set((s) =>
          s.ownedObjectSetIds.includes(id)
            ? s
            : { ownedObjectSetIds: [...s.ownedObjectSetIds, id] },
        ),
      ownsObjectSet: (id) => get().ownedObjectSetIds.includes(id),
      completeOnboarding: () => set({ onboardingSeen: true }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      clearRoom: () => set({ roomId: null, teamId: null }),
    }),
    {
      name: 'qawsi.device.v1',
      // deviceUid is intentionally persisted: losing it on refresh would orphan
      // the device from its team mid-match.
      partialize: (s) => ({
        deviceUid: s.deviceUid,
        roomId: s.roomId,
        teamId: s.teamId,
        selectedObjectSetId: s.selectedObjectSetId,
        ownedObjectSetIds: s.ownedObjectSetIds,
        onboardingSeen: s.onboardingSeen,
        soundEnabled: s.soundEnabled,
      }),
    },
  ),
);
