import { useEffect, useState } from "react";
import type {
  DistroDefinition,
  PlannerOutput,
  ProtectiveDevice,
  ProtectiveDeviceKind,
  RcdType,
} from "@/planner/types";

type DistroDefinitionBuilderProps = {
  initialDefinition?: DistroDefinition;
  saveLabel?: string;
  saving?: boolean;
  onSave: (definition: DistroDefinition) => void | Promise<void>;
  onCancel?: () => void;
};

export const DISTRO_INPUT_TYPES = [
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

export function sourceRating(connection: string) {
  const match = connection.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isSinglePhaseInput(connection: string) {
  return !connection.includes("/ 3");
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function copyProtectiveDevice(
  device: ProtectiveDevice | undefined,
  deviceIds: Map<string, string>,
) {
  if (!device) return undefined;
  const id = deviceIds.get(device.id) ?? createId("protection");
  deviceIds.set(device.id, id);
  return { ...device, id };
}

function duplicateProtectiveDevice(
  device: ProtectiveDevice,
  id = createId("protection"),
) {
  return {
    ...device,
    id,
    residualProtection: device.residualProtection
      ? {
          ...device.residualProtection,
          availableResidualSettingsMa:
            device.residualProtection.availableResidualSettingsMa
              ? [...device.residualProtection.availableResidualSettingsMa]
              : undefined,
          availableDelaySettingsMs:
            device.residualProtection.availableDelaySettingsMs
              ? [...device.residualProtection.availableDelaySettingsMs]
              : undefined,
        }
      : undefined,
  };
}

function copyOutputWithNewIds(
  output: PlannerOutput,
  deviceIds: Map<string, string>,
): PlannerOutput {
  return {
    ...output,
    id: createId("custom_output"),
    items: [],
    protectiveDevice: copyProtectiveDevice(output.protectiveDevice, deviceIds),
    socaCircuits: output.socaCircuits?.map((circuit) => ({
      ...circuit,
      id: createId("custom_soca_socket"),
      items: [],
      protectiveDevice: copyProtectiveDevice(
        circuit.protectiveDevice,
        deviceIds,
      ),
    })),
  };
}

export function cloneDistroDefinition(
  definition: DistroDefinition,
  name = definition.name,
): DistroDefinition {
  const deviceIds = new Map<string, string>();
  return {
    ...definition,
    name,
    incomerProtection: copyProtectiveDevice(
      definition.incomerProtection,
      deviceIds,
    ),
    outputs: definition.outputs.map((output) =>
      copyOutputWithNewIds(output, deviceIds),
    ),
  };
}

function createSinglePhaseOutput(
  number: number,
  phase: "L1" | "L2" | "L3",
  rating: number,
): PlannerOutput {
  return {
    id: createId("custom_output"),
    label: String(number),
    phase,
    type: `${rating}A / 1`,
    rating,
    items: [],
    notes: "",
  };
}

function createThreePhaseOutput(number: number, rating: number): PlannerOutput {
  return {
    id: createId("custom_output"),
    label: `${number} ${rating}/3`,
    displayName: `Output ${number} – ${rating}/3`,
    phase: "3Φ",
    type: `${rating}A / 3`,
    rating,
    items: [],
    notes: "",
  };
}

function createSocapexOutput(
  number: number,
  breakerPair: string | null = null,
): PlannerOutput {
  const circuits: PlannerOutput[] = [];

  ([
    ["L1", [1, 4]],
    ["L2", [2, 5]],
    ["L3", [3, 6]],
  ] as const).forEach(([phase, circuitNumbers]) => {
    circuitNumbers.forEach((circuitNumber) => {
      circuits.push({
        id: createId("custom_soca_socket"),
        label: `${number} - ${circuitNumber}`,
        phase,
        circuitNo: circuitNumber,
        type: "16A / 1",
        rating: 16,
        items: [],
        notes: "",
      });
    });
  });

  return {
    id: createId("custom_soca"),
    outputNumber: number,
    label: `Socapex ${number}`,
    phase: "Socapex",
    type: "Socapex",
    rating: 32,
    items: [],
    notes: "",
    breakerPair,
    socaCircuits: circuits,
    detail: "2 × 16A sockets per phase · L1 1 & 4 · L2 2 & 5 · L3 3 & 6",
  };
}

function outputLabel(output: PlannerOutput) {
  if (output.phase === "Socapex") return output.label;
  if (output.phase === "3Φ") return output.displayName ?? output.label;
  return `${output.label} - ${output.rating}A`;
}

function defaultProtectiveDevice(
  rating: number,
  poles: number,
): ProtectiveDevice {
  return {
    id: createId("protection"),
    deviceType: "mcb",
    ratedCurrentA: rating,
    poles,
    curve: "C",
  };
}

function deviceHasResidualProtection(device: ProtectiveDevice) {
  return device.deviceType === "rcd" || device.deviceType === "rcbo" || device.deviceType === "mcb-rcd";
}

function deviceTypeLabel(deviceType: ProtectiveDeviceKind) {
  if (deviceType === "mcb-rcd") return "MCB with RCD protection";
  return deviceType.toUpperCase();
}

function parseSettingList(value: string) {
  return [...new Set(value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item >= 0))].sort((a, b) => a - b);
}

function withDefaultResidualProtection(
  device: ProtectiveDevice,
): ProtectiveDevice {
  return {
    ...device,
    residualProtection: device.residualProtection ?? {
      rcdType: "A",
      settingMode: "fixed",
      residualCurrentMa: 30,
      delayMode: "instantaneous",
      timeDelayMs: 0,
      selectiveType: false,
    },
  };
}

export function ProtectionEditor({
  label,
  device,
  defaultRating,
  defaultPoles,
  onChange,
  onPasteToOutputs,
}: {
  label: string;
  device: ProtectiveDevice | undefined;
  defaultRating: number;
  defaultPoles: number;
  onChange: (device: ProtectiveDevice | undefined) => void;
  onPasteToOutputs?: (device: ProtectiveDevice) => void;
}) {
  if (!device) {
    return (
      <div style={styles.protectionEmpty}>
        <span>{label}: not configured</span>
        <button
          style={styles.compactButton}
          onClick={() =>
            onChange(defaultProtectiveDevice(defaultRating, defaultPoles))
          }
        >
          Add Protection
        </button>
      </div>
    );
  }

  const configuredDevice: ProtectiveDevice = device;
  const residual = configuredDevice.residualProtection;
  const showResidual = deviceHasResidualProtection(configuredDevice);

  function patch(patchValue: Partial<ProtectiveDevice>) {
    onChange({ ...configuredDevice, ...patchValue });
  }

  function setDeviceType(deviceType: ProtectiveDeviceKind) {
    const next: ProtectiveDevice = { ...configuredDevice, deviceType };
    onChange(
      deviceType === "rcd" || deviceType === "rcbo" || deviceType === "mcb-rcd"
        ? withDefaultResidualProtection(next)
        : { ...next, residualProtection: undefined },
    );
  }

  return (
    <details style={styles.protectionDetails}>
      <summary style={styles.protectionSummary}>
        {label}: {deviceTypeLabel(device.deviceType)} · {device.ratedCurrentA}A
        {residual
          ? ` · ${residual.residualCurrentMa}mA / ${residual.timeDelayMs}ms`
          : ""}
      </summary>
      <div style={styles.protectionGrid}>
        <label style={styles.label}>
          Device type
          <select
            style={styles.input}
            value={device.deviceType}
            onChange={(event) =>
              setDeviceType(event.target.value as ProtectiveDeviceKind)
            }
          >
            <option value="fuse">Fuse</option>
            <option value="mcb">MCB</option>
            <option value="mcb-rcd">MCB with RCD protection</option>
            <option value="mccb">MCCB</option>
            <option value="rcd">RCD</option>
            <option value="rcbo">RCBO</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label style={styles.label}>
          Rated current
          <input
            style={styles.input}
            type="number"
            min="0.1"
            step="0.1"
            value={device.ratedCurrentA}
            onChange={(event) =>
              patch({ ratedCurrentA: Math.max(0.1, Number(event.target.value)) })
            }
          />
        </label>
        <label style={styles.label}>
          Poles
          <input
            style={styles.input}
            type="number"
            min="1"
            max="4"
            value={device.poles}
            onChange={(event) =>
              patch({ poles: Math.min(4, Math.max(1, Number(event.target.value))) })
            }
          />
        </label>
        {(device.deviceType === "mcb" ||
          device.deviceType === "mcb-rcd" ||
          device.deviceType === "mccb" ||
          device.deviceType === "rcbo") && (
          <label style={styles.label}>
            Curve
            <select
              style={styles.input}
              value={device.curve ?? "C"}
              onChange={(event) =>
                patch({ curve: event.target.value as ProtectiveDevice["curve"] })
              }
            >
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="manufacturer-specific">Manufacturer-specific</option>
            </select>
          </label>
        )}
        <label style={styles.label}>
          Breaking capacity
          <div style={styles.inputWithUnit}>
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.1"
              value={device.breakingCapacityKa ?? ""}
              onChange={(event) =>
                patch({
                  breakingCapacityKa: event.target.value
                    ? Math.max(0, Number(event.target.value))
                    : undefined,
                })
              }
            />
            <span>kA</span>
          </div>
        </label>
        <label style={styles.label}>
          Manufacturer
          <input
            style={styles.input}
            value={device.manufacturer ?? ""}
            onChange={(event) => patch({ manufacturer: event.target.value })}
          />
        </label>
        <label style={styles.label}>
          Model
          <input
            style={styles.input}
            value={device.model ?? ""}
            onChange={(event) => patch({ model: event.target.value })}
          />
        </label>
      </div>

      {showResidual && residual && (
        <div style={styles.residualPanel}>
          <strong>Residual-current protection</strong>
          <div style={styles.protectionGrid}>
            <label style={styles.label}>
              RCD type
              <select
                style={styles.input}
                value={residual.rcdType}
                onChange={(event) =>
                  patch({
                    residualProtection: {
                      ...residual,
                      rcdType: event.target.value as RcdType,
                    },
                  })
                }
              >
                <option value="AC">AC</option>
                <option value="A">A</option>
                <option value="F">F</option>
                <option value="B">B</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label style={styles.label}>
              mA setting
              <select
                style={styles.input}
                value={residual.settingMode}
                onChange={(event) =>
                  patch({
                    residualProtection: {
                      ...residual,
                      settingMode: event.target.value as "fixed" | "adjustable",
                    },
                  })
                }
              >
                <option value="fixed">Fixed</option>
                <option value="adjustable">Adjustable</option>
              </select>
            </label>
            <label style={styles.label}>
              Residual current
              <div style={styles.inputWithUnit}>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  step="1"
                  value={residual.residualCurrentMa}
                  onChange={(event) =>
                    patch({
                      residualProtection: {
                        ...residual,
                        residualCurrentMa: Math.max(1, Number(event.target.value)),
                      },
                    })
                  }
                />
                <span>mA</span>
              </div>
            </label>
            {residual.settingMode === "adjustable" && (
              <label style={styles.label}>
                Available mA settings
                <input
                  style={styles.input}
                  key={`${configuredDevice.id}:residual-settings:${(residual.availableResidualSettingsMa ?? []).join("-")}`}
                  defaultValue={(residual.availableResidualSettingsMa ?? []).join(", ")}
                  placeholder="e.g. 30, 100, 300, 500"
                  onBlur={(event) =>
                    patch({
                      residualProtection: {
                        ...residual,
                        availableResidualSettingsMa: parseSettingList(event.target.value).filter((value) => value > 0),
                      },
                    })
                  }
                />
              </label>
            )}
            <label style={styles.label}>
              Delay mode
              <select
                style={styles.input}
                value={residual.delayMode}
                onChange={(event) => {
                  const delayMode = event.target.value as
                    | "instantaneous"
                    | "fixed-delay"
                    | "adjustable-delay";
                  patch({
                    residualProtection: {
                      ...residual,
                      delayMode,
                      timeDelayMs:
                        delayMode === "instantaneous" ? 0 : residual.timeDelayMs,
                    },
                  });
                }}
              >
                <option value="instantaneous">Instantaneous</option>
                <option value="fixed-delay">Fixed delay</option>
                <option value="adjustable-delay">Adjustable delay</option>
              </select>
            </label>
            <label style={styles.label}>
              Time delay
              <div style={styles.inputWithUnit}>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  step="10"
                  disabled={residual.delayMode === "instantaneous"}
                  value={residual.timeDelayMs}
                  onChange={(event) =>
                    patch({
                      residualProtection: {
                        ...residual,
                        timeDelayMs: Math.max(0, Number(event.target.value)),
                      },
                    })
                  }
                />
                <span>ms</span>
              </div>
            </label>
            {residual.delayMode === "adjustable-delay" && (
              <label style={styles.label}>
                Available delay settings
                <input
                  style={styles.input}
                  key={`${configuredDevice.id}:delay-settings:${(residual.availableDelaySettingsMs ?? []).join("-")}`}
                  defaultValue={(residual.availableDelaySettingsMs ?? []).join(", ")}
                  placeholder="e.g. 0, 60, 150, 300"
                  onBlur={(event) =>
                    patch({
                      residualProtection: {
                        ...residual,
                        availableDelaySettingsMs: parseSettingList(event.target.value),
                      },
                    })
                  }
                />
              </label>
            )}
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={Boolean(residual.selectiveType)}
                onChange={(event) =>
                  patch({
                    residualProtection: {
                      ...residual,
                      selectiveType: event.target.checked,
                    },
                  })
                }
              />
              Selective / time-graded device
            </label>
          </div>
        </div>
      )}

      <div style={styles.protectionFooter}>
        {onPasteToOutputs && (
          <button
            type="button"
            style={styles.compactButton}
            onClick={() => onPasteToOutputs(configuredDevice)}
          >
            Paste to outputs
          </button>
        )}
        <button style={styles.removeProtectionButton} onClick={() => onChange(undefined)}>
          Remove Protection
        </button>
      </div>
    </details>
  );
}

export function DistroDefinitionBuilder({
  initialDefinition,
  saveLabel = "Save Distro",
  saving = false,
  onSave,
  onCancel,
}: DistroDefinitionBuilderProps) {
  const [name, setName] = useState(initialDefinition?.name ?? "");
  const [input, setInput] = useState(initialDefinition?.input ?? "32A / 3");
  const [singlePhaseRating, setSinglePhaseRating] = useState("16");
  const [singlePhasePhase, setSinglePhasePhase] =
    useState<"L1" | "L2" | "L3">("L1");
  const [threePhaseRating, setThreePhaseRating] = useState("32");
  const [outputs, setOutputs] = useState<PlannerOutput[]>(
    initialDefinition?.outputs ?? [],
  );
  const [incomerProtection, setIncomerProtection] =
    useState<ProtectiveDevice | undefined>(
      initialDefinition?.incomerProtection,
    );
  const [protectionPaste, setProtectionPaste] = useState<{
    sourceOutput: PlannerOutput;
    device: ProtectiveDevice;
    selectedOutputIds: string[];
  } | null>(null);
  const singlePhaseInput = isSinglePhaseInput(input);

  useEffect(() => {
    setName(initialDefinition?.name ?? "");
    setInput(initialDefinition?.input ?? "32A / 3");
    setOutputs(initialDefinition?.outputs ?? []);
    setIncomerProtection(initialDefinition?.incomerProtection);
    setProtectionPaste(null);
  }, [initialDefinition]);

  function protectionRating(output: PlannerOutput) {
    return output.phase === "Socapex" ? 16 : output.rating;
  }

  function openProtectionPaste(
    sourceOutput: PlannerOutput,
    device: ProtectiveDevice,
  ) {
    setProtectionPaste({
      sourceOutput,
      device,
      selectedOutputIds: [],
    });
  }

  function toggleProtectionPasteTarget(outputId: string) {
    setProtectionPaste((current) =>
      current
        ? {
            ...current,
            selectedOutputIds: current.selectedOutputIds.includes(outputId)
              ? current.selectedOutputIds.filter((id) => id !== outputId)
              : [...current.selectedOutputIds, outputId],
          }
        : current,
    );
  }

  function applyProtectionPaste() {
    if (!protectionPaste || protectionPaste.selectedOutputIds.length === 0) {
      return;
    }

    setOutputs((current) => {
      const selected = new Set(protectionPaste.selectedOutputIds);
      const pastedDeviceIds = new Map<string, string>();
      const selectedBreakerPairs = new Set(
        current
          .filter(
            (output) => selected.has(output.id) && output.breakerPair,
          )
          .map((output) => output.breakerPair as string),
      );

      return current.map((output) => {
        const targeted =
          selected.has(output.id) ||
          Boolean(
            output.breakerPair &&
              selectedBreakerPairs.has(output.breakerPair),
          );
        if (!targeted) return output;

        if (output.phase !== "Socapex") {
          return {
            ...output,
            protectiveDevice: duplicateProtectiveDevice(
              protectionPaste.device,
            ),
          };
        }

        return {
          ...output,
          socaCircuits: (output.socaCircuits ?? []).map((circuit) => ({
            ...circuit,
            protectiveDevice: duplicateProtectiveDevice(
              protectionPaste.device,
              (() => {
                const key = `${output.breakerPair ?? output.id}:${circuit.circuitNo ?? circuit.id}`;
                const existing = pastedDeviceIds.get(key);
                if (existing) return existing;
                const id = createId("protection");
                pastedDeviceIds.set(key, id);
                return id;
              })(),
            ),
          })),
        };
      });
    });

    setProtectionPaste(null);
  }

  function updateOutputProtection(
    output: PlannerOutput,
    protectiveDevice: ProtectiveDevice | undefined,
  ) {
    setOutputs((current) => {
      if (output.phase !== "Socapex") {
        return current.map((item) =>
          item.id === output.id ? { ...item, protectiveDevice } : item,
        );
      }

      const targetIds = new Map<number, string>();
      (output.socaCircuits ?? []).forEach((socket) => {
        if (typeof socket.circuitNo === "number") {
          targetIds.set(
            socket.circuitNo,
            socket.protectiveDevice?.id ?? createId("protection"),
          );
        }
      });

      return current.map((item) => {
        const sameProtectionGroup = output.breakerPair
          ? item.breakerPair === output.breakerPair
          : item.id === output.id;

        if (!sameProtectionGroup || item.phase !== "Socapex") return item;

        return {
          ...item,
          socaCircuits: (item.socaCircuits ?? []).map((socket) => ({
            ...socket,
            protectiveDevice: protectiveDevice
              ? {
                  ...protectiveDevice,
                  id:
                    targetIds.get(socket.circuitNo ?? 0) ??
                    createId("protection"),
                }
              : undefined,
          })),
        };
      });
    });
  }

  function addSinglePhaseOutput() {
    const rating = Number(singlePhaseRating);
    setOutputs((current) => [
      ...current,
      createSinglePhaseOutput(current.length + 1, singlePhasePhase, rating),
    ]);
  }

  function addThreePhaseOutput() {
    const rating = Number(threePhaseRating);
    setOutputs((current) => [
      ...current,
      createThreePhaseOutput(current.length + 1, rating),
    ]);
  }

  function addSocapexOutput() {
    setOutputs((current) => [
      ...current,
      createSocapexOutput(
        current.filter((output) => output.phase === "Socapex").length + 1,
      ),
    ]);
  }

  function addTwinSocapexOutput() {
    setOutputs((current) => {
      const firstNumber =
        current.filter((output) => output.phase === "Socapex").length + 1;
      const breakerPair = `custom_pair_${createId("soca")}`;

      return [
        ...current,
        createSocapexOutput(firstNumber, breakerPair),
        createSocapexOutput(firstNumber + 1, breakerPair),
      ];
    });
  }

  function moveOutput(outputId: string, direction: -1 | 1) {
    setOutputs((current) => {
      const currentIndex = current.findIndex((output) => output.id === outputId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function removeOutput(output: PlannerOutput) {
    if (
      output.breakerPair &&
      !confirm("Remove both Socapex outputs in this shared-breaker twin?")
    ) {
      return;
    }

    setOutputs((current) =>
      output.breakerPair
        ? current.filter((item) => item.breakerPair !== output.breakerPair)
        : current.filter((item) => item.id !== output.id),
    );
  }

  async function save() {
    const cleanName = name.trim();
    if (!cleanName) {
      alert("Please enter a distro name.");
      return;
    }
    if (outputs.length === 0) {
      alert("Please add at least one output.");
      return;
    }
    if (
      singlePhaseInput &&
      outputs.some(
        (output) => output.phase === "3Φ" || output.phase === "Socapex",
      )
    ) {
      alert(
        "A single-phase distro cannot contain three-phase or Socapex outputs. Please remove those outputs before saving.",
      );
      return;
    }

    const normalisedOutputs = singlePhaseInput
      ? outputs.map((output) => ({ ...output, phase: "L1" as const }))
      : outputs;

    await onSave({
      ...initialDefinition,
      name: cleanName,
      input,
      inputA: sourceRating(input),
      outputs: normalisedOutputs,
      incomerProtection,
      custom: initialDefinition?.custom,
    });
  }

  return (
    <div style={styles.builder}>
      <div style={styles.setupGrid}>
        <label style={styles.label}>
          Distro Name
          <input style={styles.input} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label style={styles.label}>
          Input Type
          <select style={styles.input} value={input} onChange={(event) => setInput(event.target.value)}>
            {DISTRO_INPUT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Amps Per Phase
          <input style={styles.input} value={sourceRating(input)} readOnly />
        </label>
      </div>

      <section style={styles.panel}>
        <h3 style={styles.heading}>Incomer Protection</h3>
        <p style={styles.muted}>
          Record the device built into this distro. Upstream supply protection
          will be assessed separately in the project protection hierarchy.
        </p>
        <ProtectionEditor
          label="Incomer"
          device={incomerProtection}
          defaultRating={sourceRating(input)}
          defaultPoles={singlePhaseInput ? 2 : 4}
          onChange={setIncomerProtection}
        />
      </section>

      <section style={styles.panel}>
        <h3 style={styles.heading}>Add Outputs</h3>
        <div
          style={
            singlePhaseInput
              ? { ...styles.controlsGrid, gridTemplateColumns: "minmax(0, 1fr)" }
              : styles.controlsGrid
          }
        >
          <div style={styles.controlCard}>
            <h4 style={styles.heading}>Single-Phase Output</h4>
            <div style={styles.inlineFields}>
              <label style={styles.label}>Phase
                <select style={styles.input} value={singlePhaseInput ? "L1" : singlePhasePhase} disabled={singlePhaseInput} onChange={(event) => setSinglePhasePhase(event.target.value as "L1" | "L2" | "L3")}>
                  {singlePhaseInput ? <option value="L1">Single phase</option> : <><option>L1</option><option>L2</option><option>L3</option></>}
                </select>
              </label>
              <label style={styles.label}>Rating
                <select style={styles.input} value={singlePhaseRating} onChange={(event) => setSinglePhaseRating(event.target.value)}>
                  <option value="13">13A</option><option value="16">16A</option><option value="32">32A</option><option value="63">63A</option>
                </select>
              </label>
            </div>
            <button style={styles.secondaryButton} onClick={addSinglePhaseOutput}>Add Single-Phase</button>
          </div>
          {!singlePhaseInput && (
            <>
              <div style={styles.controlCard}>
                <h4 style={styles.heading}>Three-Phase Output</h4>
                <label style={styles.label}>Rating
                  <select style={styles.input} value={threePhaseRating} onChange={(event) => setThreePhaseRating(event.target.value)}>
                    <option value="32">32/3</option><option value="63">63/3</option><option value="125">125/3</option><option value="400">Powerlock</option>
                  </select>
                </label>
                <button style={styles.secondaryButton} onClick={addThreePhaseOutput}>Add Three-Phase</button>
              </div>
              <div style={styles.controlCard}>
                <h4 style={styles.heading}>Socapex Outputs</h4>
                <p style={styles.muted}>Single adds one six-circuit output. Twin adds two Socapex outputs whose matching circuits share breakers.</p>
                <div style={styles.socapexActions}>
                  <button style={styles.secondaryButton} onClick={addSocapexOutput}>Add Single Socapex Output</button>
                  <button style={styles.secondaryButton} onClick={addTwinSocapexOutput}>Add Twin Socapex Output</button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section>
        <h3 style={styles.heading}>Distro Layout</h3>
        {outputs.length === 0 ? <p style={styles.muted}>No outputs added yet.</p> : (
          <div style={styles.outputList}>
            {outputs.map((output, index) => (
              <div key={output.id} style={styles.outputCard}>
                <div style={styles.outputRow}>
                  <div><strong>{index + 1}. {outputLabel(output)}</strong><p style={styles.mutedSmall}>{output.phase} · {output.type} · {output.rating}A{output.breakerPair ? " · Twin shared breakers" : ""}</p></div>
                  <div style={styles.actions}>
                    <button style={styles.iconButton} onClick={() => moveOutput(output.id, -1)} disabled={index === 0} aria-label="Move output up">↑</button>
                    <button style={styles.iconButton} onClick={() => moveOutput(output.id, 1)} disabled={index === outputs.length - 1} aria-label="Move output down">↓</button>
                    <button style={styles.dangerButton} onClick={() => removeOutput(output)}>{output.breakerPair ? "Remove Twin" : "Remove"}</button>
                  </div>
                </div>
                <ProtectionEditor
                  label={
                    output.phase === "Socapex"
                      ? output.breakerPair
                        ? "Twin shared circuit protection"
                        : "Socapex circuit protection"
                      : "Output protection"
                  }
                  device={
                    output.phase === "Socapex"
                      ? output.socaCircuits?.[0]?.protectiveDevice
                      : output.protectiveDevice
                  }
                  defaultRating={
                    output.phase === "Socapex" ? 16 : output.rating
                  }
                  defaultPoles={output.phase === "3Φ" ? 3 : 1}
                  onChange={(device) => updateOutputProtection(output, device)}
                  onPasteToOutputs={(device) =>
                    openProtectionPaste(output, device)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {protectionPaste && (
        <div
          style={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setProtectionPaste(null);
            }
          }}
        >
          <section
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="paste-protection-title"
          >
            <div style={styles.modalHeader}>
              <div>
                <h3 id="paste-protection-title" style={styles.heading}>
                  Paste protection to outputs
                </h3>
                <p style={styles.mutedSmall}>
                  Copying {deviceTypeLabel(protectionPaste.device.deviceType)} ·{" "}
                  {protectionPaste.device.ratedCurrentA}A from{" "}
                  {outputLabel(protectionPaste.sourceOutput)}. Only outputs
                  with a matching {protectionRating(protectionPaste.sourceOutput)}A
                  circuit rating are available.
                </p>
              </div>
              <button
                type="button"
                style={styles.modalCloseButton}
                onClick={() => setProtectionPaste(null)}
                aria-label="Close protection paste dialog"
              >
                ×
              </button>
            </div>

            <div style={styles.pasteTargetList}>
              {outputs
                .filter(
                  (output) =>
                    output.id !== protectionPaste.sourceOutput.id &&
                    protectionRating(output) ===
                      protectionRating(protectionPaste.sourceOutput),
                )
                .map((output) => (
                  <label key={output.id} style={styles.pasteTarget}>
                    <input
                      type="checkbox"
                      checked={protectionPaste.selectedOutputIds.includes(
                        output.id,
                      )}
                      onChange={() => toggleProtectionPasteTarget(output.id)}
                    />
                    <span>
                      <strong>{outputLabel(output)}</strong>
                      <small style={styles.pasteTargetDetail}>
                        {output.phase === "Socapex"
                          ? `Socapex output · six ${protectionRating(output)}A circuits${output.breakerPair ? " · twin shared breakers" : ""}`
                          : `${output.phase} · ${output.type} · ${output.rating}A`}
                      </small>
                    </span>
                  </label>
                ))}
              {outputs.filter(
                (output) =>
                  output.id !== protectionPaste.sourceOutput.id &&
                  protectionRating(output) ===
                    protectionRating(protectionPaste.sourceOutput),
              ).length === 0 && (
                <div style={styles.protectionEmpty}>
                  No other outputs in this distro have the same circuit rating.
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setProtectionPaste(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={protectionPaste.selectedOutputIds.length === 0}
                onClick={applyProtectionPaste}
              >
                Paste protection
              </button>
            </div>
          </section>
        </div>
      )}

      <div style={styles.saveActions}>
        {onCancel && (
          <button style={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button style={styles.primaryButton} onClick={save} disabled={saving}>{saving ? "Saving…" : saveLabel}</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  builder: { display: "grid", gap: "20px" },
  setupGrid: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 220px 140px", gap: "12px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", color: "#637083", fontWeight: 400 },
  input: { width: "100%", minHeight: "44px", padding: "0 12px", borderRadius: "10px", border: "1px solid #d9e0ea", background: "white", boxSizing: "border-box", font: "inherit", fontWeight: 400 },
  panel: { padding: "16px", border: "1px solid #d9e0ea", borderRadius: "14px", background: "#f8fafc" },
  heading: { margin: "0 0 12px" },
  controlsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  controlCard: { padding: "14px", border: "1px solid #d9e0ea", borderRadius: "12px", background: "white" },
  inlineFields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  muted: { color: "#637083", margin: "6px 0 12px" },
  mutedSmall: { color: "#637083", margin: "4px 0 0", fontSize: "13px" },
  socapexActions: { display: "grid", gap: "8px" },
  outputList: { display: "grid", gap: "8px" },
  outputCard: { display: "grid", gap: "10px", padding: "12px", border: "1px solid #d9e0ea", borderRadius: "12px", background: "#f8fafc" },
  outputRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  protectionEmpty: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "10px 12px", border: "1px dashed #cbd5e1", borderRadius: "10px", color: "#637083", background: "white" },
  compactButton: { minHeight: "36px", padding: "0 12px", borderRadius: "9px", border: "1px solid #d9e0ea", background: "white", color: "#172033", cursor: "pointer", font: "inherit", fontWeight: 500 },
  protectionDetails: { border: "1px solid #d9e0ea", borderRadius: "10px", background: "white", overflow: "hidden" },
  protectionSummary: { padding: "11px 12px", cursor: "pointer", color: "#172033", fontWeight: 600 },
  protectionGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", padding: "12px" },
  residualPanel: { borderTop: "1px solid #d9e0ea", padding: "14px 0 4px", background: "#f8fafc" },
  inputWithUnit: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: "8px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", color: "#637083", fontWeight: 400, minHeight: "44px", marginTop: "22px" },
  protectionFooter: { display: "flex", justifyContent: "flex-end", gap: "8px", padding: "0 12px 12px" },
  removeProtectionButton: { minHeight: "36px", padding: "0 12px", borderRadius: "9px", border: "1px solid #c53030", background: "#fff5f5", color: "#c53030", cursor: "pointer", font: "inherit", fontWeight: 500 },
  saveActions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  primaryButton: { minHeight: "44px", padding: "0 16px", borderRadius: "10px", border: "1px solid var(--lva-workspace-dark-button, #172033)", background: "var(--lva-workspace-dark-button, #172033)", color: "white", cursor: "pointer", font: "inherit", fontWeight: 600 },
  secondaryButton: { minHeight: "40px", marginTop: "12px", padding: "0 14px", borderRadius: "10px", border: "1px solid #d9e0ea", background: "white", color: "#172033", cursor: "pointer", font: "inherit", fontWeight: 500 },
  cancelButton: { minHeight: "44px", marginTop: 0, padding: "0 16px", borderRadius: "10px", border: "1px solid #d9e0ea", background: "white", color: "#172033", cursor: "pointer", font: "inherit", fontWeight: 500 },
  iconButton: { width: "38px", height: "38px", borderRadius: "9px", border: "1px solid #d9e0ea", background: "white", cursor: "pointer" },
  dangerButton: { minHeight: "38px", padding: "0 12px", borderRadius: "9px", border: "1px solid #c53030", background: "#fff5f5", color: "#c53030", cursor: "pointer", font: "inherit", fontWeight: 500 },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "20px", background: "rgba(15, 23, 42, 0.48)" },
  modal: { width: "min(620px, 100%)", maxHeight: "min(760px, calc(100vh - 40px))", display: "grid", gap: "16px", padding: "20px", overflowY: "auto", borderRadius: "16px", background: "white", boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" },
  modalCloseButton: { width: "36px", height: "36px", flex: "0 0 auto", border: "1px solid #d9e0ea", borderRadius: "9px", background: "white", color: "#526071", cursor: "pointer", fontSize: "22px", lineHeight: 1 },
  pasteTargetList: { display: "grid", gap: "8px" },
  pasteTarget: { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", alignItems: "start", gap: "10px", padding: "12px", border: "1px solid #d9e0ea", borderRadius: "10px", background: "#f8fafc", cursor: "pointer" },
  pasteTargetDetail: { display: "block", marginTop: "3px", color: "#637083", fontWeight: 400 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px", borderTop: "1px solid #e5e7eb" },
};
