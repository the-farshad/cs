/** One snapshot in a visualizer's timeline. Each frame is self-contained so the
 *  Stepper can scrub to any point. Algorithms are authored as generators that
 *  `yield` these. */
export type SortFrame = {
  /** Full array state at this moment. */
  array: number[];
  /** Indices currently being compared. */
  compare?: number[];
  /** Indices being written / swapped. */
  swap?: number[];
  /** Pivot index (quicksort). */
  pivot?: number;
  /** Indices known to be in their final sorted position. */
  sorted?: number[];
  /** Optional human-readable note for narration. */
  note?: string;
};

export type SortGenerator = (input: number[]) => Generator<SortFrame>;
