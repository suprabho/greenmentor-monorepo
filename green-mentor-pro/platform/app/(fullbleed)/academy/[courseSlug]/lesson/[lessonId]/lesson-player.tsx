"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle, Coins, Lightning, WarningCircle } from "@phosphor-icons/react";
import { Card, Chip } from "@/components/ui";

type LessonPlayerLesson = {
  id: string;
  title: string;
  objective: string | null;
  keyTopics: string[];
  completionThresholdPct: number;
  summaryBlock: string | null;
};

// Anti-cheat watch-progress accounting (PRD §6.2 FR-V-04). An "open segment"
// tracks the currently-playing run; timeupdate ticks extend it as long as the
// gap since the last tick looks like normal playback, not a scrub. A jump
// (seek) closes the old segment and opens a fresh one at the destination, so
// scrubbing to the end only ever contributes a near-zero-length segment.
const SEEK_GAP_TOLERANCE_S = 1.5;
const FLUSH_INTERVAL_MS = 7000;

export function LessonPlayer({
  lesson,
  moduleTitle,
  alreadyCompleted,
  furthestPositionS,
  nextHref,
  backHref,
}: {
  lesson: LessonPlayerLesson;
  moduleTitle: string;
  alreadyCompleted: boolean;
  furthestPositionS: number;
  nextHref: string;
  backHref: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [pctWatched, setPctWatched] = useState(alreadyCompleted ? 100 : 0);
  const [result, setResult] = useState<{ xpAwarded: number; coinsAwarded: number } | null>(
    alreadyCompleted ? { xpAwarded: 0, coinsAwarded: 0 } : null
  );

  const openSegment = useRef<[number, number] | null>(null);
  const pending = useRef<[number, number][]>([]);
  const lastTick = useRef<number | null>(null);

  const flush = useCallback(
    async (opts?: { keepalive?: boolean }) => {
      if (openSegment.current) {
        pending.current.push(openSegment.current);
        openSegment.current = null;
      }
      if (!pending.current.length) return;
      const segments = pending.current;
      pending.current = [];
      try {
        const res = await fetch(`/api/academy/lessons/${lesson.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments }),
          keepalive: opts?.keepalive,
        });
        if (!res.ok) return;
        const data = await res.json();
        setPctWatched(data.pctWatched);
        if (data.completed) {
          setResult((prev) => prev ?? { xpAwarded: data.xpAwarded, coinsAwarded: data.coinsAwarded });
          router.refresh();
        }
      } catch {
        // best-effort; unsent segments stay out of `pending` (already spliced
        // out above) — the next flush just carries whatever accrues after this
      }
    },
    [lesson.id, router]
  );

  useEffect(() => {
    if (alreadyCompleted) return;
    let cancelled = false;
    fetch(`/api/academy/lessons/${lesson.id}/signed-url`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "could not load video");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setVideoUrl(data.url);
      })
      .catch((e) => {
        if (!cancelled) setVideoError(e instanceof Error ? e.message : "could not load video");
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id, alreadyCompleted]);

  useEffect(() => {
    if (alreadyCompleted) return;
    const timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush({ keepalive: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void flush({ keepalive: true });
    };
  }, [flush, alreadyCompleted]);

  const onLoadedMetadata = () => {
    if (furthestPositionS > 0 && videoRef.current) {
      videoRef.current.currentTime = furthestPositionS;
    }
  };
  const onPlay = () => {
    const t = videoRef.current?.currentTime ?? 0;
    openSegment.current = [t, t];
    lastTick.current = t;
  };
  const onTimeUpdate = () => {
    const t = videoRef.current?.currentTime ?? 0;
    if (lastTick.current == null || !openSegment.current) {
      openSegment.current = [t, t];
    } else if (Math.abs(t - lastTick.current) <= SEEK_GAP_TOLERANCE_S) {
      openSegment.current[1] = t;
    } else {
      pending.current.push(openSegment.current);
      openSegment.current = [t, t];
    }
    lastTick.current = t;
  };
  const onPauseOrSeekingOrEnded = () => {
    if (openSegment.current) {
      pending.current.push(openSegment.current);
      openSegment.current = null;
    }
    void flush();
  };

  return (
    <div className="flex h-dvh flex-col bg-black">
      {/* Video stage */}
      <div className="relative min-h-0 flex-1">
        <Link
          href={backHref}
          className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-pill bg-black/60 px-3.5 py-2 text-[12.5px] font-semibold text-white backdrop-blur transition-colors hover:bg-black/80"
        >
          <ArrowLeft size={14} weight="bold" /> Back to course
        </Link>

        {alreadyCompleted ? (
          <div className="grid h-full place-items-center text-[13px] text-white/70">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} weight="fill" className="text-green-500" /> Already completed
            </div>
          </div>
        ) : videoError ? (
          <div className="grid h-full place-items-center px-6 text-center text-[13px] text-white/70">
            <div>
              <WarningCircle size={22} className="mx-auto mb-2 text-white/50" />
              Video not yet uploaded for this lesson.
            </div>
          </div>
        ) : videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
            onLoadedMetadata={onLoadedMetadata}
            onPlay={onPlay}
            onTimeUpdate={onTimeUpdate}
            onPause={onPauseOrSeekingOrEnded}
            onSeeking={onPauseOrSeekingOrEnded}
            onEnded={onPauseOrSeekingOrEnded}
          />
        ) : (
          <div className="grid h-full place-items-center text-[13px] text-white/70">Loading video…</div>
        )}

        {result && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
            <Card className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <CheckCircle size={18} weight="fill" className="text-green-500" /> Lesson complete
                </div>
                {lesson.summaryBlock && (
                  <p className="mt-1 max-w-md text-[12.5px] text-gray-600">{lesson.summaryBlock}</p>
                )}
                {(result.xpAwarded > 0 || result.coinsAwarded > 0) && (
                  <div className="mt-2 flex gap-2">
                    {result.xpAwarded > 0 && (
                      <Chip tone="green">
                        <Lightning size={12} weight="fill" /> +{result.xpAwarded} XP
                      </Chip>
                    )}
                    {result.coinsAwarded > 0 && (
                      <Chip>
                        <Coins size={12} weight="fill" /> +{result.coinsAwarded} cr
                      </Chip>
                    )}
                  </div>
                )}
              </div>
              <Link
                href={nextHref}
                className="flex shrink-0 items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white"
              >
                Continue <ArrowRight size={13} weight="bold" />
              </Link>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom info strip */}
      <div className="border-t border-white/10 bg-black px-4 py-3 lg:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-white">{lesson.title}</div>
              <div className="truncate text-[11.5px] text-white/50">{moduleTitle}</div>
            </div>
            <div className="text-[11.5px] font-semibold text-white/60">
              Watched {pctWatched}% · Complete at {lesson.completionThresholdPct}%
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-white/15">
            <div className="h-full rounded-pill bg-green-500" style={{ width: `${pctWatched}%` }} />
          </div>
          {lesson.objective && (
            <p className="hidden text-[12.5px] text-white/60 sm:block">{lesson.objective}</p>
          )}
          {lesson.keyTopics.length > 0 && (
            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {lesson.keyTopics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center rounded-pill bg-white/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-white/80"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
