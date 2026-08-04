/** Plain loading state shown only while the first fetchApps() call is in
 *  flight — tied to real data readiness, not a timer. No "press any key to
 *  skip"; there's nothing to skip. */
export function Boot() {
  return (
    <div className="boot">
      <div>
        <div className="logo">
          GCD <b>·</b> ARCADE
        </div>
        <div className="bar">
          <i />
        </div>
        <div className="caption">Loading your dashboard…</div>
      </div>
    </div>
  );
}
