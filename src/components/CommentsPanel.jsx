import { useState } from "react";

export default function CommentsPanel({
  open,
  comments,
  loading,
  error,
  onClose,
  onSubmit,
  submitting,
}) {
  const [text, setText] = useState("");

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    const ok = await onSubmit(value);
    if (ok) setText("");
  };

  return (
    <div className="absolute inset-0 z-20 bg-black/80 p-3 sm:p-4">
      <div className="flex h-full flex-col rounded-xl border border-white/10 bg-black/75">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <h3 className="text-sm font-semibold text-white">Comments</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs text-white/80 hover:bg-white/10">
            Close
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {loading ? <p className="text-xs text-white/70">Loading comments...</p> : null}
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {!loading && !comments.length ? <p className="text-xs text-white/70">No comments yet.</p> : null}
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-white/10 bg-black/30 p-2">
              <p className="text-xs font-medium text-white/90">@{comment?.profiles?.display_name || comment?.profiles?.username || "student"}</p>
              <p className="mt-1 text-xs text-white/85">{comment.text}</p>
            </article>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Write a comment..."
            className="app-input w-full rounded-lg p-2 text-xs"
          />
          <button
            type="submit"
            disabled={submitting}
            className="app-button-primary mt-2 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </form>
      </div>
    </div>
  );
}
