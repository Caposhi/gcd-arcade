import type { Tile } from "@gcd-arcade/shared";

/** "Insert coin" cabinet for not-yet-built or offline apps. */
export function Placeholder({ tile }: { tile: Tile }) {
  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr" }}>
      <div className="panel" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 80 }}>{tile.icon}</div>
          <h2>{tile.name}</h2>
          <p style={{ color: "var(--ink-dim)" }}>
            {tile.online === false ? "This program is currently offline." : "Coming soon — insert coin."}
          </p>
        </div>
      </div>
    </div>
  );
}
