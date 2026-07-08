"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, Coins, Lightning, WarningCircle } from "@phosphor-icons/react";
import { Card, Chip, PageHeader, ProgressBar } from "@/components/ui";

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
}: {
  lesson: LessonPlayerLesson;
  moduleTitle: string;
  alreadyCompleted: boolean;
  furthestPositionS: number;
  nextHref: string;
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
    <div className="mx-auto max-w-3xl">
      <PageHeader title={lesson.title} sub={moduleTitle} />

      <Card className="overflow-hidden">
        {alreadyCompleted ? (
          <div className="grid aspect-video place-items-center bg-gray-50 text-[13px] text-gray-500">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} weight="fill" className="text-green-500" /> Already completed
            </div>
          </div>
        ) : videoError ? (
          <div className="grid aspect-video place-items-center bg-gray-50 px-6 text-center text-[13px] text-gray-500">
            <div>
              <WarningCircle size={22} className="mx-auto mb-2 text-gray-400" />
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
            className="aspect-video w-full bg-black"
            onLoadedMetadata={onLoadedMetadata}
            onPlay={onPlay}
            onTimeUpdate={onTimeUpdate}
            onPause={onPauseOrSeekingOrEnded}
            onSeeking={onPauseOrSeekingOrEnded}
            onEnded={onPauseOrSeekingOrEnded}
          />
        ) : (
          <div className="grid aspect-video place-items-center bg-gray-50 text-[13px] text-gray-500">
            Loading video…
          </div>
        )}

        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between text-[11.5px] font-semibold text-gray-600">
            <span>Watched {pctWatched}%</span>
            <span>Complete at {lesson.completionThresholdPct}%</span>
          </div>
          <ProgressBar value={pctWatched} />

          {lesson.objective && <p className="text-[13px] text-gray-700">{lesson.objective}</p>}
          {lesson.keyTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lesson.keyTopics.map((topic) => (
                <Chip key={topic}>{topic}</Chip>
              ))}
            </div>
          )}
        </div>
      </Card>

      {result && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <CheckCircle size={18} weight="fill" className="text-green-500" /> Lesson complete
            </div>
            {lesson.summaryBlock && <p className="mt-1 max-w-md text-[12.5px] text-gray-600">{lesson.summaryBlock}</p>}
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
      )}
    </div>
  );
}
