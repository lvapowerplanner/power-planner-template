import {
  formatAmps,
  formatWatts,
  phasePercentage,
  systemLoadSummary,
} from "@/planner/calculations";
import type { PhaseLoads } from "@/planner/calculations";
import type { PlannerState } from "@/planner/types";

type SystemOverviewTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
};

export function SystemOverviewTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
}: SystemOverviewTabProps) {
  const summary = systemLoadSummary(plannerState);

  function updateSystemName(value: string) {
    setPlannerState({
      ...plannerState,
      systemName: value,
    });
  }

  return (
    <section style={styles.card}>
      <h2>System Overview</h2>

      <label style={styles.label}>
        System Name
        <input
          style={styles.input}
          value={plannerState.systemName}
          onChange={(event) => updateSystemName(event.target.value)}
          placeholder="e.g. Main Stage Power System"
        />
      </label>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Total Distros" value={summary.totalDistros} />
        <SummaryCard
          label="Power Sources"
          value={summary.manualPowerSources}
        />
        <SummaryCard
          label="Connected Load Watts"
          value={formatWatts(summary.connectedWatts)}
        />
        <SummaryCard
          label="Connected Load Amps"
          value={formatAmps(summary.connectedAmps)}
        />
      </div>

      <section style={styles.flowSection}>
        <h3>Power Flow</h3>

        {summary.sourceSummaries.length === 0 ? (
          <p style={styles.muted}>No manual power sources added yet.</p>
        ) : (
          <div style={styles.sourceList}>
            {summary.sourceSummaries.map((source) => (
              <div key={source.sourceId} style={styles.sourceCard}>
                <div style={styles.sourceHeader}>
                  <div>
                    <strong>{source.sourceName}</strong>
                    <p style={styles.muted}>
                      {source.sourceConnection} · {source.sourceRating}A per
                      phase
                    </p>
                  </div>

                  <div style={styles.sourceTotal}>
                    {formatWatts(source.watts)} · {formatAmps(source.amps)}
                  </div>
                </div>

                <PhaseLoadGrid
                  loads={source.phaseLoads}
                  rating={source.sourceRating}
                />

                {source.distros.length === 0 ? (
                  <p style={styles.muted}>No distros assigned to this source.</p>
                ) : (
                  <div style={styles.distroFlowList}>
                    {source.distros.map((distroSummary) => (
                      <div
                        key={distroSummary.distro.id}
                        style={styles.distroFlowCard}
                      >
                        <div style={styles.sourceHeader}>
                          <div>
                            <strong>
                              {displayDistroName(distroSummary.distro)}
                            </strong>
                            <p style={styles.muted}>
                              {distroSummary.distro.name} ·{" "}
                              {distroSummary.distro.input}
                            </p>
                          </div>

                          <button
                            style={styles.secondaryButton}
                            onClick={() =>
                              openDistroEditor(distroSummary.distro.id)
                            }
                          >
                            Open
                          </button>
                        </div>

                        <PhaseLoadGrid
                          loads={distroSummary.phaseLoads}
                          rating={distroSummary.distro.inputA}
                        />

                        <p style={styles.muted}>
                          {formatWatts(distroSummary.watts)} ·{" "}
                          {formatAmps(distroSummary.amps)}
                        </p>
                      </div>
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

            <div style={styles.distroFlowList}>
              {summary.unassignedDistros.map((distroSummary) => (
                <div
                  key={distroSummary.distro.id}
                  style={styles.unassignedCard}
                >
                  <div style={styles.sourceHeader}>
                    <div>
                      <strong>{displayDistroName(distroSummary.distro)}</strong>
                      <p style={styles.muted}>
                        {distroSummary.distro.name} · {distroSummary.distro.input}
                      </p>
                    </div>

                    <button
                      style={styles.secondaryButton}
                      onClick={() => openDistroEditor(distroSummary.distro.id)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </section>
  );
}

function displayDistroName(distro: { instanceName: string; name: string }) {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
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
                : percentage >= 80
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
  muted: {
    color: "#637083",
  },
  label: {
    display: "block",
    marginBottom: "18px",
    color: "#637083",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "22px",
  },
  summaryCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
  flowSection: {
    marginTop: "22px",
  },
  sourceList: {
    display: "grid",
    gap: "16px",
  },
  sourceCard: {
    border: "2px solid #93c5fd",
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
  sourceTotal: {
    fontWeight: 700,
    color: "#172033",
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "12px",
    marginBottom: "12px",
  },
  phaseCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "10px",
    background: "#f8fafc",
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
  distroFlowList: {
    display: "grid",
    gap: "10px",
    marginTop: "12px",
  },
  distroFlowCard: {
    border: "1px solid #d9e0ea",
    borderLeft: "5px solid #2563eb",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
  unassignedSection: {
    marginTop: "24px",
  },
  unassignedCard: {
    border: "1px dashed #b7791f",
    borderRadius: "14px",
    padding: "14px",
    background: "#fffbeb",
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