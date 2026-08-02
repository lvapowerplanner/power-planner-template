import {
  advancedDistroLoadMetrics,
  advancedOutputCalculationForLink,
  calculateAdvancedCircuit,
  calculateCableDesign,
  displayDistroName,
  isThreePhaseConnection,
  outputDisplayName,
  outputWatts,
} from "@/planner/calculations";
import type {
  CircuitCableDesign,
  PlannerOutput,
  PlannerState,
  ProjectDistro,
  ProtectiveDevice,
} from "@/planner/types";

export type AdvancedExportSection = "load-demand" | "cables" | "protection";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value: number, decimals = 2) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "-";
}

function circuitOutputs(distro: ProjectDistro) {
  return distro.outputs.flatMap((output, outputIndex) =>
    output.phase === "Socapex"
      ? (output.socaCircuits ?? []).map((circuit) => ({
          output: circuit,
          label: `${outputDisplayName(output, outputIndex)} / ${circuit.label}`,
        }))
      : [{ output, label: outputDisplayName(output, outputIndex) }],
  );
}

function calculationForOutput(
  output: PlannerOutput,
  distro: ProjectDistro,
  state: PlannerState,
) {
  if (output.phase !== "Socapex") {
    return advancedOutputCalculationForLink(output, distro, state);
  }
  const settings = state.advancedElectrical;
  return calculateAdvancedCircuit({
    connectedWatts: outputWatts(output, state, distro),
    phase: output.phase,
    diversityPercent: output.diversityPercent,
    calculationMethod: settings?.calculationMethod ?? "real-power",
    projectPowerFactor: settings?.defaultPowerFactor ?? 1,
    powerFactorOverride: output.powerFactorOverride,
    nominalSinglePhaseVoltage: settings?.nominalSinglePhaseVoltage ?? 230,
    nominalThreePhaseVoltage: settings?.nominalThreePhaseVoltage ?? 400,
  });
}

function loadDemandSection(distros: ProjectDistro[], state: PlannerState) {
  return `
    <section class="export-section">
      <h2>Load &amp; Demand</h2>
      ${distros
        .map((distro) => {
          const rows = circuitOutputs(distro);
          return `
            <article>
              <h3>${escapeHtml(displayDistroName(distro))}</h3>
              <table>
                <thead><tr><th>Circuit</th><th>Phase</th><th>Connected load</th><th>Diversity</th><th>Design load</th><th>Power factor</th><th>Apparent load</th><th>Current</th></tr></thead>
                <tbody>
                  ${rows
                    .map(({ output, label }) => {
                      const result = calculationForOutput(output, distro, state);
                      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(output.phase)}</td><td>${formatNumber(result.connectedWatts / 1000)} kW</td><td>${formatNumber(result.diversityPercent, 0)}%</td><td>${formatNumber(result.diversifiedWatts / 1000)} kW</td><td>${formatNumber(result.powerFactor)}</td><td>${formatNumber(result.apparentVa / 1000)} kVA</td><td>${formatNumber(result.currentAmps)} A</td></tr>`;
                    })
                    .join("")}
                </tbody>
              </table>
            </article>`;
        })
        .join("")}
    </section>`;
}

function cableResult(
  design: CircuitCableDesign | undefined,
  currentA: number,
  voltage: number,
) {
  return calculateCableDesign({
    cableDesign: design,
    designCurrentA: currentA,
    nominalVoltageV: voltage,
  });
}

function cableRow(
  label: string,
  phase: string,
  currentA: number,
  design: CircuitCableDesign | undefined,
  voltage: number,
) {
  const result = cableResult(design, currentA, voltage);
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(phase)}</td><td>${formatNumber(currentA)} A</td><td>${escapeHtml(design?.snapshot.cableName ?? "Not configured")}</td><td>${design ? `${formatNumber(design.lengthMetres, 0)} m` : "-"}</td><td>${design ? formatNumber(design.parallelRuns, 0) : "-"}</td><td>${result ? `${formatNumber(result.adjustedCapacityA)} A` : "-"}</td><td>${result ? `${formatNumber(result.utilisationPercent)}%` : "-"}</td><td>${result ? `${formatNumber(result.sectionVoltageDropV)} V / ${formatNumber(result.sectionVoltageDropPercent)}%` : "-"}</td><td>${escapeHtml(result?.status ?? "Incomplete")}</td></tr>`;
}

function cableSection(distros: ProjectDistro[], state: PlannerState) {
  const singleVoltage = state.advancedElectrical?.nominalSinglePhaseVoltage ?? 230;
  const threeVoltage = state.advancedElectrical?.nominalThreePhaseVoltage ?? 400;
  return `
    <section class="export-section">
      <h2>Cable Design</h2>
      ${distros
        .map((distro) => {
          const metrics = advancedDistroLoadMetrics(distro, state);
          const inboundThreePhase = isThreePhaseConnection(distro.input);
          const inboundCurrent = inboundThreePhase
            ? metrics.apparentVa / (Math.sqrt(3) * threeVoltage)
            : metrics.apparentVa / singleVoltage;
          const source = state.sources.find(
            (candidate) => candidate.id === distro.sourceId,
          );
          let inbound = "";
          if (source && !source.auto) {
            inbound = cableRow(
                "Inbound supply",
                inboundThreePhase ? "3Φ" : "L1",
                inboundCurrent,
                distro.inboundCableDesign,
                inboundThreePhase ? threeVoltage : singleVoltage,
              );
          } else if (
            source?.auto &&
            source.parentDistroId &&
            source.parentOutputId
          ) {
            const parentDistro = state.distros.find(
              (candidate) => candidate.id === source.parentDistroId,
            );
            const parentOutput = parentDistro?.outputs.find(
              (candidate) => candidate.id === source.parentOutputId,
            );
            if (parentDistro && parentOutput) {
              const calculation = calculationForOutput(
                parentOutput,
                parentDistro,
                state,
              );
              inbound = cableRow(
                `Inbound supply (configured on ${displayDistroName(parentDistro)})`,
                parentOutput.phase,
                calculation.currentAmps,
                parentOutput.cableDesign,
                parentOutput.phase === "3Φ" ? threeVoltage : singleVoltage,
              );
            }
          }
          const rows = circuitOutputs(distro)
            .map(({ output, label }) => {
              const calculation = calculationForOutput(output, distro, state);
              const voltage = output.phase === "3Φ" ? threeVoltage : singleVoltage;
              return cableRow(
                label,
                output.phase,
                calculation.currentAmps,
                output.cableDesign,
                voltage,
              );
            })
            .join("");
          return `<article><h3>${escapeHtml(displayDistroName(distro))}</h3><table><thead><tr><th>Circuit</th><th>Phase</th><th>Design current</th><th>Cable</th><th>Length</th><th>Runs</th><th>Adjusted capacity</th><th>Utilisation</th><th>Section drop</th><th>Status</th></tr></thead><tbody>${inbound}${rows}</tbody></table></article>`;
        })
        .join("")}
    </section>`;
}

function deviceDescription(device?: ProtectiveDevice) {
  if (!device) return "Not configured";
  return `${device.deviceType.toUpperCase()} ${device.ratedCurrentA}A${device.curve ? ` ${device.curve}` : ""}`;
}

function residualDescription(device?: ProtectiveDevice) {
  const residual = device?.residualProtection;
  if (!residual) return "No residual-current function";
  return `${residual.residualCurrentMa}mA / ${residual.timeDelayMs}ms · Type ${residual.rcdType}`;
}

function protectionSection(distros: ProjectDistro[], state: PlannerState) {
  return `
    <section class="export-section">
      <h2>Protection</h2>
      ${distros
        .map((distro) => {
          const incomer = `<tr><td>Incomer</td><td>-</td><td>-</td><td>${escapeHtml(deviceDescription(distro.incomerProtection))}</td><td>${escapeHtml(residualDescription(distro.incomerProtection))}</td><td>${distro.incomerProtection ? "Configured" : "Incomplete"}</td></tr>`;
          const rows = circuitOutputs(distro)
            .map(({ output, label }) => {
              const calculation = calculationForOutput(output, distro, state);
              const capacity = output.cableDesign
                ? output.cableDesign.snapshot.currentCapacityA *
                  Math.max(1, output.cableDesign.parallelRuns) *
                  Math.max(0.01, output.cableDesign.deratingFactor)
                : null;
              const status = !output.protectiveDevice
                ? "Incomplete"
                : output.protectiveDevice.deviceType === "rcd"
                  ? "Review"
                  : capacity == null
                    ? "Incomplete"
                    : calculation.currentAmps <= output.protectiveDevice.ratedCurrentA &&
                        output.protectiveDevice.ratedCurrentA <= capacity
                      ? "Indicative"
                      : "Conflict";
              return `<tr><td>${escapeHtml(label)}</td><td>${formatNumber(calculation.currentAmps)} A</td><td>${capacity == null ? "-" : `${formatNumber(capacity)} A`}</td><td>${escapeHtml(deviceDescription(output.protectiveDevice))}</td><td>${escapeHtml(residualDescription(output.protectiveDevice))}</td><td>${status}</td></tr>`;
            })
            .join("");
          return `<article><h3>${escapeHtml(displayDistroName(distro))}</h3><table><thead><tr><th>Circuit</th><th>Design current</th><th>Cable capacity</th><th>Protective device</th><th>Residual protection</th><th>Status</th></tr></thead><tbody>${incomer}${rows}</tbody></table></article>`;
        })
        .join("")}
    </section>`;
}

export function buildAdvancedExportHtml(
  plannerState: PlannerState,
  sections: AdvancedExportSection[],
  distroIds: string[],
) {
  const distros = plannerState.distros.filter((distro) =>
    distroIds.includes(distro.id),
  );
  const projectName =
    plannerState.projectInfo?.projectName?.trim() ||
    plannerState.systemName?.trim() ||
    "Advanced Calculations";
  const content = [
    sections.includes("load-demand") ? loadDemandSection(distros, plannerState) : "",
    sections.includes("cables") ? cableSection(distros, plannerState) : "",
    sections.includes("protection") ? protectionSection(distros, plannerState) : "",
  ].join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(projectName)} - Advanced Calculations</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; font-size: 9px; }
    header { padding-bottom: 10px; border-bottom: 2px solid #111827; margin-bottom: 14px; }
    h1 { margin: 0 0 4px; font-size: 20px; } h2 { margin: 0 0 10px; font-size: 16px; } h3 { margin: 12px 0 6px; font-size: 12px; }
    p { margin: 0; color: #475467; }
    .export-section { break-before: page; } .export-section:first-of-type { break-before: auto; }
    article { break-inside: avoid; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #CBD5E1; padding: 5px; text-align: left; vertical-align: top; }
    th { background: #E9EEF3; font-weight: 600; }
    tbody tr:nth-child(even) { background: #F8FAFC; }
  </style></head><body><header><h1>${escapeHtml(projectName)}</h1><p>Advanced calculation report · Exported ${escapeHtml(new Date().toLocaleString())}</p></header>${content}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));</script></body></html>`;
}
