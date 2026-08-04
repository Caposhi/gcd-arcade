import type { PostCard } from "./engine";
import { iconFor } from "../../lib/icons";

function fmtTime(at: string | undefined): string | undefined {
  if (!at) return undefined;
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "Recent activity" — a horizontally-scrolling strip of post-preview cards,
 *  newest first (left to right). Replaces the confetti/cha-ching/klaxon
 *  moment overlays: no animation, just the real post (image + caption) and
 *  when it was done, approved, and posted — or, for an escalated brief, when
 *  it was done and escalated instead of posted. */
export function PostStrip({ posts }: { posts: PostCard[] }) {
  return (
    <div className="panel">
      <h3>Recent activity</h3>
      {posts.length === 0 ? (
        <div className="empty">No posts published or escalated yet this session.</div>
      ) : (
        <div className="post-strip">
          {posts.map((p) => (
            <PostCardView key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCardView({ post }: { post: PostCard }) {
  const ImageIcon = iconFor("image");
  const done = fmtTime(post.startedAt);
  const approved = fmtTime(post.approvedAt);
  const posted = fmtTime(post.postedAt);
  const escalated = fmtTime(post.escalatedAt);
  return (
    <div className={`post-card ${post.status}`}>
      <div className="post-thumb" style={post.imageUrl ? { backgroundImage: `url(${post.imageUrl})` } : undefined}>
        {!post.imageUrl && <ImageIcon />}
      </div>
      <div className="post-body">
        <div className="post-caption">{post.caption ?? "Untitled post"}</div>
        {done && (
          <div className="post-meta-row">
            <span>Done</span>
            <b>{done}</b>
          </div>
        )}
        {approved && (
          <div className="post-meta-row">
            <span>Approved</span>
            <b>{approved}</b>
          </div>
        )}
        {post.status === "published" && posted && (
          <div className="post-meta-row">
            <span>Posted</span>
            <b>{posted}</b>
          </div>
        )}
        {post.status === "escalated" && (
          <div className="post-meta-row">
            <span>Escalated</span>
            <b>{escalated}</b>
          </div>
        )}
        {post.status === "escalated" && <span className="post-badge">Awaiting human review</span>}
      </div>
    </div>
  );
}
