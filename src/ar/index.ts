export { ArStage } from './ArStage';
export type { ArStatus } from './ArStage';

export { AR_TUNING } from './arConfig';

export { ScanGate } from './recognition/scanGate';
export type { ScanVerdict, ScanGateOptions, SelectablePredicate } from './recognition/scanGate';
export type {
  CardRecognizer,
  RecognitionEvent,
  RecognitionListener,
  TargetSighting,
  Unsubscribe,
} from './recognition/types';
export { MindArRecognizer } from './recognition/MindArRecognizer';
export { SimulatorRecognizer, isSimulatorEnabled } from './recognition/SimulatorRecognizer';

export { ArScene } from './rendering/ArScene';
export { ObjectAnchor } from './rendering/ObjectAnchor';

export { ObjectSetLoader, preloadObjectSet } from './loaders/objectSetLoader';
export type { InstantiatedObject, ObjectSetProgress } from './loaders/objectSetLoader';
export { targetsAvailable, preloadTargets, getMindFileUrl } from './loaders/targetLibrary';
