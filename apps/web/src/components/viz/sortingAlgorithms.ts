import type { SortFrame, SortGenerator } from './types';

const allSorted = (a: number[]): SortFrame => ({ array: [...a], sorted: a.map((_, i) => i) });
const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k);

export function* bubbleSort(input: number[]): Generator<SortFrame> {
  const a = [...input];
  const n = a.length;
  const sorted: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      yield { array: [...a], compare: [j, j + 1], sorted: [...sorted] };
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        yield { array: [...a], swap: [j, j + 1], sorted: [...sorted] };
      }
    }
    sorted.push(n - 1 - i);
  }
  yield allSorted(a);
}

export function* selectionSort(input: number[]): Generator<SortFrame> {
  const a = [...input];
  const n = a.length;
  const sorted: number[] = [];
  for (let i = 0; i < n; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) {
      yield { array: [...a], compare: [min, j], sorted: [...sorted] };
      if (a[j] < a[min]) min = j;
    }
    if (min !== i) {
      [a[i], a[min]] = [a[min], a[i]];
      yield { array: [...a], swap: [i, min], sorted: [...sorted] };
    }
    sorted.push(i);
  }
  yield allSorted(a);
}

export function* insertionSort(input: number[]): Generator<SortFrame> {
  const a = [...input];
  const n = a.length;
  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) {
      yield { array: [...a], compare: [j - 1, j], sorted: range(0, i) };
      if (a[j - 1] > a[j]) {
        [a[j - 1], a[j]] = [a[j], a[j - 1]];
        yield { array: [...a], swap: [j - 1, j], sorted: range(0, i) };
        j--;
      } else {
        break;
      }
    }
  }
  yield allSorted(a);
}

export function* mergeSort(input: number[]): Generator<SortFrame> {
  const a = [...input];
  function* msort(lo: number, hi: number): Generator<SortFrame> {
    if (hi - lo <= 1) return;
    const mid = (lo + hi) >> 1;
    yield* msort(lo, mid);
    yield* msort(mid, hi);
    const tmp = a.slice(lo, hi);
    const leftLen = mid - lo;
    const totalLen = hi - lo;
    let i = 0;
    let j = leftLen;
    let k = lo;
    while (i < leftLen && j < totalLen) {
      yield { array: [...a], compare: [lo + i, lo + j] };
      if (tmp[i] <= tmp[j]) {
        a[k] = tmp[i];
        i++;
      } else {
        a[k] = tmp[j];
        j++;
      }
      yield { array: [...a], swap: [k] };
      k++;
    }
    while (i < leftLen) {
      a[k] = tmp[i];
      yield { array: [...a], swap: [k] };
      i++;
      k++;
    }
    while (j < totalLen) {
      a[k] = tmp[j];
      yield { array: [...a], swap: [k] };
      j++;
      k++;
    }
  }
  yield* msort(0, a.length);
  yield allSorted(a);
}

export function* quickSort(input: number[]): Generator<SortFrame> {
  const a = [...input];
  const sorted = new Set<number>();
  function* qs(lo: number, hi: number): Generator<SortFrame> {
    if (lo > hi) return;
    if (lo === hi) {
      sorted.add(lo);
      yield { array: [...a], sorted: [...sorted] };
      return;
    }
    const pivotValue = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      yield { array: [...a], compare: [j, hi], pivot: hi, sorted: [...sorted] };
      if (a[j] < pivotValue) {
        if (i !== j) {
          [a[i], a[j]] = [a[j], a[i]];
          yield { array: [...a], swap: [i, j], pivot: hi, sorted: [...sorted] };
        }
        i++;
      }
    }
    if (i !== hi) {
      [a[i], a[hi]] = [a[hi], a[i]];
      yield { array: [...a], swap: [i, hi], sorted: [...sorted] };
    }
    sorted.add(i);
    yield { array: [...a], sorted: [...sorted] };
    yield* qs(lo, i - 1);
    yield* qs(i + 1, hi);
  }
  yield* qs(0, a.length - 1);
  yield allSorted(a);
}

export type SortMeta = {
  label: string;
  gen: SortGenerator;
  best: string;
  average: string;
  worst: string;
  space: string;
  stable: boolean;
};

export const SORTS = {
  quick: { label: 'Quick sort', gen: quickSort, best: 'Ω(n log n)', average: 'Θ(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: false },
  merge: { label: 'Merge sort', gen: mergeSort, best: 'Ω(n log n)', average: 'Θ(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true },
  bubble: { label: 'Bubble sort', gen: bubbleSort, best: 'Ω(n)', average: 'Θ(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
  insertion: { label: 'Insertion sort', gen: insertionSort, best: 'Ω(n)', average: 'Θ(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
  selection: { label: 'Selection sort', gen: selectionSort, best: 'Ω(n²)', average: 'Θ(n²)', worst: 'O(n²)', space: 'O(1)', stable: false },
} satisfies Record<string, SortMeta>;

export type SortKey = keyof typeof SORTS;
