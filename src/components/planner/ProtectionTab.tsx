import { useMemo } from "react";
import { ProtectionEditor } from "@/components/planner/DistroDefinitionBuilder";
import { advancedOutputCalculationForLink, calculateAdvancedCircuit, childDistroFedFromOutput, displayDistroName, outputDisplayName, outputWatts } from "@/planner/calculations";
import type { FaultProtectionData, PlannerOutput, PlannerState, ProjectDistro, ProtectiveDevice, ResidualCurrentProtection } from "@/planner/types";

type ProtectionTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  selectedDistroId: string;
  setSelectedDistroId: (value: string) => void;
  showUnusedOutputs: boolean;
  setShowUnusedOutputs: (value: boolean) => void;
  collapsedDistroIds: string[];
  setCollapsedDistroIds: React.Dispatch<React.SetStateAction<string[]>>;
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
      return children.map((circuit) => {
          const watts = outputWatts(circuit, plannerState, distro);
          const child = childDistroFedFromOutput(plannerState, distro.id, circuit.id);
          const calculation = child
            ? advancedOutputCalculationForLink(circuit, distro, plannerState)
            : calculateAdvancedCircuit({
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

function circuitInformation(row: CircuitRow) {
  const details = row.output.items.map((item) =>
    `${item.quantity} × ${item.name}${item.notes?.trim() ? ` — ${item.notes.trim()}` : ""}`,
  );
  if (row.output.notes?.trim()) details.push(`Output notes: ${row.output.notes.trim()}`);
  if (row.parentOutput?.notes?.trim()) details.push(`Socapex notes: ${row.parentOutput.notes.trim()}`);
  return details.length ? details.join("\n") : "No connected-load or output notes.";
}

function adjustedCableCapacity(output: PlannerOutput) {
  const design = output.cableDesign;
  if (!design) return null;
  return design.snapshot.currentCapacityA * Math.max(1, design.parallelRuns) * Math.max(0.01, design.deratingFactor);
}

type CheckResult = {
  status: "Pass" | "Conflict" | "Needs data" | "Review";
  detail: string;
};

function sourceForDistro(distro: ProjectDistro, state: PlannerState) {
  return state.sources.find((source) => source.id === distro.sourceId);
}

function effectiveDistroFaultCurrent(
  distro: ProjectDistro,
  state: PlannerState,
  visited = new Set<string>(),
): { value?: number; label: string } {
  if (distro.incomerFaultProtection?.prospectiveFaultCurrentKa) {
    return { value: distro.incomerFaultProtection.prospectiveFaultCurrentKa, label: "Distro incomer override" };
  }
  if (visited.has(distro.id)) return { label: "No fault-current data" };
  visited.add(distro.id);

  const source = sourceForDistro(distro, state);
  if (!source) return { label: "No assigned supply" };
  if (source.faultProtection?.prospectiveFaultCurrentKa) {
    return { value: source.faultProtection.prospectiveFaultCurrentKa, label: `${source.name} supply value` };
  }
  if (source.auto && source.parentDistroId && source.parentOutputId) {
    const parent = state.distros.find((candidate) => candidate.id === source.parentDistroId);
    const parentOutput = parent?.outputs.find((candidate) => candidate.id === source.parentOutputId);
    if (parentOutput?.faultProtection?.prospectiveFaultCurrentKa) {
      return { value: parentOutput.faultProtection.prospectiveFaultCurrentKa, label: `${displayDistroName(parent!)} output override` };
    }
    if (parent) {
      const inherited = effectiveDistroFaultCurrent(parent, state, visited);
      return inherited.value
        ? { ...inherited, label: `Inherited via ${displayDistroName(parent)}` }
        : inherited;
    }
  }
  return { label: `${source.name} has no fault-current data` };
}

function effectiveCircuitFaultCurrent(row: CircuitRow, state: PlannerState) {
  const ownValue = row.output.faultProtection?.prospectiveFaultCurrentKa;
  if (ownValue) return { value: ownValue, label: "Circuit override" };
  return effectiveDistroFaultCurrent(row.distro, state);
}

function overloadResult(row: CircuitRow): CheckResult {
  const device = row.output.protectiveDevice;
  const capacity = adjustedCableCapacity(row.output);
  if (!device) return { status: "Needs data", detail: "Output protection is not configured." };
  if (device.deviceType === "rcd") return { status: "Review", detail: "RCD has no overcurrent function; assess its upstream protective device." };
  if (capacity === null) return { status: "Needs data", detail: "Select and configure the circuit cable." };
  if (row.designCurrentA > device.ratedCurrentA) return { status: "Conflict", detail: "Design current exceeds the protective-device rating." };
  if (device.ratedCurrentA > capacity) return { status: "Conflict", detail: "Protective-device rating exceeds adjusted cable capacity." };
  return { status: "Pass", detail: "Ib ≤ In ≤ Iz." };
}

function breakingCapacityResult(row: CircuitRow, state: PlannerState): CheckResult {
  const device = row.output.protectiveDevice;
  if (!device) return { status: "Needs data", detail: "Configure the circuit protective device." };
  if (device.deviceType === "rcd") return { status: "Review", detail: "Assess the breaking capacity of the associated upstream overcurrent device." };
  const faultCurrent = effectiveCircuitFaultCurrent(row, state).value;
  if (!faultCurrent) return { status: "Needs data", detail: "Enter prospective fault current at the supply, incomer or circuit." };
  if (!device.breakingCapacityKa) return { status: "Needs data", detail: "Enter the device breaking capacity." };
  if (device.breakingCapacityKa < faultCurrent) {
    return { status: "Conflict", detail: `${device.breakingCapacityKa}kA device rating is below ${faultCurrent}kA prospective fault current.` };
  }
  return { status: "Pass", detail: `${device.breakingCapacityKa}kA device rating is not below the entered ${faultCurrent}kA fault current.` };
}

function disconnectionResult(row: CircuitRow): CheckResult {
  const data = row.output.faultProtection;
  if (!row.output.protectiveDevice) return { status: "Needs data", detail: "Configure the circuit protective device." };
  if (!data?.earthFaultLoopImpedanceOhms) return { status: "Needs data", detail: "Enter the estimated design Zs." };
  if (!data.maximumPermittedZsOhms) return { status: "Needs data", detail: "Enter maximum permitted Zs and its source." };
  if (!data.maximumZsSource?.trim()) return { status: "Review", detail: "Record the source of the maximum permitted Zs." };
  if (data.earthFaultLoopImpedanceOhms > data.maximumPermittedZsOhms) {
    return { status: "Conflict", detail: `Entered Zs ${data.earthFaultLoopImpedanceOhms}Ω exceeds maximum ${data.maximumPermittedZsOhms}Ω.` };
  }
  return {
    status: "Review",
    detail: "Estimated design Zs does not exceed the entered maximum. Confirm the calculation basis and device characteristic.",
  };
}

function statusStyle(status: CheckResult["status"]) {
  if (status === "Conflict") return styles.conflict;
  if (status === "Pass") return styles.pass;
  if (status === "Review") return styles.review;
  return styles.incomplete;
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
  const residualSettingAvailable =
    !upstream.availableResidualSettingsMa?.length ||
    upstream.availableResidualSettingsMa.includes(upstream.residualCurrentMa);
  const delaySettingAvailable =
    !upstream.availableDelaySettingsMs?.length ||
    upstream.availableDelaySettingsMs.includes(upstream.timeDelayMs);
  const settingsKnown = Boolean(
    upstream.availableResidualSettingsMa?.length &&
      upstream.availableDelaySettingsMs?.length,
  );
  const conflict =
    !currentRatioOkay ||
    !delayOkay ||
    typeConflict ||
    !residualSettingAvailable ||
    !delaySettingAvailable;
  return {
    status: conflict ? "Conflict" : settingsKnown ? "Coordinated" : "Indicative",
    suggestedResidualMa,
    suggestedDelayMs,
    typeConflict,
    currentRatioOkay,
    delayOkay,
    residualSettingAvailable,
    delaySettingAvailable,
    settingsKnown,
    canApply:
      (upstream.settingMode === "adjustable" && upstream.residualCurrentMa !== suggestedResidualMa) ||
      (upstream.delayMode === "adjustable-delay" && upstream.timeDelayMs !== suggestedDelayMs),
  };
}

function assessmentDetail(assessment: ReturnType<typeof pairAssessment>) {
  const issues: string[] = [];
  if (!assessment.currentRatioOkay) issues.push("Residual-current sensitivity is below the generic 3:1 grading screen.");
  if (!assessment.delayOkay) issues.push("The upstream delay is not greater than the downstream delay.");
  if (assessment.typeConflict) issues.push("Upstream Type AC requires review against the downstream RCD type.");
  if (!assessment.residualSettingAvailable) issues.push("Selected residual-current value is outside the declared device settings.");
  if (!assessment.delaySettingAvailable) issues.push("Selected delay is outside the declared device settings.");
  if (issues.length) return issues.join(" ");
  return assessment.settingsKnown
    ? "Selected settings pass the generic grading screen and match the declared device settings. Confirm manufacturer coordination data."
    : "Selected settings pass the generic grading screen. Available device settings or manufacturer coordination data are incomplete.";
}

export function ProtectionTab({ plannerState, setPlannerState, selectedDistroId, setSelectedDistroId, showUnusedOutputs, setShowUnusedOutputs, collapsedDistroIds, setCollapsedDistroIds }: ProtectionTabProps) {
  const allRows = useMemo(() => circuitRows(plannerState), [plannerState]);
  const visibleDistros = plannerState.distros.filter(
    (distro) => selectedDistroId === "all" || distro.id === selectedDistroId,
  );
  const rows = allRows.filter(
    (row) =>
      (showUnusedOutputs || outputWatts(row.output, plannerState, row.distro) > 0) &&
      (selectedDistroId === "all" || row.distro.id === selectedDistroId) &&
      !collapsedDistroIds.includes(row.distro.id),
  );
  const pairs = useMemo(() => selectivityPairs(rows, plannerState), [rows, plannerState]);

  function updateSourceFaultProtection(
    sourceId: string,
    patch: Partial<FaultProtectionData>,
  ) {
    setPlannerState({
      ...plannerState,
      sources: plannerState.sources.map((source) =>
        source.id === sourceId
          ? { ...source, faultProtection: { ...source.faultProtection, ...patch } }
          : source,
      ),
    });
  }

  function updateIncomerFaultProtection(
    distroId: string,
    patch: Partial<FaultProtectionData>,
  ) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId
          ? { ...distro, incomerFaultProtection: { ...distro.incomerFaultProtection, ...patch } }
          : distro,
      ),
    });
  }

  function updateCircuitFaultProtection(
    row: CircuitRow,
    patch: Partial<FaultProtectionData>,
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
                ? { ...output, faultProtection: { ...output.faultProtection, ...patch } }
                : output;
            }
            if (output.id !== row.parentOutput.id) return output;
            return {
              ...output,
              socaCircuits: output.socaCircuits?.map((circuit) =>
                circuit.id === row.output.id
                  ? { ...circuit, faultProtection: { ...circuit.faultProtection, ...patch } }
                  : circuit,
              ),
            };
          }),
        };
      }),
    });
  }

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
      coordinationOverride: {
        residualCurrentOverridden: false,
        timeDelayOverridden: false,
        reason: undefined,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function overrideSetting(
    pair: SelectivityPair,
    field: "residualCurrentMa" | "timeDelayMs",
    value: number,
  ) {
    const current = pair.upstream.residualProtection!;
    updateDevice(pair.upstream.id, {
      ...current,
      [field]: Math.max(0, value),
      coordinationOverride: {
        ...current.coordinationOverride,
        residualCurrentOverridden:
          field === "residualCurrentMa"
            ? true
            : current.coordinationOverride?.residualCurrentOverridden,
        timeDelayOverridden:
          field === "timeDelayMs"
            ? true
            : current.coordinationOverride?.timeDelayOverridden,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function updateOverrideReason(pair: SelectivityPair, reason: string) {
    const current = pair.upstream.residualProtection!;
    updateDevice(pair.upstream.id, {
      ...current,
      coordinationOverride: {
        ...current.coordinationOverride,
        reason,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return (
    <section style={styles.page}>
      <div>
        <h3 style={styles.title}>Protection</h3>
        <p style={styles.muted}>Design coordination from the protective devices stored in each distro. Results are indicative unless confirmed by exact manufacturer data.</p>
      </div>

      <div style={styles.toolbar}>
        <label style={styles.compactField}><span style={styles.toolbarLabel}>View</span>
          <select style={styles.filterInput} value={selectedDistroId} onChange={(event) => setSelectedDistroId(event.target.value)}>
            <option value="all">All distros</option>
            {plannerState.distros.map((distro) => <option key={distro.id} value={distro.id}>{displayDistroName(distro)}</option>)}
          </select>
        </label>
        <label style={styles.checkboxLabel}><input type="checkbox" checked={showUnusedOutputs} onChange={(event) => setShowUnusedOutputs(event.target.checked)} />Show unused outputs</label>
        <button style={styles.textButton} onClick={() => setCollapsedDistroIds([])}>Expand all</button>
        <button style={styles.textButton} onClick={() => setCollapsedDistroIds(visibleDistros.map((distro) => distro.id))}>Collapse all</button>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summary}><span>Populated circuits</span><strong>{rows.length}</strong></div>
        <div style={styles.summary}><span>RCD selectivity pairs</span><strong>{pairs.length}</strong></div>
        <div style={styles.summary}><span>Protection conflicts</span><strong>{rows.filter((row) => [overloadResult(row), breakingCapacityResult(row, plannerState), disconnectionResult(row)].some((result) => result.status === "Conflict")).length + pairs.filter((pair) => pairAssessment(pair).status === "Conflict").length}</strong></div>
      </div>

      {visibleDistros.map((distro) => {
        const collapsed = collapsedDistroIds.includes(distro.id);
        const distroRows = rows.filter((row) => row.distro.id === distro.id);
        const source = sourceForDistro(distro, plannerState);
        const inheritedFaultCurrent = effectiveDistroFaultCurrent(distro, plannerState);
        return (
          <article key={distro.id} style={styles.card}>
            <button style={styles.distroHeader} onClick={() => setCollapsedDistroIds((current) => collapsed ? current.filter((id) => id !== distro.id) : [...current, distro.id])}>
              <strong>{displayDistroName(distro)}</strong><span>{collapsed ? "Expand" : "Collapse"}</span>
            </button>
            {!collapsed && (
              <>
                <div style={styles.incomerCard}>
                  <small style={styles.small}>Input {distro.input}</small>
                  <ProtectionEditor label="Incomer protection" device={distro.incomerProtection} defaultRating={distro.inputA} defaultPoles={distro.input.includes("/ 3") ? 3 : 1} onChange={(device) => updateIncomerProtection(distro.id, device)} />
                  <div style={styles.faultGrid}>
                    {source && !source.auto && (
                      <label style={styles.settingLabel}>
                        {source.name} prospective fault current
                        <span style={styles.inputWithUnit}>
                          <input style={styles.settingInput} type="number" min="0" step="0.1" value={source.faultProtection?.prospectiveFaultCurrentKa ?? ""} onChange={(event) => updateSourceFaultProtection(source.id, { prospectiveFaultCurrentKa: event.target.value ? Number(event.target.value) : undefined, prospectiveFaultCurrentSource: source.faultProtection?.prospectiveFaultCurrentSource ?? "declared" })} />
                          <span>kA</span>
                        </span>
                      </label>
                    )}
                    <label style={styles.settingLabel}>
                      Distro incomer override
                      <span style={styles.inputWithUnit}>
                        <input style={styles.settingInput} type="number" min="0" step="0.1" value={distro.incomerFaultProtection?.prospectiveFaultCurrentKa ?? ""} placeholder={inheritedFaultCurrent.value?.toString() ?? "Not set"} onChange={(event) => updateIncomerFaultProtection(distro.id, { prospectiveFaultCurrentKa: event.target.value ? Number(event.target.value) : undefined, prospectiveFaultCurrentSource: distro.incomerFaultProtection?.prospectiveFaultCurrentSource ?? "design" })} />
                        <span>kA</span>
                      </span>
                      <small style={styles.small}>{inheritedFaultCurrent.value ? `${inheritedFaultCurrent.value}kA · ${inheritedFaultCurrent.label}` : inheritedFaultCurrent.label}</small>
                    </label>
                  </div>
                </div>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead><tr><th style={styles.th}>Circuit</th><th style={styles.th}>Device</th><th style={styles.th}>Ib</th><th style={styles.th}>In</th><th style={styles.th}>Iz</th><th style={styles.th}>Result</th></tr></thead>
                    <tbody>{distroRows.map((row) => {
                      const device = row.output.protectiveDevice;
                      const capacity = adjustedCableCapacity(row.output);
                      const result = coordinationResult(row);
                      return <tr key={row.key}><td style={styles.td}><strong>{row.label}</strong><span style={styles.infoIcon} title={circuitInformation(row)} aria-label="Circuit information">i</span></td><td style={styles.deviceTd}>{device && <span>{deviceLabel(device)}</span>}<ProtectionEditor label="Circuit protection" device={device} defaultRating={row.output.rating} defaultPoles={row.output.phase === "3Φ" ? 3 : 1} onChange={(nextDevice) => updateCircuitProtection(row, nextDevice)} /></td><td style={styles.td}>{row.designCurrentA.toFixed(2)}A</td><td style={styles.td}>{device && device.deviceType !== "rcd" ? `${device.ratedCurrentA}A` : "—"}</td><td style={styles.td}>{capacity === null ? "—" : `${capacity.toFixed(2)}A`}</td><td style={styles.td}><span style={result.status === "Conflict" ? styles.conflict : result.status === "Indicative" ? styles.indicative : styles.incomplete}>{result.status}</span><small style={styles.small}>{result.detail}</small></td></tr>;
                    })}</tbody>
                  </table>
                </div>
                <div style={styles.faultSectionHeader}>
                  <strong>Forecast fault protection &amp; device capability</strong>
                  <small style={styles.small}>These are design assumptions and forecasts only. Circuit overrides replace inherited supply assumptions.</small>
                </div>
                <div style={styles.tableWrap}>
                  <table style={{ ...styles.table, minWidth: "1380px" }}>
                    <thead><tr><th style={styles.th}>Circuit</th><th style={styles.th}>Forecast fault current</th><th style={styles.th}>Breaking capacity</th><th style={styles.th}>Estimated design Zs</th><th style={styles.th}>Maximum Zs</th><th style={styles.th}>Forecast results</th></tr></thead>
                    <tbody>{distroRows.map((row) => {
                      const device = row.output.protectiveDevice;
                      const data = row.output.faultProtection;
                      const effectiveFaultCurrent = effectiveCircuitFaultCurrent(row, plannerState);
                      const overload = overloadResult(row);
                      const breaking = breakingCapacityResult(row, plannerState);
                      const disconnection = disconnectionResult(row);
                      return (
                        <tr key={`fault:${row.key}`}>
                          <td style={styles.td}><strong>{row.label}</strong><span style={styles.infoIcon} title={circuitInformation(row)} aria-label="Circuit information">i</span></td>
                          <td style={styles.td}>
                            <span style={styles.inputWithUnit}><input style={styles.settingInput} type="number" min="0" step="0.1" value={data?.prospectiveFaultCurrentKa ?? ""} placeholder={effectiveFaultCurrent.value?.toString() ?? "Not set"} onChange={(event) => updateCircuitFaultProtection(row, { prospectiveFaultCurrentKa: event.target.value ? Number(event.target.value) : undefined, prospectiveFaultCurrentSource: data?.prospectiveFaultCurrentSource ?? "design" })} /><span>kA</span></span>
                            <small style={styles.small}>{effectiveFaultCurrent.value ? `${effectiveFaultCurrent.value}kA · ${effectiveFaultCurrent.label}` : effectiveFaultCurrent.label}</small>
                          </td>
                          <td style={styles.td}><strong>{device?.breakingCapacityKa ? `${device.breakingCapacityKa}kA` : "Not set"}</strong><small style={styles.small}>Configured on the protective device.</small></td>
                          <td style={styles.td}>
                            <span style={styles.inputWithUnit}><input style={styles.settingInput} type="number" min="0" step="0.01" value={data?.earthFaultLoopImpedanceOhms ?? ""} onChange={(event) => updateCircuitFaultProtection(row, { earthFaultLoopImpedanceOhms: event.target.value ? Number(event.target.value) : undefined })} /><span>Ω</span></span>
                            <span style={styles.designBadge}>Design estimate</span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.inputWithUnit}><input style={styles.settingInput} type="number" min="0" step="0.01" value={data?.maximumPermittedZsOhms ?? ""} onChange={(event) => updateCircuitFaultProtection(row, { maximumPermittedZsOhms: event.target.value ? Number(event.target.value) : undefined })} /><span>Ω</span></span>
                            <input style={styles.sourceInput} value={data?.maximumZsSource ?? ""} placeholder="Source / table / manufacturer" onChange={(event) => updateCircuitFaultProtection(row, { maximumZsSource: event.target.value })} />
                            <label style={styles.inlineField}>Required disconnection time <span style={styles.inputWithUnit}><input style={styles.settingInput} type="number" min="0" step="0.1" value={data?.requiredDisconnectionTimeSeconds ?? ""} onChange={(event) => updateCircuitFaultProtection(row, { requiredDisconnectionTimeSeconds: event.target.value ? Number(event.target.value) : undefined })} /><span>s</span></span></label>
                          </td>
                          <td style={styles.td}>
                            <span style={statusStyle(overload.status)}>{overload.status}</span><small style={styles.small}>Load &amp; cable: {overload.detail}</small>
                            <span style={statusStyle(breaking.status)}>{breaking.status}</span><small style={styles.small}>Breaking capacity: {breaking.detail}</small>
                            <span style={statusStyle(disconnection.status)}>{disconnection.status}</span><small style={styles.small}>Disconnection: {disconnection.detail}</small>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </>
            )}
          </article>
        );
      })}

      <section style={styles.card}>
        <h4 style={styles.cardTitle}>Residual-current selectivity</h4>
        {pairs.length === 0 ? <p style={styles.muted}>No series-connected RCD pairs were found on populated circuit paths.</p> : (
          <div style={styles.tableWrap}><table style={{ ...styles.table, minWidth: "1550px" }}><thead><tr><th style={styles.th}>Protected circuits</th><th style={styles.th}>Downstream</th><th style={styles.th}>Upstream</th><th style={styles.th}>Suggested upstream</th><th style={styles.th}>Selected upstream settings</th><th style={styles.th}>Setting source</th><th style={styles.th}>Assessment</th><th style={styles.th}>Action</th></tr></thead><tbody>
            {pairs.map((pair) => {
              const assessment = pairAssessment(pair);
              const upstream = pair.upstream.residualProtection!;
              const override = upstream.coordinationOverride;
              const residualOverridden = Boolean(override?.residualCurrentOverridden);
              const delayOverridden = Boolean(override?.timeDelayOverridden);
              const hasOverride = residualOverridden || delayOverridden;
              const hasAdjustableSetting =
                upstream.settingMode === "adjustable" ||
                upstream.delayMode === "adjustable-delay";
              const residualListId = `residual-settings-${pair.key}`;
              const delayListId = `delay-settings-${pair.key}`;

              return (
                <tr key={pair.key}>
                  <td style={styles.td}>
                    {pair.circuits.slice(0, 2).map((circuit) => <small key={circuit} style={styles.small}>{circuit}</small>)}
                    {pair.circuits.length > 2 && <small style={styles.small}>+ {pair.circuits.length - 2} more</small>}
                  </td>
                  <td style={styles.td}>
                    <strong>{deviceLabel(pair.downstream)}</strong>
                    <small style={styles.small}>{residualLabel(pair.downstream)}</small>
                  </td>
                  <td style={styles.td}>
                    <strong>{deviceLabel(pair.upstream)}</strong>
                    <small style={styles.small}>{residualLabel(pair.upstream)}</small>
                  </td>
                  <td style={styles.td}>
                    <strong>{assessment.suggestedResidualMa}mA / {assessment.suggestedDelayMs}ms</strong>
                    <small style={styles.small}>Generic 3:1 sensitivity and 100ms time-gap screen.</small>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.settingGrid}>
                      <label style={styles.settingLabel}>
                        Residual current
                        {upstream.settingMode === "adjustable" ? (
                          <span style={styles.inputWithUnit}>
                            <input
                              style={styles.settingInput}
                              type="number"
                              min="1"
                              step="1"
                              list={residualListId}
                              value={upstream.residualCurrentMa}
                              onChange={(event) => overrideSetting(pair, "residualCurrentMa", Number(event.target.value) || 0)}
                            />
                            <span>mA</span>
                            <datalist id={residualListId}>
                              {(upstream.availableResidualSettingsMa ?? []).map((value) => <option key={value} value={value} />)}
                            </datalist>
                          </span>
                        ) : (
                          <span style={styles.fixedSetting}>{upstream.residualCurrentMa}mA · Fixed</span>
                        )}
                      </label>
                      <label style={styles.settingLabel}>
                        Time delay
                        {upstream.delayMode === "adjustable-delay" ? (
                          <span style={styles.inputWithUnit}>
                            <input
                              style={styles.settingInput}
                              type="number"
                              min="0"
                              step="10"
                              list={delayListId}
                              value={upstream.timeDelayMs}
                              onChange={(event) => overrideSetting(pair, "timeDelayMs", Number(event.target.value) || 0)}
                            />
                            <span>ms</span>
                            <datalist id={delayListId}>
                              {(upstream.availableDelaySettingsMs ?? []).map((value) => <option key={value} value={value} />)}
                            </datalist>
                          </span>
                        ) : (
                          <span style={styles.fixedSetting}>{upstream.timeDelayMs}ms · {upstream.delayMode === "instantaneous" ? "Instantaneous" : "Fixed"}</span>
                        )}
                      </label>
                    </div>
                    {upstream.availableResidualSettingsMa?.length ? <small style={styles.small}>Available mA: {upstream.availableResidualSettingsMa.join(", ")}</small> : <small style={styles.small}>Available residual-current settings not declared.</small>}
                    {upstream.availableDelaySettingsMs?.length ? <small style={styles.small}>Available ms: {upstream.availableDelaySettingsMs.join(", ")}</small> : <small style={styles.small}>Available delay settings not declared.</small>}
                  </td>
                  <td style={styles.td}>
                    <span style={hasOverride ? styles.overrideBadge : styles.suggestedBadge}>
                      {hasOverride ? "Designer override" : upstream.settingMode === "fixed" && upstream.delayMode !== "adjustable-delay" ? "Fixed device" : "Suggested settings"}
                    </span>
                    {hasOverride && (
                      <label style={styles.overrideReasonLabel}>
                        Override reason
                        <textarea
                          style={{ ...styles.settingInput, width: "210px", minHeight: "64px", resize: "vertical" }}
                          value={override?.reason ?? ""}
                          placeholder="Record the design reason"
                          onChange={(event) => updateOverrideReason(pair, event.target.value)}
                        />
                      </label>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={assessment.status === "Conflict" ? styles.conflict : styles.indicative}>{assessment.status}</span>
                    <small style={styles.small}>{assessmentDetail(assessment)}</small>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.button}
                      disabled={
                        !hasAdjustableSetting ||
                        (!assessment.canApply && !hasOverride)
                      }
                      onClick={() => applySuggestion(pair)}
                    >
                      {!hasAdjustableSetting
                        ? "Fixed device"
                        : hasOverride
                          ? "Reset to suggestion"
                          : assessment.canApply
                            ? "Use suggestion"
                            : "Suggestion selected"}
                    </button>
                  </td>
                </tr>
              );
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
  toolbar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px" }, compactField: { display: "flex", alignItems: "center", gap: "8px" }, toolbarLabel: { fontSize: "12px", color: "#526071", fontWeight: 600 }, filterLabel: { display: "grid", gap: "5px", color: "#637083", fontSize: "13px" }, filterInput: { minWidth: "220px", minHeight: "40px", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: "9px", background: "white" }, checkboxLabel: { display: "flex", alignItems: "center", gap: "7px", minHeight: "40px", fontSize: "14px" }, textButton: { padding: "7px 9px", border: 0, background: "transparent", color: "#334155", textDecoration: "underline", cursor: "pointer" },
  distroSections: { display: "grid", gap: "8px" }, distroSectionButton: { width: "100%", display: "flex", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #dce5ec", borderRadius: "11px", background: "#f8fafc", color: "#111827", cursor: "pointer", textAlign: "left" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }, summary: { display: "grid", gap: "4px", padding: "14px", border: "1px solid #dce5ec", borderRadius: "12px", background: "#f8fafc" },
  card: { border: "1px solid #dce5ec", borderRadius: "14px", background: "white", overflow: "hidden" }, cardTitle: { margin: 0, padding: "14px 16px", background: "#f8fafc", borderBottom: "1px solid #dce5ec" },
  distroHeader: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", border: 0, borderBottom: "1px solid #e5e7eb", background: "#f8fafc", color: "#111827", textAlign: "left", cursor: "pointer" },
  sectionHelp: { margin: 0, padding: "12px 16px 0", color: "#637083", fontSize: "13px" },
  incomerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px", padding: "16px" },
  incomerCard: { display: "grid", gap: "8px", padding: "12px 16px", borderBottom: "1px solid #dce5ec", background: "#f8fafc" },
  faultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", paddingTop: "8px", borderTop: "1px solid #dce5ec" },
  faultSectionHeader: { padding: "12px 16px", borderTop: "1px solid #dce5ec", borderBottom: "1px solid #dce5ec", background: "#f8fafc" },
  tableWrap: { overflowX: "auto" }, table: { width: "100%", minWidth: "900px", borderCollapse: "collapse", fontSize: "13px" }, th: { padding: "10px", borderBottom: "1px solid #dce5ec", textAlign: "left", color: "#526071", whiteSpace: "nowrap" }, td: { padding: "10px", borderBottom: "1px solid #eef2f6", textAlign: "left", verticalAlign: "top" }, small: { display: "block", marginTop: "4px", color: "#637083", lineHeight: 1.35 },
  deviceTd: { width: "390px", padding: "10px", borderBottom: "1px solid #eef2f6", textAlign: "left", verticalAlign: "top" },
  infoIcon: { display: "inline-grid", placeItems: "center", width: "17px", height: "17px", marginLeft: "7px", border: "1px solid #94a3b8", borderRadius: "50%", color: "#526071", fontSize: "11px", fontWeight: 700, cursor: "help" },
  indicative: { display: "inline-block", padding: "3px 7px", borderRadius: "999px", background: "#ecfdf3", color: "#027a48" }, pass: { display: "inline-block", marginTop: "5px", padding: "3px 7px", borderRadius: "999px", background: "#ecfdf3", color: "#027a48" }, review: { display: "inline-block", marginTop: "5px", padding: "3px 7px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8" }, conflict: { display: "inline-block", marginTop: "5px", padding: "3px 7px", borderRadius: "999px", background: "#fff1f1", color: "#c53030" }, incomplete: { display: "inline-block", marginTop: "5px", padding: "3px 7px", borderRadius: "999px", background: "#fff7e6", color: "#92400e" },
  settingGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: "8px" },
  settingLabel: { display: "grid", gap: "4px", color: "#526071", fontSize: "11px", fontWeight: 600 },
  inputWithUnit: { display: "flex", alignItems: "center", gap: "5px", color: "#637083", fontWeight: 400 },
  settingInput: { width: "88px", minHeight: "34px", padding: "5px 7px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "white", color: "#172033", font: "inherit", fontWeight: 400, boxSizing: "border-box" },
  designBadge: { display: "inline-block", marginTop: "7px", padding: "4px 7px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", fontSize: "11px", fontWeight: 600 },
  sourceInput: { display: "block", width: "210px", minHeight: "32px", marginTop: "7px", padding: "5px 7px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "white", color: "#172033", font: "inherit", fontWeight: 400, boxSizing: "border-box" },
  inlineField: { display: "grid", gap: "4px", marginTop: "7px", color: "#637083", fontSize: "11px", fontWeight: 600 },
  fixedSetting: { minHeight: "34px", display: "flex", alignItems: "center", color: "#637083", fontWeight: 500 },
  overrideBadge: { display: "inline-block", padding: "4px 7px", borderRadius: "999px", background: "#fff7e6", color: "#92400e", fontSize: "11px", fontWeight: 600 },
  suggestedBadge: { display: "inline-block", padding: "4px 7px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", fontSize: "11px", fontWeight: 600 },
  overrideReasonLabel: { display: "grid", gap: "5px", marginTop: "8px", color: "#637083", fontSize: "11px", fontWeight: 600 },
  button: { minHeight: "36px", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: "9px", background: "white", cursor: "pointer" }, disclaimer: { margin: 0, color: "#637083", fontSize: "12px" },
};
