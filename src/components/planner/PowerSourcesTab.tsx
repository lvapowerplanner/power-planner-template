import { useMemo, useState } from "react";
import { autoSourcesForDistro } from "@/planner/autoSources";
import { WarningPanel, activeIssuesForScope } from "@/components/planner/WarningPanel";
import {
  addPhaseLoads,
  createEmptyPhaseLoads,
  distroLoadSummary,
  formatAmps,
  formatWatts,
  phaseImbalance,
  phaseLoadTotal,
  phasePercentage,
  systemLoadSummary,
} from "@/planner/calculations";
import type {
  DistroLoadSummary,
  PhaseLoads,
  ValidationIssue,
} from "@/planner/calculations";
import type { PlannerState, PowerSource } from "@/planner/types";

type PowerSourcesTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
};

type SourceCardSummary = {
  source: PowerSource;
  phaseLoads: PhaseLoads;
  watts: number;
  amps: number;
  assignedDistros: DistroLoadSummary[];
  issues: ValidationIssue[];
  isAuto: boolean;
};

const sourceTypes = [
  "13A",
  "16A / 1",
  "32A / 1",
  "32A / 3",
  "63A / 3",
  "125A / 3",
  "200A / 3",
  "300A / 3",
  "400A / 3",
];

function sourceRating(connection: string) {
  const match = connection.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function isThreePhaseConnection(connection: string) {
  return connection.includes("/ 3") || connection.includes("/3");
}

function phaseImbalanceReference(loads: PhaseLoads) {
  const phaseEntries = (["L1", "L2", "L3"] as const).map((phase) => ({
    phase,
    amps: loads[phase],
  }));
  const highest = phaseEntries.reduce((current, candidate) =>
    candidate.amps > current.amps ? candidate : current,
  );
  const lowest = phaseEntries.reduce((current, candidate) =>
    candidate.amps < current.amps ? candidate : current,
  );
  const imbalance = phaseImbalance(loads);

  return `${highest.phase} ${Math.round(imbalance)}% imbalance versus ${lowest.phase}`;
}

function sourcePhaseStyle(source: PowerSource): React.CSSProperties {
  return isThreePhaseConnection(source.conn)
    ? styles.threePhaseCard
    : styles.singlePhaseCard;
}

function displaySourceConnection(source: PowerSource) {
  return `${source.conn} · ${source.rating}A per phase`;
}

function sourceIsInUse(plannerState: PlannerState, sourceId: string) {
  return plannerState.distros.some((distro) => distro.sourceId === sourceId);
}

function sourceIssues(
  source: PowerSource,
  phaseLoads: PhaseLoads,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const phases = isThreePhaseConnection(source.conn)
    ? (["L1", "L2", "L3"] as const)
    : (["L1"] as const);

  phases.forEach((phase) => {
    const amps = phaseLoads[phase];

    if (amps > source.rating) {
      issues.push({
        id: `${source.id}-${phase}-overload`,
        severity: "critical",
        context: source.name,
        message: `${source.name} ${phase} overloaded: ${formatAmps(
          amps,
        )} / ${formatAmps(source.rating)}.`,
        currentValue: amps,
      });
    } else if (amps > source.rating * 0.8) {
      issues.push({
        id: `${source.id}-${phase}-near-limit`,
        severity: "warning",
        context: source.name,
        message: `${source.name} ${phase} above 80% capacity: ${formatAmps(
          amps,
        )} / ${formatAmps(source.rating)}.`,
        currentValue: amps,
      });
    }
  });

  if (isThreePhaseConnection(source.conn)) {
    const imbalance = phaseImbalance(phaseLoads);
    const maxPhaseLoad = Math.max(phaseLoads.L1, phaseLoads.L2, phaseLoads.L3);

    if (imbalance >= 50 && maxPhaseLoad > 5) {
      issues.push({
        id: `${source.id}-phase-imbalance-critical`,
        severity: "critical",
        context: source.name,
        message: `Severe phase imbalance on ${source.name}: ${phaseImbalanceReference(phaseLoads)}.`,
        currentValue: imbalance,
      });
    } else if (imbalance >= 30 && maxPhaseLoad > 5) {
      issues.push({
        id: `${source.id}-phase-imbalance-warning`,
        severity: "warning",
        context: source.name,
        message: `Phase imbalance on ${source.name}: ${phaseImbalanceReference(phaseLoads)}.`,
        currentValue: imbalance,
      });
    }
  }

  return issues;
}

function sourceHealth(issues: ValidationIssue[]) {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.some((issue) => issue.severity === "warning")) return "warning";
  return "ok";
}

function buildAutoSourceSummary(
  plannerState: PlannerState,
  source: PowerSource,
): SourceCardSummary {
  const assignedDistros = plannerState.distros
    .filter((distro) => distro.sourceId === source.id)
    .map((distro) => distroLoadSummary(distro, plannerState));

  const phaseLoads = assignedDistros.reduce<PhaseLoads>(
    (total, distro) => addPhaseLoads(total, distro.phaseLoads),
    createEmptyPhaseLoads(),
  );

  const watts = assignedDistros.reduce(
    (total, distro) => total + distro.watts,
    0,
  );

  const issues = [
    ...sourceIssues(source, phaseLoads),
    ...assignedDistros.flatMap((distro) => distro.issues),
  ];

  return {
    source,
    phaseLoads,
    watts,
    amps: phaseLoadTotal(phaseLoads),
    assignedDistros,
    issues,
    isAuto: true,
  };
}

export function PowerSourcesTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
}: PowerSourcesTabProps) {
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("125A / 3");
  const [sourceNotes, setSourceNotes] = useState("");

  const systemSummary = systemLoadSummary(plannerState);

  const manualSources = plannerState.sources.filter((source) => !source.auto);

  const autoSources = plannerState.distros.flatMap((distro) =>
    autoSourcesForDistro(distro),
  );

  const manualSourceSummaries = useMemo<SourceCardSummary[]>(() => {
    return manualSources.map((source) => {
      const summary = systemSummary.sourceSummaries.find(
        (item) => item.sourceId === source.id,
      );

      const phaseLoads = summary?.phaseLoads ?? createEmptyPhaseLoads();
      const assignedDistros = summary?.distros ?? [];
      const watts = summary?.watts ?? 0;
      const amps = summary?.amps ?? phaseLoadTotal(phaseLoads);
      const issues = summary?.issues ?? sourceIssues(source, phaseLoads);

      return {
        source,
        phaseLoads,
        watts,
        amps,
        assignedDistros,
        issues,
        isAuto: false,
      };
    });
  }, [manualSources, systemSummary.sourceSummaries]);

  const autoSourceSummaries = useMemo<SourceCardSummary[]>(() => {
    return autoSources.map((source) =>
      buildAutoSourceSummary(plannerState, source),
    );
  }, [autoSources, plannerState]);

  const allIssues = [
    ...manualSourceSummaries.flatMap((summary) =>
      summary.issues.map((issue) => ({
        ...issue,
        sourceId: summary.source.id,
      })),
    ),
    ...autoSourceSummaries.flatMap((summary) =>
      summary.issues.map((issue) => ({
        ...issue,
        sourceId: summary.source.id,
      })),
    ),
  ];

  function addPowerSource() {
    const newSource: PowerSource = {
      id: createId("source"),
      name: sourceName.trim() || "Power Source",
      conn: sourceType,
      rating: sourceRating(sourceType),
      notes: sourceNotes.trim(),
      auto: false,
      phaseType: sourceType.includes("/ 3") ? "Three-Phase" : "Single-Phase",
    };

    setPlannerState({
      ...plannerState,
      sources: [...manualSources, newSource, ...autoSources],
    });

    setSourceName("");
    setSourceNotes("");
  }

  function deletePowerSource(sourceId: string) {
    if (
      sourceIsInUse(plannerState, sourceId) &&
      !confirm(
        "This source is currently assigned to one or more distros. Delete it and unassign those distros?",
      )
    ) {
      return;
    }

    setPlannerState({
      ...plannerState,
      sources: manualSources.filter((source) => source.id !== sourceId),
      distros: plannerState.distros.map((distro) =>
        distro.sourceId === sourceId ? { ...distro, sourceId: "" } : distro,
      ),
    });
  }

  function movePowerSource(sourceId: string, direction: -1 | 1) {
    const currentIndex = manualSources.findIndex(
      (source) => source.id === sourceId,
    );
    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= manualSources.length
    ) {
      return;
    }

    const nextManualSources = [...manualSources];
    const [movedSource] = nextManualSources.splice(currentIndex, 1);
    nextManualSources.splice(targetIndex, 0, movedSource);

    setPlannerState({
      ...plannerState,
      sources: [...nextManualSources, ...autoSources],
    });
  }

  return (
    <section data-lva-surface style={styles.card}>
      <h2>Power Sources</h2>
      <p style={styles.muted}>
        Manual Power Sources are venue power supplies or generators. Auto
        sources are created from distro outputs and show downstream distro
        loads.
      </p>

      <div style={styles.formGrid}>
        <label style={styles.label}>
          Source Name
          <input
            style={styles.input}
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="e.g. Generator 1 / Venue 125A"
          />
        </label>

        <label style={styles.label}>
          Type
          <select
            style={styles.input}
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value)}
          >
            {sourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Rating
          <input
            style={styles.input}
            value={`${sourceRating(sourceType)}A`}
            readOnly
          />
        </label>
      </div>

      <label style={styles.label}>
        Notes
        <textarea
          style={styles.textarea}
          value={sourceNotes}
          onChange={(event) => setSourceNotes(event.target.value)}
          placeholder="Generator location, venue DB details, cable route, restrictions..."
        />
      </label>

      <button style={styles.button} onClick={addPowerSource}>
        Add Manual Power Source
      </button>

      <WarningPanel
        scope="planner-warnings"
        title="Power Source Warnings"
        issues={allIssues}
        plannerState={plannerState}
        setPlannerState={setPlannerState}
      />

      <hr style={styles.divider} />

      <h3>Manual Power Sources</h3>

      <div style={styles.list}>
        {manualSourceSummaries.length === 0 ? (
          <p style={styles.muted}>No manual power sources added yet.</p>
        ) : (
          manualSourceSummaries.map((summary, index) => (
            <PowerSourceCard
              key={summary.source.id}
              summary={summary}
              onMoveUp={() => movePowerSource(summary.source.id, -1)}
              onMoveDown={() => movePowerSource(summary.source.id, 1)}
              moveUpDisabled={index === 0}
              moveDownDisabled={index === manualSourceSummaries.length - 1}
              onDelete={() => deletePowerSource(summary.source.id)}
              dismissedWarnings={plannerState.dismissedWarnings ?? []}
              openDistroEditor={openDistroEditor}
            />
          ))
        )}
      </div>

      <hr style={styles.divider} />

      <h3>Distro Output Links</h3>

      <div style={styles.list}>
        {autoSourceSummaries.length === 0 ? (
          <p style={styles.muted}>
            No auto-created sources yet. Add a distro with 32A+ outputs.
          </p>
        ) : (
          autoSourceSummaries.map((summary) => (
            <PowerSourceCard
              key={summary.source.id}
              summary={summary}
              dismissedWarnings={plannerState.dismissedWarnings ?? []}
              openDistroEditor={openDistroEditor}
            />
          ))
        )}
      </div>
    </section>
  );
}

function PowerSourceCard({
  summary,
  onDelete,
  onMoveUp,
  onMoveDown,
  moveUpDisabled = false,
  moveDownDisabled = false,
  dismissedWarnings = [],
  openDistroEditor,
}: {
  summary: SourceCardSummary;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  dismissedWarnings?: PlannerState["dismissedWarnings"];
  openDistroEditor: (distroId: string) => void;
}) {
  const activeIssues = activeIssuesForScope("planner-warnings", summary.issues, dismissedWarnings);
  const health = sourceHealth(activeIssues);
  const imbalance = isThreePhaseConnection(summary.source.conn)
    ? phaseImbalance(summary.phaseLoads)
    : 0;

  return (
    <div
      style={{
        ...styles.sourceCard,
        ...(health === "critical"
          ? styles.cardCritical
          : health === "warning"
            ? styles.cardWarning
            : {}),
        ...sourcePhaseStyle(summary.source),
      }}
    >
      <div style={styles.sourceHeader}>
        <div>
          <div style={styles.titleRow}>
            <strong>{summary.source.name}</strong>
            <span
              style={{
                ...styles.healthBadge,
                ...(health === "critical"
                  ? styles.healthCritical
                  : health === "warning"
                    ? styles.healthWarning
                    : styles.healthOk),
              }}
            >
              {health === "critical"
                ? "Critical"
                : health === "warning"
                  ? "Warning"
                  : "OK"}
            </span>
          </div>
          <p style={styles.muted}>
            {displaySourceConnection(summary.source)}
            {summary.isAuto ? " · Auto-created" : ""}
          </p>
          {summary.source.notes && (
            <p style={styles.notes}>{summary.source.notes}</p>
          )}
        </div>

        <div style={styles.sourceTotals}>
          <strong>{formatWatts(summary.watts)}</strong>
          <span>{formatAmps(summary.amps)} total draw</span>
          {onDelete && (
            <div style={styles.actionRow}>
              <button
                style={styles.arrowButton}
                onClick={onMoveUp}
                disabled={moveUpDisabled}
                aria-label={`Move ${summary.source.name} up`}
                title="Move up"
              >
                ↑
              </button>
              <button
                style={styles.arrowButton}
                onClick={onMoveDown}
                disabled={moveDownDisabled}
                aria-label={`Move ${summary.source.name} down`}
                title="Move down"
              >
                ↓
              </button>
              <button style={styles.dangerButton} onClick={onDelete}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <PhaseGrid loads={summary.phaseLoads} rating={summary.source.rating} />

      {isThreePhaseConnection(summary.source.conn) && (
        <p style={styles.imbalanceText}>
          Phase imbalance: <strong>{Math.round(imbalance)}%</strong>
        </p>
      )}

      {summary.assignedDistros.length > 0 ? (
        <div style={styles.assignedBox}>
          <strong>Assigned distros</strong>
          <div style={styles.assignedList}>
            {summary.assignedDistros.map((distroSummary) => (
              <div key={distroSummary.distro.id} style={styles.assignedDistro}>
                <span>
                  {distroSummary.distro.instanceName.trim()
                    ? `${distroSummary.distro.instanceName} - ${distroSummary.distro.name}`
                    : distroSummary.distro.name}
                </span>
                <div style={styles.assignedActions}>
                  <strong>{formatWatts(distroSummary.watts)}</strong>
                  <button
                    style={styles.smallButton}
                    onClick={() => openDistroEditor(distroSummary.distro.id)}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={styles.muted}>No distro currently assigned.</p>
      )}
    </div>
  );
}

function PhaseGrid({ loads, rating }: { loads: PhaseLoads; rating: number }) {
  return (
    <div style={styles.phaseGrid}>
      <PhaseCard phase="L1" amps={loads.L1} rating={rating} />
      <PhaseCard phase="L2" amps={loads.L2} rating={rating} />
      <PhaseCard phase="L3" amps={loads.L3} rating={rating} />
    </div>
  );
}

function PhaseCard({
  phase,
  amps,
  rating,
}: {
  phase: string;
  amps: number;
  rating: number;
}) {
  const percent = phasePercentage(amps, rating);
  const overloaded = percent > 100;
  const nearLimit = percent >= 95;

  return (
    <div
      style={{
        ...styles.phaseCard,
        ...(overloaded
          ? styles.phaseCritical
          : nearLimit
            ? styles.phaseWarning
            : {}),
      }}
    >
      <div style={styles.phaseHeader}>
        <strong>{phase}</strong>
        <span>{percent}%</span>
      </div>
      <p style={styles.muted}>
        {formatAmps(amps)} / {formatAmps(rating)}
      </p>
      <div style={styles.meter}>
        <div
          style={{
            ...styles.meterFill,
            width: `${Math.min(percent, 100)}%`,
            background: overloaded
              ? "#E5484D"
              : nearLimit
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
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  muted: {
    color: "#667085",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 180px 120px",
    gap: "12px",
    marginTop: "16px",
  },
  label: {
    display: "block",
    marginBottom: "14px",
    color: "#667085",
    fontWeight: 400,
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
  },
  textarea: {
    width: "100%",
    minHeight: "80px",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button, #000000)",
    background: "var(--lva-workspace-dark-button, #000000)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 500,
  },
  dangerButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #E5484D",
    background: "#FFF1F1",
    color: "#E5484D",
    cursor: "pointer",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #DCE5EC",
    margin: "22px 0",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  sourceCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    padding: "16px",
    background: "#F5F7FA",
  },
  singlePhaseCard: {
    borderLeft: "6px solid #007D8F",
  },
  threePhaseCard: {
    borderLeft: "6px solid #dc2626",
  },
  cardWarning: {
    borderColor: "#f59e0b",
    background: "#FFFBEB",
  },
  cardCritical: {
    borderColor: "#E5484D",
    background: "#FFF1F1",
  },
  sourceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  titleRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  sourceTotals: {
    display: "grid",
    gap: "6px",
    justifyItems: "end",
    color: "#111827",
    minWidth: "160px",
  },
  actionRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  arrowButton: {
    width: "34px",
    height: "34px",
    padding: 0,
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 400,
    lineHeight: 1,
  },
  healthBadge: {
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 500,
  },
  healthOk: {
    background: "#EAFBF3",
    color: "#0A8F5D",
  },
  healthWarning: {
    background: "#FFFBEB",
    color: "#92400E",
    border: "1px solid #FDE68A",
  },
  healthCritical: {
    background: "#FFF1F1",
    color: "#B42318",
    border: "1px solid #FECACA",
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "14px",
  },
  phaseCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    padding: "10px",
    background: "white",
  },
  phaseWarning: {
    borderColor: "#f59e0b",
    background: "#FFFBEB",
  },
  phaseCritical: {
    borderColor: "#E5484D",
    background: "#FFF1F1",
  },
  phaseHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
  },
  meter: {
    height: "9px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#E9EEF3",
  },
  meterFill: {
    height: "100%",
    borderRadius: "999px",
  },
  imbalanceText: {
    marginTop: "10px",
    marginBottom: 0,
    color: "#111827",
  },
  assignedBox: {
    marginTop: "14px",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    padding: "12px",
    background: "white",
  },
  assignedList: {
    display: "grid",
    gap: "6px",
    marginTop: "8px",
  },
  assignedDistro: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    borderTop: "1px solid #eef2f7",
    paddingTop: "6px",
    alignItems: "center",
  },
  assignedActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  smallButton: {
    padding: "6px 9px",
    borderRadius: "8px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 500,
  },
  issuesPanel: {
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    padding: "16px",
    background: "#F5F7FA",
    marginTop: "20px",
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
  notes: {
    margin: "6px 0 0",
    color: "#111827",
  },
};
