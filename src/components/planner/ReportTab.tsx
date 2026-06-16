import type { CSSProperties } from "react";
import {
  displayDistroName,
  formatAmps,
  outputDisplayName,
  outputPhaseLoads,
  outputWatts,
  phaseLoadTotal,
  socapexOutputPhaseLoads,
  systemLoadSummary,
} from "@/planner/calculations";
import type { DistroLoadSummary } from "@/planner/calculations";
import type { PlannerOutput, PlannerState, ProjectDistro, ProjectInfo } from "@/planner/types";

type ReportTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
};

type ReportRow = {
  id: string;
  output: string;
  phase: string;
  type: string;
  item: string;
  qty: string;
  watts: string;
  amps: string;
  outputNotes: string;
};

function sourceConnectionText(connection: string, rating: number) {
  return `${connection} · ${rating}A per phase`;
}

function phaseDrawText(loads: { L1: number; L2: number; L3: number }) {
  return `L1 ${formatAmps(loads.L1)} / L2 ${formatAmps(loads.L2)} / L3 ${formatAmps(loads.L3)}`;
}

function wattsText(value: number) {
  return `${Math.round(value).toLocaleString()} W`;
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

function displayDate(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function itemText(item: { name: string; notes?: string }) {
  const notes = item.notes?.trim();
  return notes ? `${item.name} — ${notes}` : item.name;
}

function itemAmpsText(watts: number, output: PlannerOutput) {
  const amps = watts / 230;

  if (output.phase === "3Φ") {
    const perPhase = amps / 3;
    return `L1 ${formatAmps(perPhase)} / L2 ${formatAmps(perPhase)} / L3 ${formatAmps(perPhase)}`;
  }

  return formatAmps(amps);
}

function linkedDistroAmpsText(summary: DistroLoadSummary, output: PlannerOutput) {
  if (output.phase === "3Φ") {
    return `L1 ${formatAmps(summary.phaseLoads.L1)} / L2 ${formatAmps(
      summary.phaseLoads.L2
    )} / L3 ${formatAmps(summary.phaseLoads.L3)}`;
  }

  return formatAmps(phaseLoadTotal(summary.phaseLoads));
}

function childByOutputId(summary: DistroLoadSummary) {
  const map = new Map<string, DistroLoadSummary>();

  summary.children.forEach((child) => {
    if (child.fedFromOutputId) {
      map.set(child.fedFromOutputId, child);
    }
  });

  return map;
}

function buildOutputRows(
  output: PlannerOutput,
  outputIndex: number,
  distro: ProjectDistro,
  plannerState: PlannerState,
  linkedChild?: DistroLoadSummary,
  outputPrefix?: string
): ReportRow[] {
  const rows: ReportRow[] = [];
  const outputName = outputPrefix
    ? `${outputPrefix} / ${outputDisplayName(output, outputIndex)}`
    : outputDisplayName(output, outputIndex);

  if (output.phase === "Socapex") {
    rows.push({
      id: `${output.id}-parent`,
      output: outputName,
      phase: output.phase,
      type: output.type,
      item: "Socapex",
      qty: "",
      watts: "0",
      amps: "",
      outputNotes: output.notes ?? "",
    });

    (output.socaCircuits ?? [])
      .slice()
      .sort((a, b) => (a.circuitNo ?? 0) - (b.circuitNo ?? 0))
      .forEach((socket, socketIndex) => {
        rows.push(
          ...buildOutputRows(
            socket,
            socketIndex,
            distro,
            plannerState,
            undefined,
            outputName
          )
        );
      });

    return rows;
  }

  output.items.forEach((item, itemIndex) => {
    const watts = item.watts * item.quantity;

    rows.push({
      id: `${output.id}-${item.id}`,
      output: itemIndex === 0 ? outputName : "",
      phase: itemIndex === 0 ? output.phase : "",
      type: itemIndex === 0 ? output.type : "",
      item: itemText(item),
      qty: String(item.quantity),
      watts: String(Math.round(watts)),
      amps: itemAmpsText(watts, output),
      outputNotes: itemIndex === 0 ? output.notes ?? "" : "",
    });
  });

  if (linkedChild) {
    rows.push({
      id: `${output.id}-linked-${linkedChild.distro.id}`,
      output: rows.length === 0 ? outputName : "",
      phase: rows.length === 0 ? output.phase : "",
      type: rows.length === 0 ? output.type : "",
      item: `Linked distro: ${displayDistroName(linkedChild.distro)}`,
      qty: "1",
      watts: String(Math.round(linkedChild.watts)),
      amps: linkedDistroAmpsText(linkedChild, output),
      outputNotes: rows.length === 0 ? output.notes ?? "" : "",
    });
  }

  if (rows.length === 0 && output.notes?.trim()) {
    const loads = outputPhaseLoads(output, plannerState, distro);

    rows.push({
      id: `${output.id}-notes-only`,
      output: outputName,
      phase: output.phase,
      type: output.type,
      item: "",
      qty: "",
      watts: String(Math.round(outputWatts(output, plannerState, distro))),
      amps: output.phase === "3Φ" ? phaseDrawText(loads) : formatAmps(phaseLoadTotal(loads)),
      outputNotes: output.notes,
    });
  }

  return rows;
}

function buildDistroRows(
  summary: DistroLoadSummary,
  plannerState: PlannerState
): ReportRow[] {
  const linkedChildren = childByOutputId(summary);

  return summary.distro.outputs.flatMap((output, outputIndex) =>
    buildOutputRows(
      output,
      outputIndex,
      summary.distro,
      plannerState,
      linkedChildren.get(output.id)
    )
  );
}

export function ReportTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
}: ReportTabProps) {
  const summary = systemLoadSummary(plannerState);
  const hiddenSources = plannerState.reportHiddenSources ?? [];
  const visibleSourceSummaries = summary.sourceSummaries.filter(
    (source) => !hiddenSources.includes(source.sourceId)
  );
  const projectInfo = projectInfoForState(plannerState);
  const reportTitle = projectInfo.projectName.trim() || "Power Report";
  const reportMetaItems = [
    ["Project Manager", projectInfo.projectManager],
    ["Project Number", projectInfo.projectNumber],
    ["Event Date", displayDate(projectInfo.eventDate)],
    ["Venue", projectInfo.venue],
  ].filter(([, value]) => String(value).trim());

  function toggleSource(sourceId: string) {
    const currentHiddenSources = plannerState.reportHiddenSources ?? [];
    const nextHiddenSources = currentHiddenSources.includes(sourceId)
      ? currentHiddenSources.filter((id) => id !== sourceId)
      : [...currentHiddenSources, sourceId];

    setPlannerState({
      ...plannerState,
      reportHiddenSources: nextHiddenSources,
    });
  }

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
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
              color: #111827;
              background: white;
              font-size: 10.5px;
            }
            h1, h2, h3, h4, p { margin-top: 0; }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 8.8px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 3.5px;
              text-align: left;
              vertical-align: top;
              word-break: normal;
              overflow-wrap: anywhere;
            }
            th {
              background: #eaf1f8;
              font-weight: 700;
            }
            .no-print { display: none !important; }
            .report-source {
              break-inside: auto;
              page-break-inside: auto;
            }
            .report-distro {
              break-inside: auto;
              page-break-inside: auto;
              margin-top: 12px;
            }
            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .distro-summary-box, .source-summary-box {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            @page {
              size: A4 portrait;
              margin: 9mm;
            }
          </style>
        </head>
        <body>${reportElement.innerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <section style={styles.pageShell}>
      <div className="no-print" style={styles.toolbar}>
        <div>
          <h2>Report</h2>
          <p style={styles.muted}>
            Toggle sources for export. The PDF preview below mirrors the original HTML report layout.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={exportReportPdf}>
          Export PDF
        </button>
      </div>

      <section className="no-print" style={styles.togglePanel}>
        <h3>Sources included in export</h3>

        {summary.sourceSummaries.length === 0 ? (
          <p style={styles.muted}>No manual power sources added.</p>
        ) : (
          <div style={styles.toggleGrid}>
            {summary.sourceSummaries.map((source) => (
              <label key={source.sourceId} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={!hiddenSources.includes(source.sourceId)}
                  onChange={() => toggleSource(source.sourceId)}
                />
                <span>
                  <strong>{source.sourceName}</strong> · {source.sourceConnection}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <div id="power-planner-report" style={styles.reportPage}>
        <header style={styles.reportHeader}>
          <div>
            <h1 style={styles.reportTitle}>{reportTitle}</h1>
            {projectInfo.projectNumber.trim() && (
              <p style={styles.reportSubtitle}>
                Project Number: {projectInfo.projectNumber}
              </p>
            )}
          </div>

          {reportMetaItems.length > 0 && (
            <div style={styles.reportMetaGrid}>
              {reportMetaItems.map(([label, value]) => (
                <div key={label} style={styles.reportMetaItem}>
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          )}
        </header>

        {visibleSourceSummaries.length === 0 ? (
          <p style={styles.muted}>No sources selected for this report.</p>
        ) : (
          visibleSourceSummaries.map((source) => (
            <section
              key={source.sourceId}
              className="report-source"
              style={styles.sourceSection}
            >
              <h2 style={styles.sourceTitle}>{source.sourceName}</h2>

              <div className="source-summary-box" style={styles.sourceSummaryBox}>
                <div>
                  <strong>Source:</strong>{" "}
                  {sourceConnectionText(source.sourceConnection, source.sourceRating)}
                </div>
                <div>
                  <strong>Phase draw:</strong> {phaseDrawText(source.phaseLoads)}
                </div>
                <div>
                  <strong>Connected load:</strong> {wattsText(source.watts)}
                </div>
                <div style={styles.fullWidth}>
                  <strong>Notes:</strong>{" "}
                  {plannerState.sources.find((item) => item.id === source.sourceId)?.notes ?? ""}
                </div>
              </div>

              {source.distros.map((distroSummary) => (
                <DistroReport
                  key={distroSummary.distro.id}
                  summary={distroSummary}
                  plannerState={plannerState}
                  sourceName={source.sourceName}
                  sourceConnection={source.sourceConnection}
                  sourceRating={source.sourceRating}
                  sourceNotes={
                    plannerState.sources.find((item) => item.id === source.sourceId)
                      ?.notes ?? ""
                  }
                  openDistroEditor={openDistroEditor}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </section>
  );
}

function DistroReport({
  summary,
  plannerState,
  sourceName,
  sourceConnection,
  sourceRating,
  sourceNotes,
  openDistroEditor,
}: {
  summary: DistroLoadSummary;
  plannerState: PlannerState;
  sourceName: string;
  sourceConnection: string;
  sourceRating: number;
  sourceNotes: string;
  openDistroEditor: (distroId: string) => void;
}) {
  const rows = buildDistroRows(summary, plannerState);
  const sourceLabel = summary.fedFromOutputLabel
    ? `${sourceName} - ${summary.fedFromOutputLabel}`
    : sourceName;
  const sourceNotesText = summary.fedFromOutputLabel
    ? `Auto source from ${sourceName} output ${summary.fedFromOutputLabel}`
    : sourceNotes;

  return (
    <section className="report-distro" style={styles.distroSection}>
      <div style={styles.distroHeaderRow}>
        <h3 style={styles.distroTitle}>{displayDistroName(summary.distro)}</h3>
        <button
          className="no-print"
          style={styles.secondaryButton}
          onClick={() => openDistroEditor(summary.distro.id)}
        >
          Open
        </button>
      </div>

      <div className="distro-summary-box" style={styles.distroSummaryBox}>
        <div>
          <strong>Location:</strong> {summary.distro.location}
        </div>
        <div>
          <strong>Source:</strong> {sourceLabel} · {sourceConnection} · {sourceRating}A per phase
        </div>
        <div>
          <strong>Input:</strong> {summary.distro.input} · {summary.distro.inputA}A per phase
        </div>
        <div>
          <strong>Phase cap:</strong> {summary.distro.inputA}A per phase
        </div>
        <div>
          <strong>Phase draw:</strong> {phaseDrawText(summary.phaseLoads)}
        </div>
        <div>
          <strong>Source notes:</strong> {sourceNotesText}
        </div>
        <div>
          <strong>Distro notes:</strong> {summary.distro.notes}
        </div>
      </div>

      <table style={styles.table}>
        <colgroup>
          <col style={{ width: "17%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "4%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={styles.th}>Output</th>
            <th style={styles.th}>Phase</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Item</th>
            <th style={styles.th}>Qty</th>
            <th style={styles.th}>W</th>
            <th style={styles.th}>A</th>
            <th style={styles.th}>Output notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} style={styles.emptyCell}>
                No connected outputs.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td style={styles.td}>{row.output}</td>
                <td style={styles.td}>{row.phase}</td>
                <td style={styles.td}>{row.type}</td>
                <td style={styles.td}>{row.item}</td>
                <td style={styles.td}>{row.qty}</td>
                <td style={styles.td}>{row.watts}</td>
                <td style={styles.td}>{row.amps}</td>
                <td style={styles.td}>{row.outputNotes}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {summary.children.map((child) => (
        <DistroReport
          key={child.distro.id}
          summary={child}
          plannerState={plannerState}
          sourceName={displayDistroName(summary.distro)}
          sourceConnection={child.distro.input}
          sourceRating={child.distro.inputA}
          sourceNotes=""
          openDistroEditor={openDistroEditor}
        />
      ))}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  pageShell: {
    display: "grid",
    gap: "16px",
  },
  toolbar: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  muted: {
    color: "#667085",
  },
  primaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #000000",
    background: "#000000",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
  },
  secondaryButton: {
    padding: "7px 10px",
    borderRadius: "9px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
  },
  togglePanel: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
  },
  toggleGrid: {
    display: "grid",
    gap: "10px",
  },
  checkboxLabel: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  reportPage: {
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "24px",
    background: "white",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
    color: "#111827",
    fontSize: "11px",
    lineHeight: 1.25,
  },
  reportHeader: {
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "12px",
    background: "#F5F7FA",
    marginBottom: "16px",
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr",
    gap: "12px",
    alignItems: "start",
  },
  reportTitle: {
    fontSize: "22px",
    marginBottom: "4px",
  },
  reportSubtitle: {
    margin: 0,
    color: "#475467",
    fontWeight: 800,
  },
  reportMetaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "7px",
  },
  reportMetaItem: {
    display: "grid",
    gap: "2px",
    border: "1px solid #dbe3eb",
    borderRadius: "10px",
    padding: "7px",
    background: "#FFFFFF",
  },
  sourceSection: {
    marginBottom: "22px",
  },
  sourceTitle: {
    fontSize: "20px",
    marginBottom: "8px",
  },
  sourceSummaryBox: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "9px",
    background: "#F5F7FA",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "6px 16px",
    marginBottom: "14px",
  },
  fullWidth: {
    gridColumn: "1 / -1",
  },
  distroSection: {
    marginTop: "14px",
    marginBottom: "16px",
  },
  distroHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  distroTitle: {
    fontSize: "15px",
    marginBottom: "8px",
  },
  distroSummaryBox: {
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    padding: "8px",
    background: "#F5F7FA",
    marginBottom: "8px",
    display: "grid",
    gap: "2px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "10px",
    marginBottom: "12px",
    border: "1px solid #cbd5e1",
  },
  th: {
    border: "1px solid #cbd5e1",
    padding: "5px",
    textAlign: "left",
    verticalAlign: "top",
    background: "#eaf1f8",
    fontWeight: 800,
    color: "#111827",
  },
  td: {
    border: "1px solid #cbd5e1",
    padding: "5px",
    textAlign: "left",
    verticalAlign: "top",
    background: "white",
    overflowWrap: "anywhere",
  },
  emptyCell: {
    textAlign: "center",
    color: "#667085",
    padding: "10px",
    border: "1px solid #cbd5e1",
  },
};
