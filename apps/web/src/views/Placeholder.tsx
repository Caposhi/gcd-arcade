import type { Tile } from "@gcd-arcade/shared";
import { AppIcon } from "../lib/icons";

/** Light-chrome placeholder for not-yet-built or offline apps. Same logic
 *  (online/offline copy branch), just "Coming soon" instead of "insert coin". */
export function Placeholder({ tile }: { tile: Tile }) {
  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr" }}>
      <div className="panel" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              borderRadius: "var(--radius-xl)",
              background: "var(--bg-muted)",
              display: "grid",
              placeItems: "center",
              color: "var(--royal-blue)",
            }}
          >
            <AppIcon tileId={tile.id} width={30} height={30} />
          </div>
          <h2 style={{ margin: "0 0 6px", color: "var(--text-strong)" }}>{tile.name}</h2>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {tile.online === false ? "This program is currently offline." : "Coming soon."}
          </p>
        </div>
      </div>
    </div>
  );
}
