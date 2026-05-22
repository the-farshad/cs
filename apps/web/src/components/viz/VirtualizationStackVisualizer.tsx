import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Two parts:
//  (1) A side-by-side comparison of the VM stack vs the container stack, built
//      up layer by layer so you can see where each adds a guest OS or shares the
//      host kernel.
//  (2) A small image-layer composition: a container image is read-only layers
//      stacked under one writable layer, deduplicated across containers.

type Mode = 'vm' | 'container';

type Layer = {
  label: string;
  detail: string;
  color: string;
  // For the container side, mark which layer is the single shared kernel.
  shared?: boolean;
};

// Layers are listed top (app) to bottom (hardware) for display.
const VM_LAYERS: Layer[] = [
  { label: 'App + libs', detail: 'your process and its dependencies', color: '#38bdf8' },
  { label: 'Guest OS', detail: 'a full kernel per VM', color: '#fbbf24' },
  { label: 'Guest OS', detail: 'a full kernel per VM', color: '#fbbf24' },
  { label: 'Hypervisor', detail: 'virtualises CPU, memory, devices', color: '#8b5cf6' },
  { label: 'Hardware', detail: 'physical CPU, RAM, disk, NIC', color: '#10b981' },
];

const CONTAINER_LAYERS: Layer[] = [
  { label: 'App + libs', detail: 'process isolated by namespaces + cgroups', color: '#38bdf8' },
  { label: 'Container runtime', detail: 'starts processes, sets up isolation', color: '#8b5cf6' },
  { label: 'Host kernel', detail: 'ONE shared kernel for all containers', color: '#fbbf24', shared: true },
  { label: 'Hardware', detail: 'physical CPU, RAM, disk, NIC', color: '#10b981' },
];

// Image layers (bottom = base, top = writable). Two containers share the
// read-only layers; only the writable layer is per-container.
const IMAGE_LAYERS = [
  { label: 'base userland', kind: 'ro' as const, color: '#10b981' },
  { label: 'runtime + deps', kind: 'ro' as const, color: '#8b5cf6' },
  { label: 'app code', kind: 'ro' as const, color: '#38bdf8' },
  { label: 'writable layer', kind: 'rw' as const, color: '#fbbf24' },
];

type Frame = { revealed: number; note: string };

function buildFrames(mode: Mode): Frame[] {
  const layers = mode === 'vm' ? VM_LAYERS : CONTAINER_LAYERS;
  const n = layers.length;
  const frames: Frame[] = [];
  // Reveal bottom-up: hardware first, app last — that is how a stack is built.
  for (let k = 0; k <= n; k++) {
    const justAdded = k > 0 ? layers[n - k] : null; // bottom-up index
    let note: string;
    if (k === 0) note = 'Start from bare hardware and build the stack upward.';
    else if (justAdded?.shared)
      note = `Add the ${justAdded.label.toLowerCase()} — a SINGLE kernel shared by every container (no per-app guest OS).`;
    else if (k === n)
      note =
        mode === 'vm'
          ? 'Each app sits on its own guest OS — strong isolation, but every VM ships a whole kernel.'
          : 'Each app is just an isolated process on the shared kernel — lightweight and fast to start.';
    else note = `Add the ${justAdded?.label.toLowerCase()} layer (${justAdded?.detail}).`;
    frames.push({ revealed: k, note });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

function StackColumn({
  title,
  subtitle,
  layers,
  revealed,
  twoApps,
}: {
  title: string;
  subtitle: string;
  layers: Layer[];
  revealed: number;
  twoApps: boolean;
}) {
  const n = layers.length;
  return (
    <div className="flex flex-col rounded-lg border border-edge bg-bg p-3">
      <div className="mb-2">
        <div className="font-mono text-sm text-fg">{title}</div>
        <div className="text-[11px] text-muted">{subtitle}</div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {layers.map((layer, i) => {
          // bottom-up reveal: a layer at display index i (0=top) is revealed once
          // `revealed` has reached (n - i).
          const isShown = revealed >= n - i;
          const isTopApp = i === 0;
          // For the app row, optionally render two side-by-side apps to stress the
          // "guest OS per app vs shared kernel" point.
          const appCells = twoApps && (isTopApp || layer.label === 'Guest OS');
          return (
            <div
              key={i}
              className="rounded border px-3 py-2 transition-all"
              style={{
                borderColor: isShown ? layer.color : 'var(--edge)',
                background: isShown ? 'color-mix(in oklab, ' + layer.color + ' 14%, var(--bg))' : 'transparent',
                opacity: isShown ? 1 : 0.25,
              }}
            >
              {appCells ? (
                <div className="flex gap-1.5">
                  {[0, 1].map((c) => (
                    <div key={c} className="flex-1 text-center">
                      <div className="font-mono text-xs" style={{ color: isShown ? layer.color : 'var(--muted)' }}>
                        {layer.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs" style={{ color: isShown ? layer.color : 'var(--muted)' }}>
                    {layer.label}
                  </span>
                  {layer.shared && isShown && (
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                      shared
                    </span>
                  )}
                </div>
              )}
              <div className="mt-0.5 text-[10px] text-muted">{layer.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VirtualizationStackVisualizer() {
  const [mode, setMode] = useState<Mode>('container');
  const frames = useMemo(() => buildFrames(mode), [mode]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const layers = mode === 'vm' ? VM_LAYERS : CONTAINER_LAYERS;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          <button
            type="button"
            onClick={() => setMode('vm')}
            aria-pressed={mode === 'vm'}
            className={`px-3 py-1 text-sm transition ${mode === 'vm' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            Virtual machines
          </button>
          <button
            type="button"
            onClick={() => setMode('container')}
            aria-pressed={mode === 'container'}
            className={`px-3 py-1 text-sm transition ${mode === 'container' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            Containers
          </button>
        </div>
        <span className="text-xs text-muted">Built bottom-up: hardware first, app on top.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* The active stack, animated */}
        <StackColumn
          title={mode === 'vm' ? 'VM stack' : 'Container stack'}
          subtitle={
            mode === 'vm'
              ? 'two apps, each in its own VM'
              : 'two apps, each an isolated process'
          }
          layers={layers}
          revealed={frame.revealed}
          twoApps
        />

        {/* Image layers — independent of the stepper, illustrative */}
        <div className="flex flex-col rounded-lg border border-edge bg-bg p-3">
          <div className="mb-2">
            <div className="font-mono text-sm text-fg">Image layers</div>
            <div className="text-[11px] text-muted">read-only layers shared; one writable layer per container</div>
          </div>
          <div className="flex flex-1 flex-col-reverse gap-1.5">
            {IMAGE_LAYERS.map((l, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded border px-3 py-2"
                style={{
                  borderColor: l.color,
                  background: 'color-mix(in oklab, ' + l.color + ' 12%, var(--bg))',
                  borderStyle: l.kind === 'rw' ? 'dashed' : 'solid',
                }}
              >
                <span className="font-mono text-xs" style={{ color: l.color }}>
                  {l.label}
                </span>
                <span className="font-mono text-[10px] text-muted">{l.kind === 'rw' ? 'read-write' : 'read-only'}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Pulling a second image that shares a base layer reuses it — no re-download, less disk. Each running
            container gets its own thin writable layer on top.
          </p>
        </div>
      </div>

      {/* Quick contrast chips */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-edge bg-bg p-2.5">
          <div className="mb-0.5 font-mono text-[11px] text-muted">isolation</div>
          <div className="text-fg">{mode === 'vm' ? 'separate kernels — strong' : 'shared kernel — process-level'}</div>
        </div>
        <div className="rounded-lg border border-edge bg-bg p-2.5">
          <div className="mb-0.5 font-mono text-[11px] text-muted">startup</div>
          <div className="text-fg">{mode === 'vm' ? 'seconds (boot an OS)' : 'milliseconds (just exec)'}</div>
        </div>
        <div className="rounded-lg border border-edge bg-bg p-2.5">
          <div className="mb-0.5 font-mono text-[11px] text-muted">overhead</div>
          <div className="text-fg">{mode === 'vm' ? 'a full OS per VM' : 'namespaces + cgroups only'}</div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={8} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{frame.note}</div>
    </div>
  );
}
