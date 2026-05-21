import { useCallback, useEffect, useState } from 'react';

/** Drives playback over a fixed number of frames: play / pause / step / scrub.
 *  Renderer-agnostic — pair it with any array of frame snapshots. */
export function useStepper(frameCount: number, initialFps = 12) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(initialFps);

  // New timeline (algorithm/data changed) → rewind.
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [frameCount]);

  useEffect(() => {
    if (!playing) return;
    if (index >= frameCount - 1) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(
      () => setIndex((i) => Math.min(i + 1, frameCount - 1)),
      1000 / fps,
    );
    return () => window.clearTimeout(id);
  }, [playing, index, fps, frameCount]);

  const play = useCallback(() => {
    setIndex((i) => (i >= frameCount - 1 ? 0 : i));
    setPlaying(true);
  }, [frameCount]);
  const pause = useCallback(() => setPlaying(false), []);
  const next = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.min(i + 1, frameCount - 1));
  }, [frameCount]);
  const prev = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);
  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);
  const seek = useCallback((i: number) => {
    setPlaying(false);
    setIndex(i);
  }, []);

  return { index, playing, fps, setFps, play, pause, next, prev, reset, seek };
}
