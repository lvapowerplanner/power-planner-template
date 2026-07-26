import { useMemo } from "react";
import { ProtectionEditor } from "@/components/planner/DistroDefinitionBuilder";
import { calculateAdvancedCircuit, displayDistroName, outputDisplayName, outputWatts } from "@/planner/calculations";
import type { PlannerOutput, PlannerState, ProjectDistro, ProtectiveDevice, ResidualCurrentProtection } from "@/planner/types";

type ProtectionTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

type CircuitRow = {
  key: string;
  distro: ProjectDistro;
  output: PlannerOutput;
  parentOutput?: PlannerOutput;
  label: string;
  designCurrentA: number;
};

type SelectivityPair = {
  key: string;
  upstream: ProtectiveDevice;
  downstream: ProtectiveDevice;
  circuits: string[];
};

const commonResidualSettings = [10, 30, 100, 300, 500, 1000, 3000];
const commonDelaySettings = [0, 60, 100, 150, 200, 300, 500, 1000];

function nextSetting(values: number[] | undefined, minimum: number) {
  const choices = values?.length ? [...values].sort((a, b) => a - b) : commonResidualSettings;
  return choices.find((value) => value >= minimum) ?? Math.ceil(minimum);
}

function nextDelay(values: number[] | undefined, minimum: number) {
  const choices = values?.length ? [...values].sort((a, b) => a - b) : commonDelaySettings;
  return choices.find((value) => value >= minimum) ?? Math.ceil(minimum / 50) * 50;
}

function circuitRows(plannerState: PlannerState): CircuitRow[] {
  const settings = plannerState.advancedElectrical;
  return plannerState.distros.flatMap((distro) =>
    distro.outputs.flatMap<CircuitRow>((output, outputIndex) => {
      const children = output.phase === "Socapex" ? output.socaCircuits ?? [] : [output];
      return children
        .filter((circuit) => outputWatts(circuit, plannerState, distro) > 0)
        .map((circuit) => {
          const watts = outputWatts(circuit, plannerState, distro);
          const calculation = calculateAdvancedCircuit({
            connectedWatts: watts,
            phase: circuit.phase,
            diversityPercent: circuit.diversityPercent,
            calculationMethod: settings?.calculationMethod ?? "real-power",
            projectPowerFactor: settings?.defaultPowerFactor ?? 1,
            powerFactorOverride: circuit.powerFactorOverride,
            nominalSinglePhaseVoltage: settings?.nominalSinglePhaseVoltage ?? 230,
            nominalThreePhaseVoltage: settings?.nominalThreePhaseVoltage ?? 400,
          });
          return {
            key: `${distro.id}:${output.id}:${circuit.id}`,
            distro,
            output: circuit,
            parentOutput: output.phase === "Socapex" ? output : undefined,
            label:
              output.phase === "Socapex"
                ? `${outputDisplayName(output, outputIndex)} / ${circuit.label}`
                : outputDisplayName(output, outputIndex),
            designCurrentA: calculation.currentAmps,
          };
        });
    }),
  );
}

function parentOutputForDistro(distro: ProjectDistro, state: PlannerState) {
  const source = state.sources.find((candidate) => candidate.id === distro.sourceId);
  if (!source?.auto || !source.parentDistroId || !source.parentOutputId) return null;
  const parent = state.distros.find((candidate) => candidate.id === source.parentDistroId);
  const output = parent?.outputs.find((candidate) => candidate.id === source.parentOutputId);
  return parent && output ? { parent, output } : null;
}

function protectionPath(row: CircuitRow, state: PlannerState) {
  const devices: ProtectiveDevice[] = [];
  if (row.output.protectiveDevice) devices.push(row.output.protectiveDevice);
  if (row.distro.incomerProtection) devices.push(row.distro.incomerProtection);

  let current = row.distro;
  const visited = new Set<string>();
  while (!visited.has(current.id)) {
    visited.add(current.id);
    const parentLink = parentOutputForDistro(current, state);
    if (!parentLink) break;
    if (parentLink.output.protectiveDevice) devices.push(parentLink.output.protectiveDevice);
    if (parentLink.parent.incomerProtection) devices.push(parentLink.parent.incomerProtection);
    current = parentLink.parent;
  }
  return devices;
}

function selectivityPairs(rows: CircuitRow[], state: PlannerState): SelectivityPair[] {
  const pairs = new Map<string, SelectivityPair>();
  rows.forEach((row) => {
    const residualDevices = protectionPath(row, state).filter(
      (device) => device.residualProtection,
    );
    for (let index = 0; index < residualDevices.length - 1; index += 1) {
      const downstream = residualDevices[index];
      const upstream = residualDevices[index + 1];
      const key = `${upstream.id}:${downstream.id}`;
      const circuit = `${displayDistroName(row.distro)} / ${row.label}`;
      const existing = pairs.get(key);
      pairs.set(key, existing
        ? { ...existing, circuits: [...new Set([...existing.circuits, circuit])] }
        : { key, upstream, downstream, circuits: [circuit] });
    }
  });
  return [...pairs.values()];
}

function deviceLabel(device: ProtectiveDevice | undefined) {
  if (!device) return "Not configured";
  return `${device.deviceType.toUpperCase()} ${device.ratedCurrentA}A${device.curve ? ` ${device.curve}` : ""}`;
}

function residualLabel(device: ProtectiveDevice) {
  const residual = device.residualProtection;
  if (!residual) return "No residual-current function";
  return `${residual.residualCurrentMa}mA / ${residual.timeDelayMs}ms · Type ${residual.rcdType}`;
}

function adjustedCableCapacity(output: PlannerOutput) {
  const design = output.cableDesign;
  if (!design) return null;
  return design.snapshot.currentCapacityA * Math.max(1, design.parallelRuns) * Math.max(0.01, design.deratingFactor);
}

function coordinationResult(row: CircuitRow) {
  const device = row.output.protectiveDevice;
  const capacity = adjustedCableCapacity(row.output);
  if (!device) return { status: "Incomplete", detail: "Output protection is not configured." };
  if (device.deviceType === "rcd") return { status: "Incomplete", detail: "RCD has no overcurrent function; assess its upstream protective device." };
  if (capacity === null) return { status: "Incomplete", detail: "Select and configure the circuit cable." };
  if (row.designCurrentA > device.ratedCurrentA) return { status: "Conflict", detail: "Design current exceeds the protective-device rating." };
  if (device.ratedCurrentA > capacity) return { status: "Conflict", detail: "Protective-device rating exceeds adjusted cable capacity." };
  return { status: "Indicative", detail: "Ib ≤ In ≤ Iz. Device characteristics and fault protection remain to be verified." };
}

function pairAssessment(pair: SelectivityPair) {
  const upstream = pair.upstream.residualProtection!;
  const downstream = pair.downstream.residualProtection!;
  const suggestedResidualMa = nextSetting(
    upstream.availableResidualSettingsMa,
    downstream.residualCurrentMa * 3,
  );
  const suggestedDelayMs = nextDelay(
    upstream.availableDelaySettingsMs,
    downstream.timeDelayMs + 100,
  );
  const currentRatioOkay = upstream.residualCurrentMa >= downstream.residualCurrentMa * 3;
  const delayOkay = upstream.delayMode !== "instantaneous" && upstream.timeDelayMs > downstream.timeDelayMs;
  const typeConflict = upstream.rcdType === "AC" && downstream.rcdType !== "AC";
  return {
    status: currentRatioOkay && delayOkay && !typeConflict ? "Indicative" : "Conflict",
    suggestedResidualMa,
    suggestedDelayMs,
    typeConflict,
    canApply:
      (upstream.settingMode === "adjustable" && upstream.residualCurrentMa !== suggestedResidualMa) ||
      (upstream.delayMode === "adjustable-delay" && upstream.timeDelayMs !== suggestedDelayMs),
  };
}

export function ProtectionTab({ plannerState, setPlannerState }: ProtectionTabProps) {
  const rows = useMemo(() => circuitRows(plannerState), [plannerState]);
  const pairs = useMemo(() => selectivityPairs(rows, plannerState), [rows, plannerState]);

  function updateDevice(deviceId: string, residual: ResidualCurrentProtection) {
    const patch = (device: ProtectiveDevice | undefined) =>
      device?.id === deviceId ? { ...device, residualProtection: residual } : device;
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) => ({
        ...distro,
        incomerProtection: patch(distro.incomerProtection),
        outputs: distro.outputs.map((output) => ({
          ...output,
          protectiveDevice: patch(output.protectiveDevice),
          socaCircuits: output.socaCircuits?.map((socket) => ({
            ...socket,
            protectiveDevice: patch(socket.protectiveDevice),
          })),
        })),
      })),
    });
  }

  function updateIncomerProtection(
    distroId: string,
    protectiveDevice: ProtectiveDevice | undefined,
  ) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId
          ? { ...distro, incomerProtection: protectiveDevice }
          : distro,
      ),
    });
  }

  function updateCircuitProtection(
    row: CircuitRow,
    protectiveDevice: ProtectiveDevice | undefined,
  ) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) => {
        if (distro.id !== row.distro.id) return distro;

        return {
          ...distro,
          outputs: distro.outputs.map((output) => {
            if (!row.parentOutput) {
              return output.id === row.output.id
                ? { ...output, protectiveDevice }
                : output;
            }

            const sameTwin = Boolean(
              row.parentOutput.breakerPair &&
                output.breakerPair === row.parentOutput.breakerPair,
            );
            if (output.id !== row.parentOutput.id && !sameTwin) return output;

            return {
              ...output,
              socaCircuits: output.socaCircuits?.map((socket) =>
                socket.circuitNo === row.output.circuitNo
                  ? { ...socket, protectiveDevice }
                  : socket,
              ),
            };
          }),
        };
      }),
    });
  }

  function applySuggestion(pair: SelectivityPair) {
    const assessment = pairAssessment(pair);
    const current = pair.upstream.residualProtection!;
    updateDevice(pair.upstream.id, {
      ...current,
      residualCurrentMa:
        current.settingMode === "adjustable" ? assessment.suggestedResidualMa : current.residualCurrentMa,
      timeDelayMs:
        current.delayMode === "adjustable-delay" ? assessment.suggestedDelayMs : current.timeDelayMs,
    });
  }

  return (
    <section style={styles.page}>
      <div>
        <h3 style={styles.title}>Protection</h3>
        <p style={styles.muted}>Design coordination from the protective devices stored in each distro. Results are indicative unless confirmed by exact manufacturer data.</p>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summary}><span>Populated circuits</span><strong>{rows.length}</strong></div>
        <div style={styles.summary}><span>RCD selectivity pairs</span><strong>{pairs.length}</strong></div>
        <div style={styles.summary}><span>Protection conflicts</span><strong>{rows.filter((row) => coordinationResult(row).status === "Conflict").length + pairs.filter((pair) => pairAssessment(pair).status === "Conflict").length}</strong></div>
      </div>

      <section style={styles.card}>
        <h4 style={styles.cardTitle}>Distro incomer protection</h4>
        <p style={styles.sectionHelp}>
          Library protection is copied into the project when a distro is
          added. Configure or amend this project’s incomer records here.
        </p>
        <div style={styles.incomerGrid}>
          {plannerState.distros.map((distro) => (
            <div key={distro.id} style={styles.incomerCard}>
              <strong>{displayDistroName(distro)}</strong>
              <small style={styles.small}>Input {distro.input}</small>
              <ProtectionEditor
                label="Incomer protection"
                device={distro.incomerProtection}
                defaultRating={distro.inputA}
                defaultPoles={distro.input.includes("/ 3") ? 3 : 1}
                onChange={(device) =>
                  updateIncomerProtection(distro.id, device)
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h4 style={styles.cardTitle}>Circuit protection coordination</h4>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Circuit</th><th style={styles.th}>Device</th><th style={styles.th}>Ib</th><th style={styles.th}>In</th><th style={styles.th}>Iz</th><th style={styles.th}>Result</th></tr></thead>
            <tbody>{rows.map((row) => {
              const device = row.output.protectiveDevice;
              const capacity = adjustedCableCapacity(row.output);
              const result = coordinationResult(row);
              return <tr key={row.key}><td style={styles.td}><strong>{displayDistroName(row.distro)}</strong><small style={styles.small}>{row.label}</small></td><td style={styles.deviceTd}>{device && <span>{deviceLabel(device)}</span>}<ProtectionEditor label="Circuit protection" device={device} defaultRating={row.output.rating} defaultPoles={row.output.phase === "3Φ" ? 3 : 1} onChange={(nextDevice) => updateCircuitProtection(row, nextDevice)} /></td><td style={styles.td}>{row.designCurrentA.toFixed(2)}A</td><td style={styles.td}>{device && device.deviceType !== "rcd" ? `${device.ratedCurrentA}A` : "—"}</td><td style={styles.td}>{capacity === null ? "—" : `${capacity.toFixed(2)}A`}</td><td style={styles.td}><span style={result.status === "Conflict" ? styles.conflict : result.status === "Indicative" ? styles.indicative : styles.incomplete}>{result.status}</span><small style={styles.small}>{result.detail}</small></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <section style={styles.card}>
        <h4 style={styles.cardTitle}>Residual-current selectivity</h4>
        {pairs.length === 0 ? <p style={styles.muted}>No series-connected RCD pairs were found on populated circuit paths.</p> : (
          <div style={styles.tableWrap}><table style={{ ...styles.table, minWidth: "1100px" }}><thead><tr><th style={styles.th}>Protected circuits</th><th style={styles.th}>Downstream</th><th style={styles.th}>Upstream</th><th style={styles.th}>Suggested upstream</th><th style={styles.th}>Assessment</th><th style={styles.th}>Action</th></tr></thead><tbody>
            {pairs.map((pair) => {
              const assessment = pairAssessment(pair);
              return <tr key={pair.key}><td style={styles.td}>{pair.circuits.slice(0, 2).map((circuit) => <small key={circuit} style={styles.small}>{circuit}</small>)}{pair.circuits.length > 2 && <small style={styles.small}>+ {pair.circuits.length - 2} more</small>}</td><td style={styles.td}><strong>{deviceLabel(pair.downstream)}</strong><small style={styles.small}>{residualLabel(pair.downstream)}</small></td><td style={styles.td}><strong>{deviceLabel(pair.upstream)}</strong><small style={styles.small}>{residualLabel(pair.upstream)}</small></td><td style={styles.td}>{assessment.suggestedResidualMa}mA / {assessment.suggestedDelayMs}ms<small style={styles.small}>Generic 3:1 sensitivity and time-grading screen</small></td><td style={styles.td}><span style={assessment.status === "Conflict" ? styles.conflict : styles.indicative}>{assessment.status}</span><small style={styles.small}>{assessment.typeConflict ? "Upstream Type AC is incompatible with the downstream RCD hierarchy." : assessment.status === "Indicative" ? "Generic settings are graded; confirm manufacturer coordination." : "Current sensitivity or delay is not adequately graded."}</small></td><td style={styles.td}><button style={styles.button} disabled={!assessment.canApply} onClick={() => applySuggestion(pair)}>{assessment.canApply ? "Apply suggestion" : "No adjustable change"}</button></td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>

      <p style={styles.disclaimer}>Suggestions are design aids only. Required disconnection times, fault-loop impedance, prospective fault current, RCD type, device operating curves and manufacturer selectivity data must still be verified by a competent designer.</p>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: "16px" }, title: { margin: 0 }, muted: { margin: "6px 0 0", color: "#637083" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }, summary: { display: "grid", gap: "4px", padding: "14px", border: "1px solid #dce5ec", borderRadius: "12px", background: "#f8fafc" },
  card: { border: "1px solid #dce5ec", borderRadius: "14px", background: "white", overflow: "hidden" }, cardTitle: { margin: 0, padding: "14px 16px", background: "#f8fafc", borderBottom: "1px solid #dce5ec" },
  sectionHelp: { margin: 0, padding: "12px 16px 0", color: "#637083", fontSize: "13px" },
  incomerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px", padding: "16px" },
  incomerCard: { display: "grid", gap: "8px", padding: "12px", border: "1px solid #dce5ec", borderRadius: "12px", background: "#f8fafc" },
  tableWrap: { overflowX: "auto" }, table: { width: "100%", minWidth: "900px", borderCollapse: "collapse", fontSize: "13px" }, th: { padding: "10px", borderBottom: "1px solid #dce5ec", textAlign: "left", color: "#526071", whiteSpace: "nowrap" }, td: { padding: "10px", borderBottom: "1px solid #eef2f6", textAlign: "left", verticalAlign: "top" }, small: { display: "block", marginTop: "4px", color: "#637083", lineHeight: 1.35 },
  deviceTd: { width: "390px", padding: "10px", borderBottom: "1px solid #eef2f6", textAlign: "left", verticalAlign: "top" },
  indicative: { display: "inline-block", padding: "3px 7px", borderRadius: "999px", background: "#ecfdf3", color: "#027a48" }, conflict: { display: "inline-block", padding: "3px 7px", borderRadius: "999px", background: "#fff1f1", color: "#c53030" }, incomplete: { display: "inline-block", padding: "3px 7px", borderRadius: "999px", background: "#fff7e6", color: "#92400e" },
  button: { minHeight: "36px", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: "9px", background: "white", cursor: "pointer" }, disclaimer: { margin: 0, color: "#637083", fontSize: "12px" },
};
