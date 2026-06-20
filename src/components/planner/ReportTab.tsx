import type { CSSProperties } from "react";
import {
  displayDistroName,
  formatAmps,
  outputDisplayName,
  outputPhaseLoads,
  outputWatts,
  phaseLoadTotal,
  systemLoadSummary,
} from "@/planner/calculations";
import type { DistroLoadSummary } from "@/planner/calculations";
import type { PlannerOutput, PlannerState, ProjectDistro, ProjectInfo } from "@/planner/types";

type WorkspaceBranding = {
  subdomain: string;
  company_name: string;
  logo_url?: string | null;
  contact_email?: string | null;
  report_footer?: string | null;
  font_family?: string | null;
  highlight_colour?: string | null;
  dark_button_colour?: string | null;
};

type ReportTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
  workspaceBranding?: WorkspaceBranding;
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

type DistroReportItem = {
  sourceId: string;
  sourceName: string;
  sourceConnection: string;
  sourceRating: number;
  sourceNotes: string;
  summary: DistroLoadSummary;
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

function childByOutputId(
  summary: DistroLoadSummary,
  hiddenDistroIds: string[]
) {
  const map = new Map<string, DistroLoadSummary>();

  summary.children.forEach((child) => {
    if (child.fedFromOutputId && !hiddenDistroIds.includes(child.distro.id)) {
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
  plannerState: PlannerState,
  hiddenDistroIds: string[]
): ReportRow[] {
  const linkedChildren = childByOutputId(summary, hiddenDistroIds);

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

function collectVisibleDistroReports(
  items: DistroReportItem[],
  hiddenDistroIds: string[]
): DistroReportItem[] {
  return items.flatMap((item) => {
    if (hiddenDistroIds.includes(item.summary.distro.id)) return [];

    const childItems = item.summary.children.map((child) => ({
      sourceId: item.sourceId,
      sourceName: displayDistroName(item.summary.distro),
      sourceConnection: child.distro.input,
      sourceRating: child.distro.inputA,
      sourceNotes: "",
      summary: child,
    }));

    return [item, ...collectVisibleDistroReports(childItems, hiddenDistroIds)];
  });
}

function reportPrintStyles() {
  return `
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
    img { max-width: 100%; }
    .report-brand-logo {
      display: block !important;
      max-height: 42px !important;
      max-width: 150px !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-brand-name { font-weight: 700; font-size: 12px; margin-bottom: 3px; }
    .report-brand-subtitle { color: #475467; font-size: 9px; }
    .report-footer {
      margin-top: 18px;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #475467;
      font-size: 9px;
    }
    .report-source, .report-distro {
      break-inside: auto;
      page-break-inside: auto;
    }
    .individual-distro-report {
      break-after: page;
      page-break-after: always;
    }
    .individual-distro-report:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    tr, .distro-summary-box, .source-summary-box, .report-header {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @page {
      size: A4 portrait;
      margin: 9mm;
    }
  `;
}

async function waitForReportImages(printWindow: Window) {
  const images = Array.from(printWindow.document.images);

  if (images.length === 0) return;

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }

          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function imageUrlToDataUrl(url: string) {
  if (!url.trim()) return null;

  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      mode: "cors",
    });

    if (!response.ok) return null;

    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function preparePrintableHtml(bodyHtml: string, logoUrl: string) {
  const dataUrl = await imageUrlToDataUrl(logoUrl);

  if (!dataUrl) return bodyHtml;

  return bodyHtml.replace(new RegExp(escapeRegExp(logoUrl), "g"), dataUrl);
}

async function writePrintWindow(title: string, bodyHtml: string, logoUrl = "") {
  const printableBodyHtml = await preparePrintableHtml(bodyHtml, logoUrl);
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Popup blocked. Please allow popups and try again.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>${reportPrintStyles()}</style>
      </head>
      <body>${printableBodyHtml}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  await waitForReportImages(printWindow);

  setTimeout(() => {
    printWindow.print();
  }, 150);
}

export function ReportTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
  workspaceBranding,
}: ReportTabProps) {
  const summary = systemLoadSummary(plannerState);
  const hiddenSources = plannerState.reportHiddenSources ?? [];
  const hiddenDistroIds = plannerState.reportHiddenDistros ?? [];
  const visibleSourceSummaries = summary.sourceSummaries.filter(
    (source) => !hiddenSources.includes(source.sourceId)
  );
  const projectInfo = projectInfoForState(plannerState);
  const brandName = workspaceBranding?.company_name?.trim() || "LVA Power Planner";
  const brandLogoUrl = workspaceBranding?.logo_url?.trim() || "";
  const brandContactEmail = workspaceBranding?.contact_email?.trim() || "";
  const brandFooter = workspaceBranding?.report_footer?.trim() || "Generated using LVA Power Planner";
  const brandFontFamily = workspaceBranding?.font_family?.trim() || "Arial, sans-serif";
  const brandDarkButtonColour = workspaceBranding?.dark_button_colour?.trim() || "#000000";
  const reportTitle = projectInfo.projectName.trim() || "Power Report";
  const reportMetaItems = [
    ["Project Manager", projectInfo.projectManager],
    ["Project Number", projectInfo.projectNumber],
    ["Event Date", displayDate(projectInfo.eventDate)],
    ["Venue", projectInfo.venue],
  ].filter(([, value]) => String(value).trim());

  const rootDistroReports: DistroReportItem[] = visibleSourceSummaries.flatMap(
    (source) => {
      const sourceNotes =
        plannerState.sources.find((item) => item.id === source.sourceId)?.notes ?? "";

      return source.distros.map((distroSummary) => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        sourceConnection: source.sourceConnection,
        sourceRating: source.sourceRating,
        sourceNotes,
        summary: distroSummary,
      }));
    }
  );
  const visibleDistroReports = collectVisibleDistroReports(
    rootDistroReports,
    hiddenDistroIds
  );

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

  function toggleDistro(distroId: string) {
    const currentHiddenDistros = plannerState.reportHiddenDistros ?? [];
    const nextHiddenDistros = currentHiddenDistros.includes(distroId)
      ? currentHiddenDistros.filter((id) => id !== distroId)
      : [...currentHiddenDistros, distroId];

    setPlannerState({
      ...plannerState,
      reportHiddenDistros: nextHiddenDistros,
    });
  }

  async function exportReportPdf() {
    const reportElement = document.getElementById("power-planner-report");

    if (!reportElement) {
      alert("Report could not be found.");
      return;
    }

    await writePrintWindow(reportTitle, reportElement.innerHTML, brandLogoUrl);
  }

  async function exportIndividualDistroReportsPdf() {
    const reportElement = document.getElementById("individual-distro-reports");

    if (!reportElement) {
      alert("Individual distro reports could not be found.");
      return;
    }

    if (visibleDistroReports.length === 0) {
      alert("No distros selected for export.");
      return;
    }

    await writePrintWindow(`${reportTitle} - Distro Reports`, reportElement.innerHTML, brandLogoUrl);
  }

  return (
    <section style={{ ...styles.pageShell, fontFamily: brandFontFamily, "--lva-workspace-dark-button": brandDarkButtonColour } as CSSProperties}>
      <div className="no-print" style={styles.toolbar}>
        <div>
          <h2>Report</h2>
          <p style={styles.muted}>
            Toggle sources and distros for export. The preview below mirrors the report export layout.
          </p>
        </div>

        <div style={styles.buttonRow}>
          <button style={styles.secondaryButton} onClick={exportIndividualDistroReportsPdf}>
            Export Distro Reports
          </button>
          <button style={styles.primaryButton} onClick={exportReportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <section className="no-print" style={styles.togglePanel}>
        <h3>Sources and distros included in export</h3>

        {summary.sourceSummaries.length === 0 ? (
          <p style={styles.muted}>No manual power sources added.</p>
        ) : (
          <div style={styles.sourceToggleList}>
            {summary.sourceSummaries.map((source) => {
              const sourceHidden = hiddenSources.includes(source.sourceId);

              return (
                <div key={source.sourceId} style={styles.sourceToggleCard}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={!sourceHidden}
                      onChange={() => toggleSource(source.sourceId)}
                    />
                    <span>
                      <strong>{source.sourceName}</strong> · {source.sourceConnection}
                    </span>
                  </label>

                  {!sourceHidden && (
                    <div style={styles.distroToggleList}>
                      {source.distros.length === 0 ? (
                        <p style={styles.mutedSmall}>No distros assigned to this source.</p>
                      ) : (
                        source.distros.map((distroSummary) => (
                          <DistroToggle
                            key={distroSummary.distro.id}
                            summary={distroSummary}
                            hiddenDistroIds={hiddenDistroIds}
                            toggleDistro={toggleDistro}
                            level={0}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div id="power-planner-report" style={styles.reportPage}>
        <ReportHeader
          reportTitle={reportTitle}
          projectNumber={projectInfo.projectNumber}
          reportMetaItems={reportMetaItems}
          brandName={brandName}
          brandLogoUrl={brandLogoUrl}
          brandContactEmail={brandContactEmail}
        />

        {visibleSourceSummaries.length === 0 ? (
          <p style={styles.muted}>No sources selected for this report.</p>
        ) : (
          visibleSourceSummaries.map((source) => {
            const sourceNotes =
              plannerState.sources.find((item) => item.id === source.sourceId)?.notes ?? "";
            const visibleDistros = source.distros.filter(
              (distroSummary) => !hiddenDistroIds.includes(distroSummary.distro.id)
            );

            return (
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
                    <strong>Notes:</strong> {sourceNotes}
                  </div>
                </div>

                {visibleDistros.length === 0 ? (
                  <p style={styles.muted}>No distros selected for this source.</p>
                ) : (
                  visibleDistros.map((distroSummary) => (
                    <DistroReport
                      key={distroSummary.distro.id}
                      summary={distroSummary}
                      plannerState={plannerState}
                      sourceName={source.sourceName}
                      sourceConnection={source.sourceConnection}
                      sourceRating={source.sourceRating}
                      sourceNotes={sourceNotes}
                      openDistroEditor={openDistroEditor}
                      hiddenDistroIds={hiddenDistroIds}
                    />
                  ))
                )}
              </section>
            );
          })
        )}
        <ReportFooter brandName={brandName} brandFooter={brandFooter} brandContactEmail={brandContactEmail} />
      </div>

      <div id="individual-distro-reports" style={styles.hiddenPrintArea}>
        {visibleDistroReports.map((item) => (
          <section
            key={`${item.sourceId}-${item.summary.distro.id}`}
            className="individual-distro-report"
            style={styles.reportPage}
          >
            <ReportHeader
              reportTitle={`${reportTitle} - ${displayDistroName(item.summary.distro)}`}
              projectNumber={projectInfo.projectNumber}
              reportMetaItems={reportMetaItems}
              brandName={brandName}
              brandLogoUrl={brandLogoUrl}
              brandContactEmail={brandContactEmail}
            />
            <DistroReport
              summary={item.summary}
              plannerState={plannerState}
              sourceName={item.sourceName}
              sourceConnection={item.sourceConnection}
              sourceRating={item.sourceRating}
              sourceNotes={item.sourceNotes}
              openDistroEditor={openDistroEditor}
              hiddenDistroIds={hiddenDistroIds}
              renderChildren={false}
            />
            <ReportFooter brandName={brandName} brandFooter={brandFooter} brandContactEmail={brandContactEmail} />
          </section>
        ))}
      </div>
    </section>
  );
}

function DistroToggle({
  summary,
  hiddenDistroIds,
  toggleDistro,
  level,
}: {
  summary: DistroLoadSummary;
  hiddenDistroIds: string[];
  toggleDistro: (distroId: string) => void;
  level: number;
}) {
  const hidden = hiddenDistroIds.includes(summary.distro.id);

  return (
    <div style={{ ...styles.distroToggleItem, marginLeft: level * 18 }}>
      <label style={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={!hidden}
          onChange={() => toggleDistro(summary.distro.id)}
        />
        <span>{displayDistroName(summary.distro)}</span>
      </label>

      {!hidden &&
        summary.children.map((child) => (
          <DistroToggle
            key={child.distro.id}
            summary={child}
            hiddenDistroIds={hiddenDistroIds}
            toggleDistro={toggleDistro}
            level={level + 1}
          />
        ))}
    </div>
  );
}

function ReportHeader({
  reportTitle,
  projectNumber,
  reportMetaItems,
  brandName,
  brandLogoUrl,
  brandContactEmail,
}: {
  reportTitle: string;
  projectNumber: string;
  reportMetaItems: string[][];
  brandName: string;
  brandLogoUrl: string;
  brandContactEmail: string;
}) {
  return (
    <header className="report-header" style={styles.reportHeader}>
      <div style={styles.reportBrandBlock}>
        {brandLogoUrl ? (
          <img
            className="report-brand-logo"
            src={brandLogoUrl}
            alt={`${brandName} logo`}
            style={styles.reportBrandLogo}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div>
          <div className="report-brand-name" style={styles.reportBrandName}>
            {brandName}
          </div>
          <div className="report-brand-subtitle" style={styles.reportBrandSubtitle}>
            Powered by LVA Power Planner
            {brandContactEmail ? ` · ${brandContactEmail}` : ""}
          </div>
        </div>
      </div>

      <div>
        <h1 style={styles.reportTitle}>{reportTitle}</h1>
        {projectNumber.trim() && (
          <p style={styles.reportSubtitle}>Project Number: {projectNumber}</p>
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
  );
}

function ReportFooter({
  brandName,
  brandFooter,
  brandContactEmail,
}: {
  brandName: string;
  brandFooter: string;
  brandContactEmail: string;
}) {
  return (
    <footer className="report-footer" style={styles.reportFooter}>
      <span>{brandFooter || `Generated for ${brandName}`}</span>
      <span>{brandContactEmail || "Powered by LVA Power Planner"}</span>
    </footer>
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
  hiddenDistroIds,
  renderChildren = true,
}: {
  summary: DistroLoadSummary;
  plannerState: PlannerState;
  sourceName: string;
  sourceConnection: string;
  sourceRating: number;
  sourceNotes: string;
  openDistroEditor: (distroId: string) => void;
  hiddenDistroIds: string[];
  renderChildren?: boolean;
}) {
  const rows = buildDistroRows(summary, plannerState, hiddenDistroIds);
  const sourceLabel = summary.fedFromOutputLabel
    ? `${sourceName} - ${summary.fedFromOutputLabel}`
    : sourceName;
  const sourceNotesText = summary.fedFromOutputLabel
    ? `Auto source from ${sourceName} output ${summary.fedFromOutputLabel}`
    : sourceNotes;
  const visibleChildren = summary.children.filter(
    (child) => !hiddenDistroIds.includes(child.distro.id)
  );

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
          <col style={{ width: "15%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "8%" }} />
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

      {renderChildren &&
        visibleChildren.map((child) => (
          <DistroReport
            key={child.distro.id}
            summary={child}
            plannerState={plannerState}
            sourceName={displayDistroName(summary.distro)}
            sourceConnection={child.distro.input}
            sourceRating={child.distro.inputA}
            sourceNotes=""
            openDistroEditor={openDistroEditor}
            hiddenDistroIds={hiddenDistroIds}
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
  mutedSmall: {
    color: "#667085",
    fontSize: "13px",
    margin: 0,
  },
  buttonRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button, #000000)",
    background: "var(--lva-workspace-dark-button, #000000)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 500,
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
  sourceToggleList: {
    display: "grid",
    gap: "12px",
  },
  sourceToggleCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "12px",
    background: "#FFFFFF",
  },
  distroToggleList: {
    display: "grid",
    gap: "8px",
    marginTop: "10px",
    paddingLeft: "24px",
  },
  distroToggleItem: {
    display: "grid",
    gap: "6px",
  },
  checkboxLabel: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  hiddenPrintArea: {
    display: "none",
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
    background: "#F5F7FA)",
    marginBottom: "16px",
    display: "grid",
    gridTemplateColumns: "1fr 1.1fr 1.4fr",
    gap: "12px",
    alignItems: "start",
  },
  reportBrandBlock: {
    display: "flex",
    gap: "9px",
    alignItems: "center",
  },
  reportBrandLogo: {
    display: "block",
    width: "auto",
    maxWidth: "150px",
    maxHeight: "42px",
    objectFit: "contain",
  },
  reportBrandName: {
    fontWeight: 500,
    fontSize: "13px",
    color: "#111827",
  },
  reportBrandSubtitle: {
    marginTop: "3px",
    color: "#475467",
    fontSize: "9px",
    lineHeight: 1.25,
  },
  reportTitle: {
    fontSize: "22px",
    marginBottom: "4px",
  },
  reportSubtitle: {
    margin: 0,
    color: "#475467",
    fontWeight: 500,
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
  reportFooter: {
    marginTop: "18px",
    borderTop: "1px solid #cbd5e1",
    paddingTop: "8px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "#475467",
    fontSize: "9px",
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
    fontWeight: 500,
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
