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
import type { PlannerState, ProjectInfo } from "@/planner/types";

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

function connectorRatingFromText(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normaliseConnection(value: string) {
  const cleaned = value.replace(/\s+/g, "").toLowerCase();
  const rating = connectorRatingFromText(cleaned);

  const isThreePhase =
    cleaned.includes("/3") ||
    cleaned.includes("3phase") ||
    cleaned.includes("threephase") ||
    cleaned.includes("powerlock");

  const isSinglePhase =
    cleaned.includes("/1") ||
    cleaned.includes("1phase") ||
    cleaned.includes("singlephase");

  if (isThreePhase) {
    return {
      rating,
      phase: "3" as const,
      highCurrentThreePhase: rating >= 200,
    };
  }

  if (isSinglePhase) {
    return {
      rating,
      phase: "1" as const,
      highCurrentThreePhase: false,
    };
  }

  return {
    rating,
    phase: cleaned,
    highCurrentThreePhase: false,
  };
}

function effectiveDistroPhaseCap(
  distroInput: string,
  distroInputA: number,
  sourceConnection?: string,
  sourceRating?: number
) {
  if (!sourceConnection || !sourceRating) {
    return {
      rating: distroInputA,
      capped: false,
    };
  }

  const source = normaliseConnection(sourceConnection);
  const distro = normaliseConnection(distroInput);

  const shouldCapToSource =
    source.phase === "3" &&
    distro.phase === "3" &&
    source.highCurrentThreePhase &&
    distro.highCurrentThreePhase &&
    sourceRating < distroInputA;

  return {
    rating: shouldCapToSource ? sourceRating : distroInputA,
    capped: shouldCapToSource,
  };
}

const emptyProjectInfo: ProjectInfo = {
  projectManager: "",
  projectNumber: "",
  projectName: "",
  eventDate: "",
  venue: "",
};

function projectInfoForState(plannerState: PlannerState): ProjectInfo {
  return {
    ...emptyProjectInfo,
    ...(plannerState.projectInfo ?? {}),
    projectName:
      plannerState.projectInfo?.projectName ?? plannerState.systemName ?? "",
  };
}

export function SystemOverviewTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
}: SystemOverviewTabProps) {
  const summary = systemLoadSummary(plannerState);
  const projectInfo = projectInfoForState(plannerState);

  function updateProjectInfo(field: keyof ProjectInfo, value: string) {
    const nextProjectInfo = {
      ...projectInfo,
      [field]: value,
    };

    setPlannerState({
      ...plannerState,
      projectInfo: nextProjectInfo,
      systemName: field === "projectName" ? value : plannerState.systemName,
    });
  }

  return (
    <section data-lva-surface style={styles.card}>
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

      <section style={styles.projectInfoPanel}>
        <div>
          <h3 style={styles.projectInfoTitle}>Project Information</h3>
          <p style={styles.projectInfoText}>
            These details are used in report headers and JSON exports.
          </p>
        </div>

        <div style={styles.projectInfoGrid}>
          <label style={styles.label}>
            Project Manager
            <input
              style={styles.input}
              value={projectInfo.projectManager}
              onChange={(event) =>
                updateProjectInfo("projectManager", event.target.value)
              }
              placeholder=""
            />
          </label>

          <label style={styles.label}>
            Project Number
            <input
              style={styles.input}
              value={projectInfo.projectNumber}
              onChange={(event) =>
                updateProjectInfo("projectNumber", event.target.value)
              }
              placeholder=""
            />
          </label>

          <label style={styles.label}>
            Project Name
            <input
              style={styles.input}
              value={projectInfo.projectName}
              onChange={(event) =>
                updateProjectInfo("projectName", event.target.value)
              }
              placeholder=""
            />
          </label>

          <label style={styles.label}>
            Event Date
            <input
              style={styles.input}
              type="date"
              value={projectInfo.eventDate}
              onChange={(event) =>
                updateProjectInfo("eventDate", event.target.value)
              }
            />
          </label>

          <label style={styles.label}>
            Venue
            <input
              style={styles.input}
              value={projectInfo.venue}
              onChange={(event) => updateProjectInfo("venue", event.target.value)}
              placeholder=""
            />
          </label>
        </div>
      </section>

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
                        sourceConnection={source.sourceConnection}
                        sourceRating={source.sourceRating}
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
  sourceConnection,
  sourceRating,
}: {
  summary: DistroLoadSummary;
  openDistroEditor: (distroId: string) => void;
  depth: number;
  unassigned?: boolean;
  sourceConnection?: string;
  sourceRating?: number;
}) {
  const connectionType = connectionColour(summary.distro.input);
  const lineStyle =
    connectionType === "threePhase" ? styles.threePhaseLine : styles.singlePhaseLine;
  const badgeStyle =
    connectionType === "threePhase"
      ? styles.threePhaseBadge
      : styles.singlePhaseBadge;
  const phaseCap = effectiveDistroPhaseCap(
    summary.distro.input,
    summary.distro.inputA,
    sourceConnection,
    sourceRating
  );

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

        {phaseCap.capped && (
          <div style={styles.capBanner}>
            Input {summary.distro.input} capped to {formatAmps(phaseCap.rating)} per phase by source.
          </div>
        )}

        <PhaseLoadGrid
          loads={summary.phaseLoads}
          rating={phaseCap.rating}
          capped={phaseCap.capped}
        />

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
  capped = false,
}: {
  loads: PhaseLoads;
  rating: number;
  capped?: boolean;
}) {
  return (
    <div style={styles.phaseGrid}>
      <PhaseLoadCard phase="L1" amps={loads.L1} rating={rating} capped={capped} />
      <PhaseLoadCard phase="L2" amps={loads.L2} rating={rating} capped={capped} />
      <PhaseLoadCard phase="L3" amps={loads.L3} rating={rating} capped={capped} />
    </div>
  );
}

function PhaseLoadCard({
  phase,
  amps,
  rating,
  capped = false,
}: {
  phase: string;
  amps: number;
  rating: number;
  capped?: boolean;
}) {
  const percentage = phasePercentage(amps, rating);

  return (
    <div
      data-lva-card
      style={{
        ...styles.phaseCard,
        ...(capped ? styles.phaseCardCapped : {}),
      }}
    >
      <div style={styles.phaseHeader}>
        <strong>{phase}</strong>
        <span>{percentage}%</span>
      </div>

      <p style={styles.muted}>
        {formatAmps(amps)} / {formatAmps(rating)}{capped ? " source cap" : ""}
      </p>

      <div style={styles.meter}>
        <div
          style={{
            ...styles.meterFill,
            width: `${Math.min(percentage, 100)}%`,
            background:
              percentage >= 100
                ? "#E5484D"
                : percentage >= 95
                  ? "#B7791F"
                  : "#0A8F5D",
          }}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #DCE5EC",
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
    color: "#667085",
  },
  projectInfoPanel: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "16px",
    background: "#F5F7FA",
    marginBottom: "20px",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
  },
  projectInfoTitle: {
    margin: 0,
    fontSize: "18px",
    letterSpacing: "-0.01em",
  },
  projectInfoText: {
    margin: "4px 0 14px",
    color: "#667085",
    fontSize: "13px",
  },
  projectInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "12px",
  },
  label: {
    display: "block",
    color: "#111827",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.01em",
  },
  input: {
    width: "100%",
    marginTop: "6px",
    padding: "11px 12px",
    borderRadius: "13px",
    border: "1px solid #DCE5EC",
    background: "#FFFFFF",
    color: "#111827",
    fontFamily: "inherit",
    fontWeight: 600,
    outline: "none",
  },
  legend: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    background: "#F5F7FA",
  },
  legendItem: {
    display: "flex",
    gap: "7px",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 800,
    color: "#111827",
  },
  legendLine: {
    display: "inline-block",
    width: "28px",
    height: "5px",
    borderRadius: "999px",
  },
  singlePhaseLine: {
    background: "#007D8F",
    borderColor: "#007D8F",
  },
  threePhaseLine: {
    background: "#dc2626",
    borderColor: "#dc2626",
  },
  issuesPanel: {
    border: "1px solid #DCE5EC",
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
    background: "#FFFBEB",
    color: "#92400E",
    border: "1px solid #FDE68A",
  },
  issueCritical: {
    background: "#FFF1F1",
    color: "#B42318",
    border: "1px solid #FECACA",
  },
  flowSection: {
    marginTop: "10px",
  },
  sourceList: {
    display: "grid",
    gap: "18px",
  },
  sourceCard: {
    border: "2px solid #111827",
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
    color: "#111827",
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
    background: "#E6FBFF",
    color: "#007D8F",
    border: "1px solid #bfdbfe",
  },
  threePhaseBadge: {
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
  },
  distroCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "14px",
    background: "#F5F7FA",
  },
  singlePhaseCard: {
    borderLeft: "6px solid #007D8F",
  },
  threePhaseCard: {
    borderLeft: "6px solid #dc2626",
  },
  unassignedCard: {
    border: "1px dashed #B7791F",
    borderLeft: "6px solid #B7791F",
    borderRadius: "14px",
    padding: "14px",
    background: "#FFFBEB",
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
    color: "#111827",
    whiteSpace: "nowrap",
  },
  capBanner: {
    marginTop: "10px",
    marginBottom: "10px",
    border: "1px solid #FDE68A",
    borderRadius: "12px",
    padding: "9px 10px",
    background: "#FFFBEB",
    color: "#92400E",
    fontSize: "12px",
    fontWeight: 800,
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "12px",
  },
  phaseCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    padding: "10px",
    background: "white",
  },
  phaseCardCapped: {
    border: "1px solid #F59E0B",
    background: "#FFFBEB",
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
    background: "#E9EEF3",
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
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
  },
};
