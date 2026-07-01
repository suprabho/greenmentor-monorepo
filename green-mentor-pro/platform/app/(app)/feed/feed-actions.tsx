"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ThumbsUp, ThumbsDown, ChatCircle, ShareNetwork, X, PaperPlaneRight, CircleNotch } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export type ReactionKind = "like" | "dislike";
export type ArticleStat = { like_count: number; dislike_count: number; comment_count: number };
export type CurrentUser = { id: string; name: string; avatar: string | null };

type FeedComment = {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
};

const LOGIN = `/login?next=${encodeURIComponent("/feed")}`;
const MAX_COMMENT = 1000;

// One browser client per card, created lazily so it never runs during SSR.
function useSupabase() {
  const ref = useRef<ReturnType<typeof createClient>>(null);
  return () => (ref.current ??= createClient());
}

function ActionButton({
  onClick,
  active,
  activeClass,
  children,
  className,
}: {
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[13px] font-semibold tabular-nums transition hover:bg-gray-100",
        active ? activeClass : "text-gray-500",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ArticleActions({
  articleId,
  title,
  url,
  stats,
  initialReaction,
  currentUser,
}: {
  articleId: string;
  title: string;
  url: string;
  stats?: ArticleStat;
  initialReaction: ReactionKind | null;
  currentUser: CurrentUser | null;
}) {
  const router = useRouter();
  const getSupabase = useSupabase();

  const baseLikes = stats?.like_count ?? 0;
  const baseDislikes = stats?.dislike_count ?? 0;
  const baseComments = stats?.comment_count ?? 0;

  // `reaction` is the optimistic local state; the displayed count is the base
  // (which already includes the user's persisted reaction) adjusted for the
  // delta between what was persisted and what's shown now.
  const [reaction, setReaction] = useState<ReactionKind | null>(initialReaction);
  const [commentDelta, setCommentDelta] = useState(0);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);

  const likes = baseLikes - (initialReaction === "like" ? 1 : 0) + (reaction === "like" ? 1 : 0);
  const dislikes = baseDislikes - (initialReaction === "dislike" ? 1 : 0) + (reaction === "dislike" ? 1 : 0);
  const comments = baseComments + commentDelta;

  const toggle = async (kind: ReactionKind) => {
    if (!currentUser) {
      router.push(LOGIN);
      return;
    }
    if (busyRef.current) return; // drop overlapping clicks so writes can't race

    const prev = reaction;
    const next = prev === kind ? null : kind;
    setReaction(next); // optimistic
    busyRef.current = true;
    const supabase = getSupabase();
    const { error } =
      next === null
        ? await supabase.from("reactions").delete().eq("user_id", currentUser.id).eq("article_id", articleId)
        : await supabase
            .from("reactions")
            .upsert({ user_id: currentUser.id, article_id: articleId, kind: next }, { onConflict: "user_id,article_id" });
    busyRef.current = false;
    if (error) setReaction(prev); // rollback
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* dismissed */
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <div className="flex items-center gap-0.5 border-t border-gray-100 pt-2.5">
        <ActionButton onClick={() => toggle("like")} active={reaction === "like"} activeClass="text-teal-700">
          <ThumbsUp size={17} weight={reaction === "like" ? "fill" : "regular"} />
          {likes}
        </ActionButton>
        <ActionButton onClick={() => toggle("dislike")} active={reaction === "dislike"} activeClass="text-red-600">
          <ThumbsDown size={17} weight={reaction === "dislike" ? "fill" : "regular"} />
          {dislikes}
        </ActionButton>
        <ActionButton onClick={() => setOpen(true)}>
          <ChatCircle size={17} />
          {comments}
        </ActionButton>

        <ActionButton onClick={share} className="ml-auto">
          <ShareNetwork size={17} />
          {copied ? "Copied" : "Share"}
        </ActionButton>
      </div>

      {open && (
        <CommentSheet
          articleId={articleId}
          title={title}
          currentUser={currentUser}
          onAdjustCount={(n) => setCommentDelta((d) => d + n)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CommentSheet({
  articleId,
  title,
  currentUser,
  onAdjustCount,
  onClose,
}: {
  articleId: string;
  title: string;
  currentUser: CurrentUser | null;
  onAdjustCount: (n: number) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const getSupabase = useSupabase();
  const [show, setShow] = useState(false); // drives slide-up / slide-down
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const close = () => {
    setShow(false);
    setTimeout(onClose, 240);
  };

  // Slide up on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Load real comments for this article (public via the feed_comments view).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await getSupabase()
        .from("feed_comments")
        .select("id, body, created_at, author_name, author_avatar")
        .eq("article_id", articleId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) console.warn("feed_comments unavailable (apply 0004_feed_social.sql):", error.message);
      setComments((data as FeedComment[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  // Modal dialog semantics: move focus into the sheet, trap Tab, Esc to close,
  // lock background scroll, and restore focus to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      mountedRef.current = false;
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async () => {
    const body = text.trim().slice(0, MAX_COMMENT);
    if (!body || posting) return;
    if (!currentUser) {
      router.push(LOGIN);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimistic: FeedComment = {
      id: tempId,
      body,
      created_at: new Date().toISOString(),
      author_name: currentUser.name,
      author_avatar: currentUser.avatar,
    };
    setComments((c) => [...c, optimistic]);
    setText("");
    onAdjustCount(1);
    setPosting(true);

    const { data, error } = await getSupabase()
      .from("comments")
      .insert({ user_id: currentUser.id, article_id: articleId, body })
      .select("id")
      .single();

    // Sheet may have been closed mid-insert; still reconcile the card count.
    if (!mountedRef.current) {
      if (error || !data) onAdjustCount(-1);
      return;
    }
    setPosting(false);

    if (error || !data) {
      // rollback
      setComments((c) => c.filter((x) => x.id !== tempId));
      onAdjustCount(-1);
      setText(body);
      return;
    }
    setComments((c) => c.map((x) => (x.id === tempId ? { ...x, id: data.id as string } : x)));
    inputRef.current?.focus();
  };

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Comments">
      <div
        onClick={close}
        className={clsx("absolute inset-0 bg-black/40 transition-opacity duration-200", show ? "opacity-100" : "opacity-0")}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={clsx(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[82dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl outline-none transition-transform duration-[240ms] ease-out",
          show ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* handle + header */}
        <div className="shrink-0 border-b border-gray-100 px-5 pb-3 pt-2.5">
          <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-gray-200" />
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-ink">
              Comments{!loading && <span className="text-gray-400"> · {comments.length}</span>}
            </h3>
            <button
              type="button"
              onClick={close}
              aria-label="Close comments"
              className="grid size-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <X size={17} weight="bold" />
            </button>
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] text-gray-400">{title}</p>
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10 text-gray-400">
              <CircleNotch size={22} className="animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-gray-500">No comments yet. Start the conversation.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar src={c.author_avatar ?? undefined} name={c.author_name ?? "Member"} size={32} className="mt-0.5" />
                  <p className="min-w-0 break-words text-[13.5px] leading-relaxed text-gray-700">
                    <span className="font-semibold text-ink">{c.author_name ?? "Member"}</span> {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* composer */}
        <div className="shrink-0 border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <Avatar src={currentUser.avatar ?? undefined} name={currentUser.name} size={32} />
              <div className="flex flex-1 items-center gap-2 rounded-pill border border-gray-200 bg-gray-50 py-1.5 pl-4 pr-1.5 focus-within:border-gray-300">
                <input
                  ref={inputRef}
                  value={text}
                  maxLength={MAX_COMMENT}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    // isComposing guard: don't submit while an IME candidate is open.
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      post();
                    }
                  }}
                  placeholder="Add a comment..."
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={post}
                  disabled={!text.trim() || posting}
                  aria-label="Post comment"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-900 text-white transition hover:bg-teal-800 disabled:opacity-40"
                >
                  <PaperPlaneRight size={15} weight="fill" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push(LOGIN)}
              className="w-full rounded-pill bg-teal-900 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-teal-800"
            >
              Sign in to join the conversation
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
