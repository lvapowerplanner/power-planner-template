import {
  displayDistroName,
  formatAmps,
  formatWatts,
  outputDisplayName,
  outputPhaseLoads,
  outputWatts,
  socapexOutputPhaseLoads,
  systemLoadSummary,
} from "@/planner/calculations";
import type { PlannerOutput, PlannerState, ProjectDistro } from "@/planner/types";

type ReportTabProps = {
  plannerState: PlannerState;
  openDistroEditor: (distroId: string) => void;
};

export function ReportTab({ plannerState, openDistroEditor }: ReportTabProps) {
  const summary = systemLoadSummary(plannerState);
  const reportTitle = plannerState.systemName.trim() || "Export Report";

  function exportReportPdf() {
    const reportElement = document.getElementById("power-planner-report");

    if (!reportElement) {
      alert("Report could not be found.");
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Popup blocked. Please allow popups and try again.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, sans-serif;
              color: #172033;
              background: white;
            }

            h2, h3, h4, h5 {
              margin-top: 0;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }

            th, td {
              border: 1px solid #d9e0ea;
              padding: 6px;
              text-align: left;
              vertical-align: top;
            }

            th {
              background: #f1f5f9;
            }

            .no-print {
              display: none !important;
            }

            .report-page-break-safe {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            @page {
              size: A4 landscape;
              margin: 12mm;
            }
          </style>
        </head>
        <body>
          ${reportElement.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <section style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2>{reportTitle}</h2>
          <p style={styles.muted}>Project power report preview.</p>
        </div>

        <button style={styles.button} onClick={exportReportPdf}>
          Export PDF
        </button>
      </div>

      <div id="power-planner-report">
        <div style={styles.headerRow}>
          <div>
            <h2>{reportTitle}</h2>
            <p style={styles.muted}>Project power report.</p>
          </div>

          <div style={styles.statusBox}>
            <strong>System Health</strong>
            <span>
              {summary.health === "ok" && "OK"}
              {summary.health === "warning" &&
                `${summary.warningCount} warning(s)`}
              {summary.health === "critical" &&
                `${summary.criticalCount} critical / ${summary.warningCount} warning(s)`}
            </span>
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <SummaryCard label="Power Sources" value={summary.manualPowerSources} />
          <SummaryCard label="Total Distros" value={summary.totalDistros} />
          <SummaryCard
            label="Connected Watts"
            value={formatWatts(summary.connectedWatts)}
          />
          <SummaryCard
            label="Connected Amps"
            value={formatAmps(summary.connectedAmps)}
          />
        </div>

        {summary.issues.length > 0 && (
          <section style={styles.reportSection}>
            <h3>Warnings & Issues</h3>

            <div style={styles.issueList}>
              {summary.issues.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    ...styles.issueItem,
                    ...(issue.severity === "critical"
                      ? styles.issueCritical
                      : styles.issueWarning),
                  }}
                >
                  <strong>
                    {issue.severity === "critical" ? "Critical" : "Warning"}
                  </strong>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={styles.reportSection}>
          <h3>Power Source Groups</h3>

          {summary.sourceSummaries.length === 0 ? (
            <p style={styles.muted}>No power sources added.</p>
          ) : (
            <div style={styles.sourceGroupList}>
              {summary.sourceSummaries.map((source) => (
                <div
                  key={source.sourceId}
                  style={styles.sourceGroup}
                  className="report-page-break-safe"
                >
                  <div style={styles.sourceHeader}>
                    <div>
                      <h4>{source.sourceName}</h4>
                      <p style={styles.muted}>
                        {source.sourceConnection} · {source.sourceRating}A per
                        phase
                      </p>
                    </div>

                    <div style={styles.sourceTotals}>
                      <strong>{formatWatts(source.watts)}</strong>
                      <span>{formatAmps(source.amps)}</span>
                    </div>
                  </div>

                  <PhaseLoadSummary
                    l1={source.phaseLoads.L1}
                    l2={source.phaseLoads.L2}
                    l3={source.phaseLoads.L3}
                  />

                  {source.distros.length === 0 ? (
                    <p style={styles.muted}>No distros assigned.</p>
                  ) : (
                    source.distros.map((distroSummary) => (
                      <DistroReportBlock
                        key={distroSummary.distro.id}
                        distro={distroSummary.distro}
                        openDistroEditor={openDistroEditor}
                      />
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {summary.unassignedDistros.length > 0 && (
          <section style={styles.reportSection}>
            <h3>Unassigned Distros</h3>

            <div style={styles.sourceGroupList}>
              {summary.unassignedDistros.map((distroSummary) => (
                <DistroReportBlock
                  key={distroSummary.distro.id}
                  distro={distroSummary.distro}
                  openDistroEditor={openDistroEditor}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

function DistroReportBlock({
  distro,
  openDistroEditor,
}: {
  distro: ProjectDistro;
  openDistroEditor: (distroId: string) => void;
}) {
  const singleOutputs = distro.outputs.filter(
    (output) => output.phase !== "Socapex" && output.phase !== "3Φ"
  );

  const socapexOutputs = distro.outputs.filter(
    (output) => output.phase === "Socapex"
  );

  const threePhaseOutputs = distro.outputs.filter(
    (output) => output.phase === "3Φ"
  );

  return (
    <div style={styles.distroBlock} className="report-page-break-safe">
      <div style={styles.distroHeader}>
        <div>
          <h4>{displayDistroName(distro)}</h4>
          <p style={styles.muted}>
            {distro.name} · Input {distro.input}
            {distro.location ? ` · ${distro.location}` : ""}
          </p>
        </div>

        <button
          className="no-print"
          style={styles.secondaryButton}
          onClick={() => openDistroEditor(distro.id)}
        >
          Open
        </button>
      </div>

      {distro.notes && (
        <div style={styles.notesBox}>
          <strong>Distro Notes</strong>
          <p>{distro.notes}</p>
        </div>
      )}

      <OutputTable
        title="Single Phase Outputs"
        outputs={singleOutputs}
        parentOutputs={distro.outputs}
      />

      <SocapexReport outputs={socapexOutputs} parentOutputs={distro.outputs} />

      <OutputTable
        title="Three Phase Outputs"
        outputs={threePhaseOutputs}
        parentOutputs={distro.outputs}
        threePhase
      />
    </div>
  );
}

function OutputTable({
  title,
  outputs,
  parentOutputs,
  threePhase = false,
}: {
  title: string;
  outputs: PlannerOutput[];
  parentOutputs: PlannerOutput[];
  threePhase?: boolean;
}) {
  if (outputs.length === 0) return null;

  return (
    <section style={styles.outputSection}>
      <h5>{title}</h5>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Output</th>
            <th style={styles.th}>Phase</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Equipment</th>
            <th style={styles.th}>Watts</th>
            <th style={styles.th}>Amps</th>
            <th style={styles.th}>Notes</th>
          </tr>
        </thead>

        <tbody>
          {outputs.map((output) => {
            const outputIndex = parentOutputs.findIndex(
              (item) => item.id === output.id
            );

            const phaseLoads = outputPhaseLoads(output);
            const amps = threePhase
              ? phaseLoads.L1
              : phaseLoads.L1 + phaseLoads.L2 + phaseLoads.L3;

            return (
              <tr key={output.id}>
                <td style={styles.td}>
                  {outputDisplayName(output, outputIndex)}
                </td>
                <td style={styles.td}>{output.phase}</td>
                <td style={styles.td}>{output.type}</td>
                <td style={styles.td}>
                  {output.items.length === 0
                    ? "-"
                    : output.items
                        .map((item) => `${item.quantity} × ${item.name}`)
                        .join(", ")}
                </td>
                <td style={styles.td}>{formatWatts(outputWatts(output))}</td>
                <td style={styles.td}>
                  {threePhase
                    ? `${formatAmps(amps)} / phase`
                    : formatAmps(amps)}
                </td>
                <td style={styles.td}>{output.notes || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function SocapexReport({
  outputs,
  parentOutputs,
}: {
  outputs: PlannerOutput[];
  parentOutputs: PlannerOutput[];
}) {
  if (outputs.length === 0) return null;

  return (
    <section style={styles.outputSection}>
      <h5>Socapex Outputs</h5>

      {outputs.map((soca) => {
        const socaIndex = parentOutputs.findIndex((item) => item.id === soca.id);
        const loads = socapexOutputPhaseLoads(soca);

        return (
          <div
            key={soca.id}
            style={styles.socaReportBlock}
            className="report-page-break-safe"
          >
            <div style={styles.socaHeader}>
              <strong>{outputDisplayName(soca, socaIndex)}</strong>
              <span>
                L1 {formatAmps(loads.L1)} · L2 {formatAmps(loads.L2)} · L3{" "}
                {formatAmps(loads.L3)}
              </span>
            </div>

            {soca.notes && (
              <p style={styles.muted}>
                <strong>Notes:</strong> {soca.notes}
              </p>
            )}

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Socket</th>
                  <th style={styles.th}>Phase</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Equipment</th>
                  <th style={styles.th}>Watts</th>
                  <th style={styles.th}>Amps</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>

              <tbody>
                {(soca.socaCircuits ?? [])
                  .slice()
                  .sort((a, b) => (a.circuitNo ?? 0) - (b.circuitNo ?? 0))
                  .map((socket) => {
                    const socketLoads = outputPhaseLoads(socket);
                    const socketAmps =
                      socketLoads.L1 + socketLoads.L2 + socketLoads.L3;

                    return (
                      <tr key={socket.id}>
                        <td style={styles.td}>{socket.label}</td>
                        <td style={styles.td}>{socket.phase}</td>
                        <td style={styles.td}>{socket.type}</td>
                        <td style={styles.td}>
                          {socket.items.length === 0
                            ? "-"
                            : socket.items
                                .map((item) => `${item.quantity} × ${item.name}`)
                                .join(", ")}
                        </td>
                        <td style={styles.td}>
                          {formatWatts(outputWatts(socket))}
                        </td>
                        <td style={styles.td}>{formatAmps(socketAmps)}</td>
                        <td style={styles.td}>{socket.notes || "-"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}

function PhaseLoadSummary({
  l1,
  l2,
  l3,
}: {
  l1: number;
  l2: number;
  l3: number;
}) {
  return (
    <div style={styles.phaseSummary}>
      <div>
        <strong>L1</strong>
        <span>{formatAmps(l1)}</span>
      </div>
      <div>
        <strong>L2</strong>
        <span>{formatAmps(l2)}</span>
      </div>
      <div>
        <strong>L3</strong>
        <span>{formatAmps(l3)}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    marginBottom: "18px",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
  },
  statusBox: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "12px",
    background: "#f8fafc",
    display: "grid",
    gap: "4px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    margin: "18px 0",
  },
  summaryCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
  reportSection: {
    marginTop: "24px",
    paddingTop: "16px",
    borderTop: "1px solid #d9e0ea",
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
  sourceGroupList: {
    display: "grid",
    gap: "16px",
  },
  sourceGroup: {
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
  sourceTotals: {
    display: "grid",
    gap: "4px",
    textAlign: "right",
  },
  phaseSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    margin: "12px 0",
  },
  distroBlock: {
    border: "1px solid #d9e0ea",
    borderRadius: "16px",
    padding: "14px",
    background: "#f8fafc",
    marginTop: "12px",
  },
  distroHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  notesBox: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "10px",
    background: "white",
    marginTop: "10px",
  },
  outputSection: {
    marginTop: "14px",
  },
  socaReportBlock: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "12px",
    background: "white",
    marginBottom: "12px",
  },
  socaHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    border: "1px solid #d9e0ea",
    padding: "7px",
    textAlign: "left",
    background: "#f1f5f9",
  },
  td: {
    border: "1px solid #d9e0ea",
    padding: "7px",
    verticalAlign: "top",
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