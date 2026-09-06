import { useState } from 'react';
import { toast } from 'sonner';
import { useSetMatchVideo } from '../../lib/queries';
import { useAuth, useIsAdmin } from '../../lib/useAuth';

/**
 * Accepts a full YouTube URL (watch/short/embed forms) or a bare 11-char video id and returns
 * just the id, or null if nothing recognizable was entered.
 */
function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const bareIdPattern = /^[\w-]{11}$/;
  if (bareIdPattern.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.slice(1);
      return bareIdPattern.test(id) ? id : null;
    }
    if (url.hostname.includes('youtube.com')) {
      const vParam = url.searchParams.get('v');
      if (vParam && bareIdPattern.test(vParam)) return vParam;
      const match = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/);
      if (match) return match[1];
    }
  } catch {
    // Not a URL at all -- fall through to "couldn't parse".
  }
  return null;
}

/**
 * Per-match-history-row YouTube link. Everyone sees a plain "Watch" link when a video is set;
 * admins additionally get an inline control to set/change/clear it, wired to useSetMatchVideo()
 * (a plain `matches.external_video_id` update, RLS-gated the same way other admin match edits
 * already are).
 */
export function MatchVideoLinkControl({ matchId, externalVideoId }: { matchId: string; externalVideoId: string | null }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user);
  const setVideo = useSetMatchVideo();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(externalVideoId ?? '');

  if (!isAdmin) {
    return externalVideoId ? (
      <a
        href={`https://www.youtube.com/watch?v=${externalVideoId}`}
        target="_blank"
        rel="noreferrer"
        className="text-accent hover:text-accent-hover text-[0.78rem] font-semibold no-underline"
      >
        ▶ Watch
      </a>
    ) : null;
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const id = draft.trim() === '' ? null : extractYouTubeId(draft);
          if (draft.trim() !== '' && !id) {
            toast.error("Couldn't recognize that as a YouTube link or video id.");
            return;
          }
          setVideo.mutate(
            { matchId, videoId: id },
            {
              onSuccess: () => {
                toast.success(id ? 'Video linked.' : 'Video link removed.');
                setEditing(false);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save the video link.'),
            }
          );
        }}
      >
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="YouTube URL or video id"
          className="bg-surface-2 border border-border rounded-md px-2 py-1 text-[0.76rem] text-text-primary w-[190px]"
        />
        <button
          type="submit"
          disabled={setVideo.isPending}
          className="text-[0.74rem] font-bold text-accent hover:text-accent-hover disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(externalVideoId ?? '');
          }}
          className="text-[0.74rem] text-text-muted hover:text-text-primary"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {externalVideoId && (
        <a
          href={`https://www.youtube.com/watch?v=${externalVideoId}`}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:text-accent-hover text-[0.78rem] font-semibold no-underline"
        >
          ▶ Watch
        </a>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[0.72rem] text-text-muted hover:text-text-primary underline decoration-dotted"
      >
        {externalVideoId ? 'Edit link' : '+ Add video'}
      </button>
    </div>
  );
}
