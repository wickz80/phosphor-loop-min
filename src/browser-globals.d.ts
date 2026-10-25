/** Browser-script interfaces during the incremental TypeScript migration. */
interface Window {
  PhosphorLFO: typeof PhosphorLFO;
  PhosphorLFOState: typeof PhosphorLFOState;
  PhosphorControlRouting: typeof PhosphorControlRouting;
  PhosphorLFOEngine: typeof PhosphorLFOEngine;
  PhosphorDependencies: typeof PhosphorDependencies;
  PhosphorVideoGrade: typeof PhosphorVideoGrade;
  PhosphorBeatClock: typeof PhosphorBeatClock;
}

interface DependencyLoop {
  in1?: string;
  in2?: string;
  trails?: number;
}

interface DependencyState {
  loop?: DependencyLoop;
  audio?: boolean;
  route?: { effect: string } | null;
  video?: { videoGradient?: number };
}
