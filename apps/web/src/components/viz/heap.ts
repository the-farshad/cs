export type HeapFrame = {
  array: number[];
  compare?: number[];
  swap?: number[];
  active?: number;
  note?: string;
};

/** Min-heap insert: append, then sift up while smaller than parent. */
export function* heapInsert(initial: number[], value: number): Generator<HeapFrame> {
  const a = [...initial];
  a.push(value);
  let i = a.length - 1;
  yield { array: [...a], active: i, note: `insert ${value}` };
  while (i > 0) {
    const parent = (i - 1) >> 1;
    yield { array: [...a], compare: [i, parent] };
    if (a[i] < a[parent]) {
      [a[i], a[parent]] = [a[parent], a[i]];
      yield { array: [...a], swap: [i, parent] };
      i = parent;
    } else break;
  }
  yield { array: [...a] };
}

/** Min-heap extract-min: take root, move last to root, sift down. */
export function* heapExtractMin(initial: number[]): Generator<HeapFrame> {
  const a = [...initial];
  if (a.length === 0) {
    yield { array: [] };
    return;
  }
  yield { array: [...a], active: 0, note: `extract min (${a[0]})` };
  const last = a.pop()!;
  if (a.length === 0) {
    yield { array: [] };
    return;
  }
  a[0] = last;
  yield { array: [...a], active: 0, note: 'move last element to the root' };
  let i = 0;
  const n = a.length;
  while (true) {
    let smallest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < n) {
      yield { array: [...a], compare: [smallest, l] };
      if (a[l] < a[smallest]) smallest = l;
    }
    if (r < n) {
      yield { array: [...a], compare: [smallest, r] };
      if (a[r] < a[smallest]) smallest = r;
    }
    if (smallest !== i) {
      [a[i], a[smallest]] = [a[smallest], a[i]];
      yield { array: [...a], swap: [i, smallest] };
      i = smallest;
    } else break;
  }
  yield { array: [...a] };
}
