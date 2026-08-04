import { iconFor } from "../../lib/icons";

export interface ActivityItem {
  id: number;
  icon: string;
  msg: string;
  at: string;
}

/** Plain "Recent activity" list — replaces the confetti/cha-ching/klaxon
 *  moment overlays with icon + message + timestamp rows, no animation. */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <div className="panel">
      <h3>Recent activity</h3>
      {items.length === 0 ? (
        <div className="empty">No activity yet this session.</div>
      ) : (
        items.map((it) => {
          const Icon = iconFor(it.icon);
          return (
            <div className="event-row" key={it.id}>
              <span className="row-icon">
                <Icon />
              </span>
              <span className="row-msg">{it.msg}</span>
              <span className="row-ts">{it.at}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
