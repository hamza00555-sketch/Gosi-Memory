import type { RoomId } from '../domain/ids';

/**
 * Route table. Screens navigate through these helpers rather than string
 * literals so a path change is a one-line edit.
 */
export const ROUTES = {
  splash: '/',
  onboarding: '/onboarding',
  howToPlay: '/how-to-play',
  lobby: '/lobby',
  join: '/join',
  setup: '/room/:roomId/setup',
  prepare: '/room/:roomId/prepare',
  play: '/room/:roomId/play',
  results: '/room/:roomId/results',
  devSimulator: '/dev/ar-simulator',
} as const;

export const to = {
  splash: () => '/',
  onboarding: () => '/onboarding',
  howToPlay: () => '/how-to-play',
  lobby: () => '/lobby',
  join: () => '/join',
  setup: (roomId: RoomId) => `/room/${roomId}/setup`,
  prepare: (roomId: RoomId) => `/room/${roomId}/prepare`,
  play: (roomId: RoomId) => `/room/${roomId}/play`,
  results: (roomId: RoomId) => `/room/${roomId}/results`,
  devSimulator: () => '/dev/ar-simulator',
};
