import {
  displayDistroName,
  formatAmps,
  formatWatts,
  phasePercentage,
  systemLoadSummary,
} from "@/planner/calculations";
import type {
  DistroLoadSummary,
  PhaseLoads,
  ValidationIssue,
} from "@/planner/calculations";
import type { PlannerState } from "@/planner/types";

type SystemOverviewTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
};

function isThreePhaseConnection(connection: string) {
  return (
    connection.includes("/ 3") ||
    connection.includes("/3") ||
    connection.includes("3Φ")
  );
}

function connectionColour(connection: string) {
  return isThreePhaseConnection(connection) ? "threePhase" : "singlePhase";
}

function connectionLabel(summary: DistroLoadSummary) {
  if (summary.fedFromOutputLabel) {
    return `${summary.fedFromOutputLabel} → ${summary.distro.input}`;
  }

  return summary.distro.input;
}

export function SystemOverviewTab({
  plannerState,
  openDistroEditor,
}: SystemOverviewTabProps) {
  const summary = systemLoadSummary(plannerState);

  return (
    <section style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2>System Overview</h2>
          <p style={styles.muted}>
            Power source and distro hierarchy. Three-phase links are red;
            single-phase links are blue.
          </p>
        </div>

        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendLine, ...styles.threePhaseLine }} />
            3-phase
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendLine, ...styles.singlePhaseLine }} />
            Single-phase
          </span>
        </div>
      </div>

      {summary.issues.length > 0 && (
        <section style={styles.issuesPanel}>
          <h3>Warnings & Issues</h3>
          <IssueList issues={summary.issues} />
        </section>
      )}

      <section style={styles.flowSection}>
        {summary.sourceSummaries.length === 0 ? (
          <p style={styles.muted}>No manual power sources added yet.</p>
        ) : (
          <div style={styles.sourceList}>
            {summary.sourceSummaries.map((source) => (
              <div key={source.sourceId} style={styles.sourceCard}>
                <div style={styles.sourceHeader}>
                  <div>
                    <h3 style={styles.sourceTitle}>{source.sourceName}</h3>
                    <p style={styles.muted}>
                      {source.sourceConnection} · {source.sourceRating}A per phase
                    </p>
                  </div>

                  <div style={styles.sourceTotal}>
                    {formatWatts(source.watts)} · {formatAmps(source.amps)}
                  </div>
                </div>

                <PhaseLoadGrid loads={source.phaseLoads} rating={source.sourceRating} />

                {source.distros.length === 0 ? (
                  <p style={styles.muted}>No distros assigned to this source.</p>
                ) : (
                  <div style={styles.treeList}>
                    {source.distros.map((distroSummary) => (
                      <DistroTreeCard
                        key={distroSummary.distro.id}
                        summary={distroSummary}
                        openDistroEditor={openDistroEditor}
                        depth={0}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {summary.unassignedDistros.length > 0 && (
          <section style={styles.unassignedSection}>
            <h3>Unassigned Distros</h3>

            <div style={styles.treeList}>
              {summary.unassignedDistros.map((distroSummary) => (
                <DistroTreeCard
                  key={distroSummary.distro.id}
                  summary={distroSummary}
                  openDistroEditor={openDistroEditor}
                  depth={0}
                  unassigned
                />
              ))}
            </div>
          </section>
        )}
      </section>
    </section>
  );
}

function DistroTreeCard({
  summary,
  openDistroEditor,
  depth,
  unassigned = false,
}: {
  summary: DistroLoadSummary;
  openDistroEditor: (distroId: string) => void;
  depth: number;
  unassigned?: boolean;
}) {
  const connectionType = connectionColour(summary.distro.input);
  const lineStyle =
    connectionType === "threePhase" ? styles.threePhaseLine : styles.singlePhaseLine;
  const badgeStyle =
    connectionType === "threePhase"
      ? styles.threePhaseBadge
      : styles.singlePhaseBadge;

  return (
    <div style={styles.treeNode}>
      <div
        style={{
          ...styles.connectorRow,
          marginLeft: depth ? `${depth * 30}px` : 0,
        }}
      >
        {depth > 0 && (
          <>
            <span style={{ ...styles.verticalConnector, ...lineStyle }} />
            <span style={{ ...styles.horizontalConnector, ...lineStyle }} />
          </>
        )}

        <span style={{ ...styles.connectionBadge, ...badgeStyle }}>
          {connectionLabel(summary)}
        </span>
      </div>

      <div
        style={{
          ...(unassigned ? styles.unassignedCard : styles.distroCard),
          ...(connectionType === "threePhase"
            ? styles.threePhaseCard
            : styles.singlePhaseCard),
          marginLeft: depth ? `${depth * 30}px` : 0,
        }}
      >
        <div style={styles.distroHeader}>
          <div>
            <strong>{displayDistroName(summary.distro)}</strong>
            <p style={styles.muted}>
              {summary.distro.name} · Input {summary.distro.input}
              {summary.distro.location ? ` · ${summary.distro.location}` : ""}
            </p>
          </div>

          <div style={styles.distroActions}>
            <span style={styles.distroTotal}>
              {formatWatts(summary.watts)} · {formatAmps(summary.amps)}
            </span>
            <button
              style={styles.secondaryButton}
              onClick={() => openDistroEditor(summary.distro.id)}
            >
              Open
            </button>
          </div>
        </div>

        <PhaseLoadGrid loads={summary.phaseLoads} rating={summary.distro.inputA} />

        {(summary.children ?? []).length > 0 && (
          <div style={styles.childList}>
            {(summary.children ?? []).map((child) => (
              <DistroTreeCard
                key={child.distro.id}
                summary={child}
                openDistroEditor={openDistroEditor}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  return (
    <div style={styles.issueList}>
      {issues.map((issue) => (
        <div
          key={issue.id}
          style={{
            ...styles.issueItem,
            ...(issue.severity === "critical"
              ? styles.issueCritical
              : styles.issueWarning),
          }}
        >
          <strong>{issue.severity === "critical" ? "Critical" : "Warning"}</strong>
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function PhaseLoadGrid({
  loads,
  rating,
}: {
  loads: PhaseLoads;
  rating: number;
}) {
  return (
    <div style={styles.phaseGrid}>
      <PhaseLoadCard phase="L1" amps={loads.L1} rating={rating} />
      <PhaseLoadCard phase="L2" amps={loads.L2} rating={rating} />
      <PhaseLoadCard phase="L3" amps={loads.L3} rating={rating} />
    </div>
  );
}

function PhaseLoadCard({
  phase,
  amps,
  rating,
}: {
  phase: string;
  amps: number;
  rating: number;
}) {
  const percentage = phasePercentage(amps, rating);

  return (
    <div style={styles.phaseCard}>
      <div style={styles.phaseHeader}>
        <strong>{phase}</strong>
        <span>{percentage}%</span>
      </div>

      <p style={styles.muted}>
        {formatAmps(amps)} / {formatAmps(rating)}
      </p>

      <div style={styles.meter}>
        <div
          style={{
            ...styles.meterFill,
            width: `${Math.min(percentage, 100)}%`,
            background:
              percentage >= 100
                ? "#c53030"
                : percentage >= 95
                  ? "#b7791f"
                  : "#0f8a5f",
          }}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #d9e0ea",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "18px",
  },
  muted: {
    color: "#637083",
  },
  legend: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px",
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    background: "#f8fafc",
  },
  legendItem: {
    display: "flex",
    gap: "7px",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 800,
    color: "#344054",
  },
  legendLine: {
    display: "inline-block",
    width: "28px",
    height: "5px",
    borderRadius: "999px",
  },
  singlePhaseLine: {
    background: "#2563eb",
    borderColor: "#2563eb",
  },
  threePhaseLine: {
    background: "#dc2626",
    borderColor: "#dc2626",
  },
  issuesPanel: {
    border: "1px solid #d9e0ea",
    borderRadius: "16px",
    padding: "16px",
    background: "#ffffff",
    marginBottom: "20px",
  },
  issueList: {
    display: "grid",
    gap: "8px",
  },
  issueItem: {
    display: "grid",
    gridTemplateColumns: "90px 1fr",
    gap: "8px",
    borderRadius: "10px",
    padding: "10px",
    fontSize: "13px",
  },
  issueWarning: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
  },
  issueCritical: {
    background: "#fff5f5",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },
  flowSection: {
    marginTop: "10px",
  },
  sourceList: {
    display: "grid",
    gap: "18px",
  },
  sourceCard: {
    border: "2px solid #172033",
    borderRadius: "18px",
    padding: "16px",
    background: "#ffffff",
  },
  sourceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  sourceTitle: {
    margin: 0,
  },
  sourceTotal: {
    fontWeight: 800,
    color: "#172033",
    whiteSpace: "nowrap",
  },
  treeList: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  treeNode: {
    display: "grid",
    gap: "6px",
  },
  connectorRow: {
    display: "flex",
    alignItems: "center",
    minHeight: "18px",
  },
  verticalConnector: {
    width: "5px",
    height: "18px",
    borderRadius: "999px",
    marginRight: "8px",
  },
  horizontalConnector: {
    width: "24px",
    height: "5px",
    borderRadius: "999px",
    marginRight: "8px",
  },
  connectionBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
  },
  singlePhaseBadge: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },
  threePhaseBadge: {
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
  },
  distroCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
  singlePhaseCard: {
    borderLeft: "6px solid #2563eb",
  },
  threePhaseCard: {
    borderLeft: "6px solid #dc2626",
  },
  unassignedCard: {
    border: "1px dashed #b7791f",
    borderLeft: "6px solid #b7791f",
    borderRadius: "14px",
    padding: "14px",
    background: "#fffbeb",
  },
  distroHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  distroActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  distroTotal: {
    fontWeight: 800,
    color: "#172033",
    whiteSpace: "nowrap",
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "12px",
  },
  phaseCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "10px",
    background: "white",
  },
  phaseHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
  },
  meter: {
    height: "8px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#edf0f5",
  },
  meterFill: {
    height: "100%",
    borderRadius: "999px",
  },
  childList: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  unassignedSection: {
    marginTop: "24px",
  },
  secondaryButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
  },
};
