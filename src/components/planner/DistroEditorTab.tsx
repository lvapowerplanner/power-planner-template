import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import {
  autoSourcesForDistro,
  autoSourceId,
  effectiveDistroSupplyCap,
} from "@/planner/autoSources";
import {
  distroPhaseLoads as calculatedDistroPhaseLoads,
  distroWatts as calculatedDistroWatts,
  outputPhaseLoads as calculatedOutputPhaseLoads,
  outputWatts as calculatedOutputWatts,
} from "@/planner/calculations";
import { useCompanyEquipmentLibrary } from "@/planner/companyStock";
import type {
  EquipmentItem,
  PlannerOutput,
  PlannerOutputItem,
  PlannerState,
  PowerSource,
  ProjectDistro,
} from "@/planner/types";

type DistroEditorTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  goToDistroOverview: () => void;
};

type DraggedEquipment =
  | {
      type: "library";
      equipmentId: string;
    }
  | {
      type: "assigned-item";
      itemId: string;
      sourceOutputId: string;
      sourceSocapexOutputId?: string;
    };

type PhaseLoads = {
  L1: number;
  L2: number;
  L3: number;
};

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function displayDistroName(distro: ProjectDistro) {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

function outputTitle(output: PlannerOutput, index: number) {
  if (output.displayName) return output.displayName;
  if (output.phase === "Socapex") return `Soca ${output.outputNumber ?? index + 1}`;
  if (output.phase === "3Φ") return `${index + 1} - ${output.rating}/3`;
  return `${index + 1} - ${output.rating}a`;
}

function socapexSocketTitle(socket: PlannerOutput) {
  return socket.label;
}

function outputWatts(output: PlannerOutput) {
  return output.items.reduce(
    (total, item) => total + item.watts * item.quantity,
    0
  );
}

function outputAmps(output: PlannerOutput) {
  return outputWatts(output) / 230;
}

function threePhaseAmps(output: PlannerOutput) {
  return outputAmps(output) / 3;
}

function outputUsagePercent(output: PlannerOutput, threePhase = false) {
  const amps = threePhase ? threePhaseAmps(output) : outputAmps(output);
  if (!output.rating) return 0;
  return Math.round((amps / output.rating) * 100);
}

type OutputCapacityOverride = {
  watts: number;
  amps: number;
  rating: number;
  percent: number;
  label: string;
};

function groupedSocapexBreakerOutputs(outputs: PlannerOutput[]) {
  const groups = new Map<string, PlannerOutput[]>();

  outputs.forEach((output) => {
    const breakerPair = output.breakerPair?.trim();

    if (!breakerPair) return;

    groups.set(breakerPair, [...(groups.get(breakerPair) ?? []), output]);
  });

  return Array.from(groups.entries())
    .map(([breakerPair, pairedOutputs]) => ({
      breakerPair,
      outputs: pairedOutputs.sort(
        (a, b) => (a.outputNumber ?? 0) - (b.outputNumber ?? 0)
      ),
    }))
    .filter((group) => group.outputs.length > 1);
}

function sharedSocapexBreakerCapacity(
  breakerPair: string,
  pairedOutputs: PlannerOutput[],
  socket: PlannerOutput
): OutputCapacityOverride | undefined {
  if (!socket.circuitNo) return undefined;

  const pairedSockets = pairedOutputs.flatMap((output) =>
    (output.socaCircuits ?? []).filter(
      (candidate) =>
        candidate.phase === socket.phase &&
        candidate.circuitNo === socket.circuitNo
    )
  );

  if (pairedSockets.length < 2) return undefined;

  const watts = pairedSockets.reduce(
    (total, pairedSocket) => total + outputWatts(pairedSocket),
    0
  );
  const amps = watts / 230;
  const rating = socket.rating || 16;

  return {
    watts,
    amps,
    rating,
    percent: rating ? Math.round((amps / rating) * 100) : 0,
    label: `Shared breaker ${breakerPair} · Circuit ${socket.circuitNo}`,
  };
}

function formatWatts(value: number) {
  return `${Math.round(value).toLocaleString()} W`;
}

function formatAmps(value: number) {
  return `${value.toFixed(1)} A`;
}

function createOutputItem(equipment: EquipmentItem): PlannerOutputItem {
  return {
    id: createId("item"),
    name: equipment.name,
    watts: equipment.watts,
    quantity: 1,
    notes: "",
  };
}

function libraryDragPayload(equipmentId: string): string {
  return JSON.stringify({
    type: "library",
    equipmentId,
  } satisfies DraggedEquipment);
}

function assignedItemDragPayload(
  itemId: string,
  sourceOutputId: string,
  sourceSocapexOutputId?: string
): string {
  return JSON.stringify({
    type: "assigned-item",
    itemId,
    sourceOutputId,
    sourceSocapexOutputId,
  } satisfies DraggedEquipment);
}

function readDragPayload(event: DragEvent): DraggedEquipment | null {
  const json = event.dataTransfer.getData("application/json");
  const text = event.dataTransfer.getData("text/plain");
  const raw = json || text;

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DraggedEquipment;

    if (parsed.type === "library" && parsed.equipmentId) return parsed;

    if (
      parsed.type === "assigned-item" &&
      parsed.itemId &&
      parsed.sourceOutputId
    ) {
      return parsed;
    }

    return null;
  } catch {
    if (raw.startsWith("equipment:")) {
      return {
        type: "library",
        equipmentId: raw.replace("equipment:", ""),
      };
    }

    return null;
  }
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

function connectionsAreCompatible(sourceConnection: string, distroInput: string) {
  const source = normaliseConnection(sourceConnection);
  const distro = normaliseConnection(distroInput);

  if (
    source.phase === "3" &&
    distro.phase === "3" &&
    source.highCurrentThreePhase &&
    distro.highCurrentThreePhase
  ) {
    return source.rating <= distro.rating;
  }

  return source.phase === distro.phase && source.rating === distro.rating;
}

function sourceIsUsedByOtherDistro(
  plannerState: PlannerState,
  sourceId: string,
  activeDistroId: string
) {
  return plannerState.distros.some(
    (distro) => distro.id !== activeDistroId && distro.sourceId === sourceId
  );
}

function sourceBelongsToDistroOwnOutput(source: PowerSource, distroId: string) {
  return source.auto && source.parentDistroId === distroId;
}

function isDownstreamOf(
  plannerState: PlannerState,
  possibleParentId: string,
  possibleChildId: string
): boolean {
  const possibleParent = plannerState.distros.find(
    (distro) => distro.id === possibleParentId
  );

  if (!possibleParent) return false;

  return possibleParent.outputs.some((output) => {
    const sourceId = autoSourceId(possibleParent.id, output.id);
    const child = plannerState.distros.find(
      (distro) => distro.sourceId === sourceId
    );

    if (!child) return false;
    if (child.id === possibleChildId) return true;

    return isDownstreamOf(plannerState, child.id, possibleChildId);
  });
}

function outputSourceConnection(output: PlannerOutput) {
  return output.phase === "3Φ"
    ? `${output.rating}A / 3`
    : `${output.rating}A / 1`;
}

function emptyPhaseLoads(): PhaseLoads {
  return { L1: 0, L2: 0, L3: 0 };
}

function addPhaseLoads(a: PhaseLoads, b: PhaseLoads): PhaseLoads {
  return {
    L1: a.L1 + b.L1,
    L2: a.L2 + b.L2,
    L3: a.L3 + b.L3,
  };
}

function outputPhaseLoads(output: PlannerOutput): PhaseLoads {
  const amps = outputAmps(output);

  if (output.phase === "L1") return { L1: amps, L2: 0, L3: 0 };
  if (output.phase === "L2") return { L1: 0, L2: amps, L3: 0 };
  if (output.phase === "L3") return { L1: 0, L2: 0, L3: amps };

  if (output.phase === "3Φ") {
    const perPhase = amps / 3;
    return { L1: perPhase, L2: perPhase, L3: perPhase };
  }

  if (output.phase === "Socapex") {
    return (output.socaCircuits ?? []).reduce<PhaseLoads>(
      (total, socket) => addPhaseLoads(total, outputPhaseLoads(socket)),
      emptyPhaseLoads()
    );
  }

  return emptyPhaseLoads();
}

function distroPhaseLoads(distro: ProjectDistro): PhaseLoads {
  const loads = distro.outputs.reduce<PhaseLoads>(
    (total, output) => addPhaseLoads(total, outputPhaseLoads(output)),
    emptyPhaseLoads()
  );

  return normaliseConnection(distro.input).phase === "3"
    ? loads
    : { L1: loads.L1 + loads.L2 + loads.L3, L2: 0, L3: 0 };
}

function supportsDownstreamDistroFeed(output: PlannerOutput) {
  if (output.phase === "Socapex") return false;
  if (output.phase === "3Φ") return output.rating >= 16;
  return output.rating >= 32;
}

export function DistroEditorTab({
  plannerState,
  setPlannerState,
  goToDistroOverview,
}: DistroEditorTabProps) {
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentCategory, setEquipmentCategory] = useState("");
  const [stickyUpstreamExpanded, setStickyUpstreamExpanded] = useState(false);
  const [stickyDownstreamExpanded, setStickyDownstreamExpanded] = useState(false);
  const [draggingEquipmentId, setDraggingEquipmentId] = useState<string | null>(
    null
  );
  const [draggingAssignedItem, setDraggingAssignedItem] = useState<{
    itemId: string;
    sourceOutputId: string;
    sourceSocapexOutputId?: string;
  } | null>(null);

  const { equipmentLibrary } = useCompanyEquipmentLibrary();

  const activeDistro =
    plannerState.distros.find((distro) => distro.id === plannerState.active) ??
    plannerState.distros[0];

  const equipmentOptions = useMemo(
    () =>
      [...equipmentLibrary, ...plannerState.customEquipment].sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      ),
    [equipmentLibrary, plannerState.customEquipment]
  );

  const equipmentCategories = useMemo(
    () =>
      Array.from(new Set(equipmentOptions.map((item) => item.category))).sort(),
    [equipmentOptions]
  );

  const filteredEquipment = equipmentOptions.filter((item) => {
    const matchesCategory = equipmentCategory
      ? item.category === equipmentCategory
      : true;

    const search = equipmentSearch.trim().toLowerCase();

    const matchesSearch = search
      ? `${item.category} ${item.name}`.toLowerCase().includes(search)
      : true;

    return matchesCategory && matchesSearch;
  });

  const allDerivedSources = [
    ...plannerState.sources.filter((source) => !source.auto),
    ...plannerState.distros.flatMap((distro) =>
      autoSourcesForDistro(distro, plannerState),
    ),
  ];

  function updateDistro(updatedDistro: ProjectDistro) {
    setPlannerState({
      ...plannerState,
      active: updatedDistro.id,
      distros: plannerState.distros.map((distro) =>
        distro.id === updatedDistro.id ? updatedDistro : distro
      ),
    });
  }

  function updateOutput(
    outputId: string,
    updateFunction: (output: PlannerOutput) => PlannerOutput
  ) {
    if (!activeDistro) return;

    updateDistro({
      ...activeDistro,
      outputs: activeDistro.outputs.map((output) =>
        output.id === outputId ? updateFunction(output) : output
      ),
    });
  }

  function updateSocapexSocket(
    socapexOutputId: string,
    socketId: string,
    updateFunction: (socket: PlannerOutput) => PlannerOutput
  ) {
    if (!activeDistro) return;

    updateDistro({
      ...activeDistro,
      outputs: activeDistro.outputs.map((output) => {
        if (output.id !== socapexOutputId) return output;

        return {
          ...output,
          socaCircuits: output.socaCircuits?.map((socket) =>
            socket.id === socketId ? updateFunction(socket) : socket
          ),
        };
      }),
    });
  }

  function updateOutputNotes(outputId: string, notes: string) {
    updateOutput(outputId, (output) => ({ ...output, notes }));
  }

  function updateSocapexSocketNotes(
    socapexOutputId: string,
    socketId: string,
    notes: string
  ) {
    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      notes,
    }));
  }

  function addEquipmentToOutput(outputId: string, equipmentId: string) {
    const equipment = equipmentOptions.find((item) => item.id === equipmentId);
    if (!equipment) return;

    updateOutput(outputId, (output) => ({
      ...output,
      items: [...output.items, createOutputItem(equipment)],
    }));
  }

  function addEquipmentToSocapexSocket(
    socapexOutputId: string,
    socketId: string,
    equipmentId: string
  ) {
    const equipment = equipmentOptions.find((item) => item.id === equipmentId);
    if (!equipment) return;

    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      items: [...socket.items, createOutputItem(equipment)],
    }));
  }

  function updateOutputItemQuantity(
    outputId: string,
    itemId: string,
    quantity: number
  ) {
    const safeQuantity = Math.max(1, quantity || 1);

    updateOutput(outputId, (output) => ({
      ...output,
      items: output.items.map((item) =>
        item.id === itemId ? { ...item, quantity: safeQuantity } : item
      ),
    }));
  }

  function updateSocapexSocketItemQuantity(
    socapexOutputId: string,
    socketId: string,
    itemId: string,
    quantity: number
  ) {
    const safeQuantity = Math.max(1, quantity || 1);

    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      items: socket.items.map((item) =>
        item.id === itemId ? { ...item, quantity: safeQuantity } : item
      ),
    }));
  }

  function updateOutputItemNotes(
    outputId: string,
    itemId: string,
    notes: string
  ) {
    updateOutput(outputId, (output) => ({
      ...output,
      items: output.items.map((item) =>
        item.id === itemId ? { ...item, notes } : item
      ),
    }));
  }

  function updateSocapexSocketItemNotes(
    socapexOutputId: string,
    socketId: string,
    itemId: string,
    notes: string
  ) {
    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      items: socket.items.map((item) =>
        item.id === itemId ? { ...item, notes } : item
      ),
    }));
  }

  function removeOutputItem(outputId: string, itemId: string) {
    updateOutput(outputId, (output) => ({
      ...output,
      items: output.items.filter((item) => item.id !== itemId),
    }));
  }

  function removeSocapexSocketItem(
    socapexOutputId: string,
    socketId: string,
    itemId: string
  ) {
    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      items: socket.items.filter((item) => item.id !== itemId),
    }));
  }

  function handleDragStart(event: DragEvent, equipmentId: string) {
    const jsonPayload = libraryDragPayload(equipmentId);

    event.stopPropagation();
    event.dataTransfer.clearData();
    event.dataTransfer.setData("application/json", jsonPayload);
    event.dataTransfer.setData("text/plain", jsonPayload);
    event.dataTransfer.effectAllowed = "copyMove";

    setDraggingEquipmentId(equipmentId);
    setDraggingAssignedItem(null);
  }
  function handleDragEnd() {
    setDraggingEquipmentId(null);
    setDraggingAssignedItem(null);
  }

  function handleAssignedItemDragStart(
    event: DragEvent,
    itemId: string,
    sourceOutputId: string,
    sourceSocapexOutputId?: string
  ) {
    const target = event.target as HTMLElement;

    if (target.closest("input, textarea, select, button")) {
      event.preventDefault();
      return;
    }

    const jsonPayload = assignedItemDragPayload(
      itemId,
      sourceOutputId,
      sourceSocapexOutputId
    );

    setDraggingAssignedItem({
      itemId,
      sourceOutputId,
      sourceSocapexOutputId,
    });

    event.stopPropagation();
    event.dataTransfer.clearData();
    event.dataTransfer.setData("application/json", jsonPayload);
    event.dataTransfer.setData("text/plain", jsonPayload);
    event.dataTransfer.effectAllowed = "move";
  }

function findAssignedItem(
  sourceOutputId: string,
  itemId: string,
  sourceSocapexOutputId?: string
): PlannerOutputItem | null {
  if (!activeDistro) return null;

  if (sourceSocapexOutputId) {
    const socapexOutput = activeDistro.outputs.find(
      (output) => output.id === sourceSocapexOutputId
    );

    const socket = socapexOutput?.socaCircuits?.find(
      (item) => item.id === sourceOutputId
    );

    return socket?.items.find((item) => item.id === itemId) ?? null;
  }

  const output = activeDistro.outputs.find(
    (item) => item.id === sourceOutputId
  );

  return output?.items.find((item) => item.id === itemId) ?? null;
}

function removeAssignedItemFromSource(
  sourceOutputId: string,
  itemId: string,
  sourceSocapexOutputId?: string
) {
  if (sourceSocapexOutputId) {
    removeSocapexSocketItem(sourceSocapexOutputId, sourceOutputId, itemId);
    return;
  }

  removeOutputItem(sourceOutputId, itemId);
}

function moveAssignedItemToOutput(
  targetOutputId: string,
  payload: Extract<DraggedEquipment, { type: "assigned-item" }>
) {
  if (!activeDistro) return;

  const movedItem = findAssignedItem(
    payload.sourceOutputId,
    payload.itemId,
    payload.sourceSocapexOutputId
  );

  if (!movedItem) return;

  if (!payload.sourceSocapexOutputId && payload.sourceOutputId === targetOutputId) {
    return;
  }

  setPlannerState({
    ...plannerState,
    distros: plannerState.distros.map((distro) => {
      if (distro.id !== activeDistro.id) return distro;

      return {
        ...distro,
        outputs: distro.outputs.map((output) => {
          const isSource =
            !payload.sourceSocapexOutputId &&
            output.id === payload.sourceOutputId;

          const isTarget = output.id === targetOutputId;

          if (!isSource && !isTarget) return output;

          return {
            ...output,
            items: [
              ...output.items.filter((item) => item.id !== payload.itemId),
              ...(isTarget ? [movedItem] : []),
            ],
          };
        }),
      };
    }),
  });
}

function moveAssignedItemToSocapexSocket(
  targetSocapexOutputId: string,
  targetSocketId: string,
  payload: Extract<DraggedEquipment, { type: "assigned-item" }>
) {
  if (!activeDistro) return;

  const movedItem = findAssignedItem(
    payload.sourceOutputId,
    payload.itemId,
    payload.sourceSocapexOutputId
  );

  if (!movedItem) return;

  if (
    payload.sourceSocapexOutputId === targetSocapexOutputId &&
    payload.sourceOutputId === targetSocketId
  ) {
    return;
  }

  setPlannerState({
    ...plannerState,
    distros: plannerState.distros.map((distro) => {
      if (distro.id !== activeDistro.id) return distro;

      return {
        ...distro,
        outputs: distro.outputs.map((output) => {
          if (output.id === targetSocapexOutputId) {
            return {
              ...output,
              socaCircuits: output.socaCircuits?.map((socket) => {
                const isTargetSocket = socket.id === targetSocketId;
                const isSourceSocket =
                  payload.sourceSocapexOutputId === targetSocapexOutputId &&
                  socket.id === payload.sourceOutputId;

                if (!isTargetSocket && !isSourceSocket) return socket;

                return {
                  ...socket,
                  items: [
                    ...socket.items.filter((item) => item.id !== payload.itemId),
                    ...(isTargetSocket ? [movedItem] : []),
                  ],
                };
              }),
            };
          }

          if (!payload.sourceSocapexOutputId && output.id === payload.sourceOutputId) {
            return {
              ...output,
              items: output.items.filter((item) => item.id !== payload.itemId),
            };
          }

          return output;
        }),
      };
    }),
  });
}

  function handleOutputDrop(event: DragEvent, outputId: string) {
    event.preventDefault();
    event.stopPropagation();

    const payload = readDragPayload(event);

    const assignedPayload =
      payload?.type === "assigned-item"
        ? payload
        : draggingAssignedItem
          ? {
              type: "assigned-item" as const,
              itemId: draggingAssignedItem.itemId,
              sourceOutputId: draggingAssignedItem.sourceOutputId,
              sourceSocapexOutputId: draggingAssignedItem.sourceSocapexOutputId,
            }
          : null;

    if (assignedPayload) {
      moveAssignedItemToOutput(outputId, assignedPayload);
      setDraggingAssignedItem(null);
      return;
    }

    const equipmentId =
      payload?.type === "library" ? payload.equipmentId : draggingEquipmentId;

    if (!equipmentId) return;

    addEquipmentToOutput(outputId, equipmentId);
    setDraggingEquipmentId(null);
    setDraggingAssignedItem(null);
  }

  function handleSocapexSocketDrop(
    event: DragEvent,
    socapexOutputId: string,
    socketId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const payload = readDragPayload(event);

    const assignedPayload =
      payload?.type === "assigned-item"
        ? payload
        : draggingAssignedItem
          ? {
              type: "assigned-item" as const,
              itemId: draggingAssignedItem.itemId,
              sourceOutputId: draggingAssignedItem.sourceOutputId,
              sourceSocapexOutputId: draggingAssignedItem.sourceSocapexOutputId,
            }
          : null;

    if (assignedPayload) {
      moveAssignedItemToSocapexSocket(socapexOutputId, socketId, assignedPayload);
      setDraggingAssignedItem(null);
      return;
    }

    const equipmentId =
      payload?.type === "library" ? payload.equipmentId : draggingEquipmentId;

    if (!equipmentId) return;

    addEquipmentToSocapexSocket(socapexOutputId, socketId, equipmentId);
    setDraggingEquipmentId(null);
    setDraggingAssignedItem(null);
  }

  function compatibleDownstreamDistros(output: PlannerOutput) {
    if (!activeDistro) return [];
    if (output.phase === "Socapex") return [];

    const sourceConn = outputSourceConnection(output);
    const sourceId = autoSourceId(activeDistro.id, output.id);

    return plannerState.distros.filter((distro) => {
      if (distro.id === activeDistro.id) return false;

      const compatible = connectionsAreCompatible(sourceConn, distro.input);

      if (!compatible) return false;

      if (distro.sourceId && distro.sourceId !== sourceId) return false;

      const wouldCreateLoop = isDownstreamOf(
        plannerState,
        distro.id,
        activeDistro.id
      );

      return !wouldCreateLoop;
    });
  }

  function currentFedDistroId(output: PlannerOutput) {
    if (!activeDistro) return "";

    const sourceId = autoSourceId(activeDistro.id, output.id);

    return (
      plannerState.distros.find((distro) => distro.sourceId === sourceId)?.id ??
      ""
    );
  }

  function feedDistroFromOutput(output: PlannerOutput, childDistroId: string) {
    if (!activeDistro) return;

    const sourceId = autoSourceId(activeDistro.id, output.id);

    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) => {
        const currentlyFedFromThisOutput = distro.sourceId === sourceId;

        if (currentlyFedFromThisOutput) {
          return { ...distro, sourceId: "" };
        }

        if (distro.id === childDistroId) {
          return { ...distro, sourceId };
        }

        return distro;
      }),
    });
  }

  function removeDistroFeedFromOutput(output: PlannerOutput) {
    if (!activeDistro) return;

    const sourceId = autoSourceId(activeDistro.id, output.id);

    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.sourceId === sourceId ? { ...distro, sourceId: "" } : distro
      ),
    });
  }

  function changeActiveDistro(distroId: string) {
    setDraggingEquipmentId(null);
    setDraggingAssignedItem(null);

    setPlannerState({
      ...plannerState,
      active: distroId,
    });
  }

  if (!activeDistro) {
    return (
      <section style={styles.card}>
        <h2>Distro Editor</h2>
        <p style={styles.muted}>No distro selected.</p>
        <button style={styles.button} onClick={goToDistroOverview}>
          Go to Distro Overview
        </button>
      </section>
    );
  }

  const availableSources = allDerivedSources.filter((source) => {
    const compatible = connectionsAreCompatible(source.conn, activeDistro.input);

    if (!compatible) return false;

    if (sourceBelongsToDistroOwnOutput(source, activeDistro.id)) return false;

    if (
      source.id !== activeDistro.sourceId &&
      sourceIsUsedByOtherDistro(plannerState, source.id, activeDistro.id)
    ) {
      return false;
    }

    return true;
  });

  const phaseCap = effectiveDistroSupplyCap(plannerState, activeDistro);

  const singlePhaseOutputs = activeDistro.outputs.filter(
    (output) => output.phase !== "3Φ" && output.phase !== "Socapex"
  );

  const socapexOutputs = activeDistro.outputs.filter(
    (output) => output.phase === "Socapex"
  );

  const pairedSocapexGroups = groupedSocapexBreakerOutputs(socapexOutputs);
  const pairedSocapexOutputIds = new Set(
    pairedSocapexGroups.flatMap((group) =>
      group.outputs.map((output) => output.id)
    )
  );
  const standardSocapexOutputs = socapexOutputs.filter(
    (output) => !pairedSocapexOutputIds.has(output.id)
  );

  const threePhaseOutputs = activeDistro.outputs.filter(
    (output) => output.phase === "3Φ"
  );

  const totalWatts = calculatedDistroWatts(activeDistro, plannerState);
  const phaseLoads = calculatedDistroPhaseLoads(activeDistro, plannerState);
  const upstreamDistros = (() => {
    const upstream: Array<{
      distro: ProjectDistro;
      loads: PhaseLoads;
      rating: number;
      capped: boolean;
    }> = [];
    const visited = new Set<string>([activeDistro.id]);
    let currentDistro: ProjectDistro | undefined = activeDistro;

    while (currentDistro) {
      const source = allDerivedSources.find(
        (candidate) => candidate.id === currentDistro?.sourceId,
      );
      if (!source?.auto || !source.parentDistroId) break;

      const upstreamDistro = plannerState.distros.find(
        (candidate) => candidate.id === source.parentDistroId,
      );
      if (!upstreamDistro || visited.has(upstreamDistro.id)) break;

      visited.add(upstreamDistro.id);
      const cap = effectiveDistroSupplyCap(plannerState, upstreamDistro);
      upstream.push({
        distro: upstreamDistro,
        loads: calculatedDistroPhaseLoads(upstreamDistro, plannerState),
        rating: cap.rating,
        capped: cap.capped,
      });
      currentDistro = upstreamDistro;
    }

    return upstream;
  })();
  const downstreamDistros = (() => {
    const downstream: Array<{
      distro: ProjectDistro;
      loads: PhaseLoads;
      rating: number;
      capped: boolean;
    }> = [];
    const visited = new Set<string>([activeDistro.id]);

    function appendChildren(parentDistroId: string) {
      const childSourceIds = new Set(
        allDerivedSources
          .filter(
            (source) =>
              source.auto && source.parentDistroId === parentDistroId,
          )
          .map((source) => source.id),
      );

      plannerState.distros
        .filter(
          (candidate) =>
            childSourceIds.has(candidate.sourceId) && !visited.has(candidate.id),
        )
        .forEach((childDistro) => {
          visited.add(childDistro.id);
          const cap = effectiveDistroSupplyCap(plannerState, childDistro);
          downstream.push({
            distro: childDistro,
            loads: calculatedDistroPhaseLoads(childDistro, plannerState),
            rating: cap.rating,
            capped: cap.capped,
          });
          appendChildren(childDistro.id);
        });
    }

    appendChildren(activeDistro.id);
    return downstream;
  })();

  return (
    <section style={styles.editorLayout}>
      <aside style={styles.sidebar}>
        <h2>Equipment Library</h2>
        <p style={styles.muted}>
          Drag equipment onto a drop zone, or use the dropdowns inside each output.
        </p>

        <label style={styles.label}>
          Search
          <input
            style={styles.input}
            value={equipmentSearch}
            onChange={(event) => setEquipmentSearch(event.target.value)}
            placeholder="Search equipment"
          />
        </label>

        <label style={styles.label}>
          Category
          <select
            style={styles.input}
            value={equipmentCategory}
            onChange={(event) => setEquipmentCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {equipmentCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <div style={styles.equipmentList}>
          {filteredEquipment.length === 0 ? (
            <p style={styles.muted}>No equipment found.</p>
          ) : (
            filteredEquipment.map((item) => (
              <div
                key={item.id}
                style={{
                  ...styles.equipmentCard,
                  ...(draggingEquipmentId === item.id
                    ? styles.equipmentCardDragging
                    : {}),
                }}
                draggable
                onDragStart={(event) => handleDragStart(event, item.id)}
                onDragEnd={handleDragEnd}
              >
                <strong>{item.name}</strong>
                <p style={styles.muted}>
                  {item.category} · {item.watts}W
                </p>
              </div>
            ))
          )}
        </div>
      </aside>

      <main style={styles.mainPanel}>
        <div style={styles.headerRow}>
          <div>
            <h2>Distro Editor</h2>
            <p style={styles.muted}>{displayDistroName(activeDistro)}</p>
          </div>

          <div style={styles.editorHeaderActions}>
            <label style={styles.editorSelectLabel}>
              Editing Distro
              <select
                style={styles.editorSelect}
                value={activeDistro.id}
                onChange={(event) => changeActiveDistro(event.target.value)}
              >
                {plannerState.distros.map((distro) => (
                  <option key={distro.id} value={distro.id}>
                    {displayDistroName(distro)}
                  </option>
                ))}
              </select>
            </label>

            <button style={styles.secondaryButton} onClick={goToDistroOverview}>
              Back to Distro Overview
            </button>
          </div>
        </div>

        <hr style={styles.divider} />

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span>Total Load </span>
            <strong>{formatWatts(totalWatts)}</strong>
          </div>

          <div style={styles.summaryCard}>
            <span>Input </span>
            <strong>{activeDistro.input}</strong>
          </div>

          <div style={styles.summaryCard}>
            <span>Outputs </span>
            <strong>{activeDistro.outputs.length}</strong>
          </div>

          {phaseCap.capped && (
            <div style={{ ...styles.summaryCard, ...styles.summaryCardCapped }}>
              <span>Phase Cap </span>
              <strong>{formatAmps(phaseCap.rating)}</strong>
              <small style={styles.capNotice}>Capped by {phaseCap.sourceName}</small>
            </div>
          )}
        </div>

        {phaseCap.capped && (
          <div style={styles.capBanner}>
            This distro input is {activeDistro.input}, but it is currently capped to {formatAmps(phaseCap.rating)} per phase by the selected source.
          </div>
        )}

        <div style={styles.stickyPhaseDraws}>
          <div style={styles.stickyPhaseHeading}>
            <strong>Phase draw</strong>
            <div style={styles.stickyPhaseHeadingActions}>
              {upstreamDistros.length > 0 && (
                <button
                  type="button"
                  style={styles.stickyUpstreamButton}
                  onClick={() =>
                    setStickyUpstreamExpanded((expanded) => !expanded)
                  }
                  aria-expanded={stickyUpstreamExpanded}
                >
                  {stickyUpstreamExpanded
                    ? "Hide upstream distros ▴"
                    : "Show upstream distros ▾"}
                </button>
              )}
              {downstreamDistros.length > 0 && (
                <button
                  type="button"
                  style={styles.stickyUpstreamButton}
                  onClick={() =>
                    setStickyDownstreamExpanded((expanded) => !expanded)
                  }
                  aria-expanded={stickyDownstreamExpanded}
                >
                  {stickyDownstreamExpanded
                    ? "Hide downstream distros ▴"
                    : "Show downstream distros ▾"}
                </button>
              )}
            </div>
          </div>
          {stickyUpstreamExpanded && upstreamDistros.length > 0 && (
            <div style={styles.stickyUpstreamList}>
              {[...upstreamDistros].reverse().map((upstream) => (
                <div key={upstream.distro.id} style={styles.stickyUpstreamRow}>
                  <button
                    type="button"
                    style={styles.stickyDistroLink}
                    onClick={() => changeActiveDistro(upstream.distro.id)}
                  >
                    {displayDistroName(upstream.distro)}
                  </button>
                  <CompactPhaseCapacity
                    loads={upstream.loads}
                    rating={upstream.rating}
                    capped={upstream.capped}
                  />
                </div>
              ))}
            </div>
          )}
          <div style={styles.currentPhaseHeading}>
            <button
              type="button"
              style={styles.stickyDistroLink}
              onClick={() => changeActiveDistro(activeDistro.id)}
            >
              {displayDistroName(activeDistro)}
            </button>
          </div>
          <PhaseCapacityGrid
            loads={phaseLoads}
            rating={phaseCap.rating}
            capped={phaseCap.capped}
          />
          {stickyDownstreamExpanded && downstreamDistros.length > 0 && (
            <div style={styles.stickyDownstreamList}>
              {downstreamDistros.map((downstream) => (
                <div key={downstream.distro.id} style={styles.stickyUpstreamRow}>
                  <button
                    type="button"
                    style={styles.stickyDistroLink}
                    onClick={() => changeActiveDistro(downstream.distro.id)}
                  >
                    {displayDistroName(downstream.distro)}
                  </button>
                  <CompactPhaseCapacity
                    loads={downstream.loads}
                    rating={downstream.rating}
                    capped={downstream.capped}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.controlsGrid}>
          <label style={styles.label}>
            Distro Name
            <input
              style={styles.input}
              value={activeDistro.instanceName}
              onChange={(event) =>
                updateDistro({
                  ...activeDistro,
                  instanceName: event.target.value,
                })
              }
              placeholder="Optional name"
            />
          </label>

          <label style={styles.label}>
            Location
            <input
              style={styles.input}
              value={activeDistro.location}
              onChange={(event) =>
                updateDistro({
                  ...activeDistro,
                  location: event.target.value,
                })
              }
              placeholder="e.g. Stage Left"
            />
          </label>

          <label style={styles.label}>
            Source
            <select
              style={styles.input}
              value={activeDistro.sourceId}
              onChange={(event) =>
                updateDistro({
                  ...activeDistro,
                  sourceId: event.target.value,
                })
              }
            >
              <option value="">No source selected</option>
              {availableSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.auto ? "Auto: " : ""}
                  {source.name} — {source.conn}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={styles.label}>
          Distro Notes
          <textarea
            style={styles.textarea}
            value={activeDistro.notes}
            onChange={(event) =>
              updateDistro({
                ...activeDistro,
                notes: event.target.value,
              })
            }
            placeholder="Notes for this distro"
          />
        </label>

        {singlePhaseOutputs.length > 0 && (
          <section style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>Single Phase Outputs</h3>

            <div style={styles.phaseGrid}>
              {(["L1", "L2", "L3"] as const).map((phase) => {
                const phaseOutputs = singlePhaseOutputs.filter(
                  (output) => output.phase === phase
                );

                if (phaseOutputs.length === 0) return null;

                return (
                  <div key={phase} style={styles.phaseColumn}>
                    <h4 style={styles.phaseTitle}>{phase}</h4>

                    <div style={styles.outputList}>
                      {phaseOutputs.map((output) => {
                        const outputIndex = activeDistro.outputs.findIndex(
                          (item) => item.id === output.id
                        );

                        return (
                          <OutputCard
                            key={output.id}
                            output={output}
                            title={outputTitle(output, outputIndex)}
                            equipmentOptions={equipmentOptions}
                            compatibleDownstreamDistros={compatibleDownstreamDistros(output)}
                            currentFedDistroId={currentFedDistroId(output)}
                            calculatedWatts={calculatedOutputWatts(output, plannerState, activeDistro)}
                            calculatedPhaseLoads={calculatedOutputPhaseLoads(output, plannerState, activeDistro)}
                            allowDownstreamFeed={supportsDownstreamDistroFeed(output)}
                            onOpenDownstream={changeActiveDistro}
                            onFeedDistro={(childDistroId) =>
                              childDistroId
                                ? feedDistroFromOutput(output, childDistroId)
                                : removeDistroFeedFromOutput(output)
                            }
                            onDrop={(event) => handleOutputDrop(event, output.id)}
                            addEquipment={(equipmentId) =>
                              addEquipmentToOutput(output.id, equipmentId)
                            }
                            updateQuantity={(itemId, quantity) =>
                              updateOutputItemQuantity(output.id, itemId, quantity)
                            }
                            updateItemNotes={(itemId, notes) =>
                              updateOutputItemNotes(output.id, itemId, notes)
                            }
                            onAssignedItemDragStart={(event, itemId) =>
                              handleAssignedItemDragStart(event, itemId, output.id)
                            }
                            onAssignedItemDragEnd={handleDragEnd}
                            removeItem={(itemId) => removeOutputItem(output.id, itemId)}
                            updateNotes={(notes) => updateOutputNotes(output.id, notes)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {socapexOutputs.length > 0 && (
          <section style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>Socapex Outputs</h3>

            <div style={styles.socapexList}>
              {pairedSocapexGroups.map((group) => (
                <div key={group.breakerPair} style={styles.pairedSocapexGroup}>
                  <div style={styles.pairedSocapexHeader}>
                    <div>
                      <strong>Shared Breaker Pair {group.breakerPair}</strong>
                      <p style={styles.muted}>
                        Matching Socapex circuit numbers in this pair share one 16A breaker.
                      </p>
                    </div>
                    <span style={styles.pill}>Linked capacity</span>
                  </div>

                  <div style={styles.pairedSocapexOutputs}>
                    {group.outputs.map((output) => {
                      const outputIndex = activeDistro.outputs.findIndex(
                        (item) => item.id === output.id
                      );

                      return (
                        <div key={output.id} style={styles.socapexCard}>
                          <div style={styles.outputHeader}>
                            <strong>{outputTitle(output, outputIndex)}</strong>
                            <span style={styles.pill}>Socapex</span>
                          </div>

                          {output.detail && <p style={styles.muted}>{output.detail}</p>}

                          <label style={styles.smallLabel}>
                            Socapex Output Notes
                            <textarea
                              style={styles.smallTextarea}
                              value={output.notes ?? ""}
                              onChange={(event) =>
                                updateOutputNotes(output.id, event.target.value)
                              }
                            />
                          </label>

                          <div style={styles.socapexSocketGrid}>
                            {(["L1", "L2", "L3"] as const).map((phase) => {
                              const sockets = (output.socaCircuits ?? [])
                                .filter((socket) => socket.phase === phase)
                                .sort(
                                  (a, b) => (a.circuitNo ?? 0) - (b.circuitNo ?? 0)
                                );

                              return (
                                <div key={phase} style={styles.socapexPhaseColumn}>
                                  <h4 style={styles.phaseTitle}>{phase}</h4>

                                  <div style={styles.outputList}>
                                    {sockets.map((socket) => (
                                      <OutputCard
                                        key={socket.id}
                                        output={socket}
                                        title={socapexSocketTitle(socket)}
                                        equipmentOptions={equipmentOptions}
                                        compatibleDownstreamDistros={[]}
                                        currentFedDistroId=""
                                        capacityOverride={sharedSocapexBreakerCapacity(
                                          group.breakerPair,
                                          group.outputs,
                                          socket
                                        )}
                                        onFeedDistro={() => undefined}
                                        onDrop={(event) =>
                                          handleSocapexSocketDrop(
                                            event,
                                            output.id,
                                            socket.id
                                          )
                                        }
                                        addEquipment={(equipmentId) =>
                                          addEquipmentToSocapexSocket(
                                            output.id,
                                            socket.id,
                                            equipmentId
                                          )
                                        }
                                        updateQuantity={(itemId, quantity) =>
                                          updateSocapexSocketItemQuantity(
                                            output.id,
                                            socket.id,
                                            itemId,
                                            quantity
                                          )
                                        }
                                        updateItemNotes={(itemId, notes) =>
                                          updateSocapexSocketItemNotes(
                                            output.id,
                                            socket.id,
                                            itemId,
                                            notes
                                          )
                                        }
                                        onAssignedItemDragStart={(event, itemId) =>
                                          handleAssignedItemDragStart(
                                            event,
                                            itemId,
                                            socket.id,
                                            output.id
                                          )
                                        }
                                        onAssignedItemDragEnd={handleDragEnd}
                                        removeItem={(itemId) =>
                                          removeSocapexSocketItem(
                                            output.id,
                                            socket.id,
                                            itemId
                                          )
                                        }
                                        updateNotes={(notes) =>
                                          updateSocapexSocketNotes(
                                            output.id,
                                            socket.id,
                                            notes
                                          )
                                        }
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {standardSocapexOutputs.map((output) => {
                const outputIndex = activeDistro.outputs.findIndex(
                  (item) => item.id === output.id
                );

                return (
                  <div key={output.id} style={styles.socapexCard}>
                    <div style={styles.outputHeader}>
                      <strong>{outputTitle(output, outputIndex)}</strong>
                      <span style={styles.pill}>Socapex</span>
                    </div>

                    {output.detail && <p style={styles.muted}>{output.detail}</p>}

                    <label style={styles.smallLabel}>
                      Socapex Output Notes
                      <textarea
                        style={styles.smallTextarea}
                        value={output.notes ?? ""}
                        onChange={(event) =>
                          updateOutputNotes(output.id, event.target.value)
                        }
                      />
                    </label>

                    <div style={styles.socapexSocketGrid}>
                      {(["L1", "L2", "L3"] as const).map((phase) => {
                        const sockets = (output.socaCircuits ?? [])
                          .filter((socket) => socket.phase === phase)
                          .sort(
                            (a, b) => (a.circuitNo ?? 0) - (b.circuitNo ?? 0)
                          );

                        return (
                          <div key={phase} style={styles.socapexPhaseColumn}>
                            <h4 style={styles.phaseTitle}>{phase}</h4>

                            <div style={styles.outputList}>
                              {sockets.map((socket) => (
                                <OutputCard
                                  key={socket.id}
                                  output={socket}
                                  title={socapexSocketTitle(socket)}
                                  equipmentOptions={equipmentOptions}
                                  compatibleDownstreamDistros={[]}
                                  currentFedDistroId=""
                                  onFeedDistro={() => undefined}
                                  onDrop={(event) =>
                                    handleSocapexSocketDrop(
                                      event,
                                      output.id,
                                      socket.id
                                    )
                                  }
                                  addEquipment={(equipmentId) =>
                                    addEquipmentToSocapexSocket(
                                      output.id,
                                      socket.id,
                                      equipmentId
                                    )
                                  }
                                  updateQuantity={(itemId, quantity) =>
                                    updateSocapexSocketItemQuantity(
                                      output.id,
                                      socket.id,
                                      itemId,
                                      quantity
                                    )
                                  }
                                  updateItemNotes={(itemId, notes) =>
                                    updateSocapexSocketItemNotes(
                                      output.id,
                                      socket.id,
                                      itemId,
                                      notes
                                    )
                                  }
                                  onAssignedItemDragStart={(event, itemId) =>
                                    handleAssignedItemDragStart(event, itemId, socket.id, output.id)
                                  }
                                  onAssignedItemDragEnd={handleDragEnd}
                                  removeItem={(itemId) =>
                                    removeSocapexSocketItem(
                                      output.id,
                                      socket.id,
                                      itemId
                                    )
                                  }
                                  updateNotes={(notes) =>
                                    updateSocapexSocketNotes(
                                      output.id,
                                      socket.id,
                                      notes
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {threePhaseOutputs.length > 0 && (
          <section style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>Three Phase Outputs</h3>

            <div style={styles.threePhaseList}>
              {threePhaseOutputs.map((output) => {
                const outputIndex = activeDistro.outputs.findIndex(
                  (item) => item.id === output.id
                );

                return (
                  <OutputCard
                    key={output.id}
                    output={output}
                    title={outputTitle(output, outputIndex)}
                    equipmentOptions={equipmentOptions}
                    threePhase
                    compatibleDownstreamDistros={compatibleDownstreamDistros(output)}
                    currentFedDistroId={currentFedDistroId(output)}
                    calculatedWatts={calculatedOutputWatts(output, plannerState, activeDistro)}
                    calculatedPhaseLoads={calculatedOutputPhaseLoads(output, plannerState, activeDistro)}
                    allowDownstreamFeed={supportsDownstreamDistroFeed(output)}
                    onOpenDownstream={changeActiveDistro}
                    onFeedDistro={(childDistroId) =>
                      childDistroId
                        ? feedDistroFromOutput(output, childDistroId)
                        : removeDistroFeedFromOutput(output)
                    }
                    onDrop={(event) => handleOutputDrop(event, output.id)}
                    addEquipment={(equipmentId) =>
                      addEquipmentToOutput(output.id, equipmentId)
                    }
                    updateQuantity={(itemId, quantity) =>
                      updateOutputItemQuantity(output.id, itemId, quantity)
                    }
                    updateItemNotes={(itemId, notes) =>
                      updateOutputItemNotes(output.id, itemId, notes)
                    }
                    onAssignedItemDragStart={(event, itemId) =>
                      handleAssignedItemDragStart(event, itemId, output.id)
                    }
                    onAssignedItemDragEnd={handleDragEnd}
                    removeItem={(itemId) => removeOutputItem(output.id, itemId)}
                    updateNotes={(notes) => updateOutputNotes(output.id, notes)}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>
    </section>
  );
}

function PhaseCapacityGrid({
  loads,
  rating,
  capped = false,
}: {
  loads: PhaseLoads;
  rating: number;
  capped?: boolean;
}) {
  return (
    <div style={styles.phaseCapacityGrid}>
      <PhaseCapacityCard phase="L1" amps={loads.L1} rating={rating} capped={capped} />
      <PhaseCapacityCard phase="L2" amps={loads.L2} rating={rating} capped={capped} />
      <PhaseCapacityCard phase="L3" amps={loads.L3} rating={rating} capped={capped} />
    </div>
  );
}

function phaseCapacityBarColour(percent: number) {
  if (percent > 100) return "#E5484D";
  if (percent > 80) return "#B7791F";
  return "#0A8F5D";
}

function CompactPhaseCapacity({
  loads,
  rating,
  capped = false,
}: {
  loads: PhaseLoads;
  rating: number;
  capped?: boolean;
}) {
  return (
    <div style={styles.compactPhaseGrid}>
      {(["L1", "L2", "L3"] as const).map((phase) => {
        const amps = loads[phase];
        const percent = rating ? Math.round((amps / rating) * 100) : 0;

        return (
          <div key={phase} style={styles.compactPhaseItem}>
            <span style={styles.compactPhaseText}>
              <strong>{phase}</strong> {formatAmps(amps)} · {percent}%
            </span>
            <span style={styles.compactPhaseMeter}>
              <span
                style={{
                  ...styles.compactPhaseFill,
                  width: `${Math.min(percent, 100)}%`,
                  background: phaseCapacityBarColour(percent),
                }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PhaseCapacityCard({
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
  const percent = rating ? Math.round((amps / rating) * 100) : 0;
  const overloaded = percent > 100;
  const nearLimit = percent > 80;

  return (
    <div
      style={{
        ...styles.phaseCapacityCard,
        ...(overloaded ? styles.phaseCapacityCritical : {}),
        ...(capped && !overloaded ? styles.phaseCapacityCapped : {}),
      }}
    >
      <div style={styles.capacityHeader}>
        <strong>{phase}</strong>
        <span>
          {formatAmps(amps)} / {formatAmps(rating)} · {percent}%
          {capped ? " · source cap" : ""}
        </span>
      </div>

      <div style={styles.capacityMeter}>
        <div
          style={{
            ...styles.capacityFill,
            width: `${Math.min(percent, 100)}%`,
            background: phaseCapacityBarColour(percent),
          }}
        />
      </div>
    </div>
  );
}

type OutputCardProps = {
  output: PlannerOutput;
  title: string;
  equipmentOptions: EquipmentItem[];
  compatibleDownstreamDistros: ProjectDistro[];
  currentFedDistroId: string;
  calculatedWatts?: number;
  calculatedPhaseLoads?: PhaseLoads;
  allowDownstreamFeed?: boolean;
  threePhase?: boolean;
  capacityOverride?: OutputCapacityOverride;
  onFeedDistro: (distroId: string) => void;
  onOpenDownstream?: (distroId: string) => void;
  onDrop: (event: DragEvent) => void;
  addEquipment: (equipmentId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  onAssignedItemDragStart: (event: DragEvent, itemId: string) => void;
  onAssignedItemDragEnd: () => void;
  removeItem: (itemId: string) => void;
  updateNotes: (notes: string) => void;
};

function OutputCard({
  output,
  title,
  equipmentOptions,
  compatibleDownstreamDistros,
  currentFedDistroId,
  calculatedWatts,
  calculatedPhaseLoads,
  allowDownstreamFeed = false,
  threePhase = false,
  capacityOverride,
  onFeedDistro,
  onOpenDownstream,
  onDrop,
  addEquipment,
  updateQuantity,
  updateItemNotes,
  onAssignedItemDragStart,
  onAssignedItemDragEnd,
  removeItem,
  updateNotes,
}: OutputCardProps) {
  const watts = calculatedWatts ?? outputWatts(output);
  const amps = watts / 230;
  const phaseAmps = threePhase
    ? Math.max(
        calculatedPhaseLoads?.L1 ?? amps / 3,
        calculatedPhaseLoads?.L2 ?? amps / 3,
        calculatedPhaseLoads?.L3 ?? amps / 3
      )
    : amps;
  const ownUsagePercent = output.rating
    ? Math.round(((threePhase ? phaseAmps : amps) / output.rating) * 100)
    : 0;
  const capacityPercent = capacityOverride?.percent ?? ownUsagePercent;
  const capacityAmps = capacityOverride?.amps ?? (threePhase ? phaseAmps : amps);
  const capacityRating = capacityOverride?.rating ?? output.rating;
  const overloaded = capacityPercent > 100;
  const nearLimit = capacityPercent > 80;
  const fedDistro = compatibleDownstreamDistros.find(
    (distro) => distro.id === currentFedDistroId
  );

  return (
    <div
      style={{
        ...styles.outputCard,
        ...(overloaded ? styles.outputCardCritical : {}),
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "move" ? "move" : "copy";
      }}
      onDrop={onDrop}
    >
      <div style={styles.outputHeader}>
        <strong>{title}</strong>
        <span style={styles.pill}>{output.type}</span>
      </div>

      <p style={styles.muted}>
        Load {formatWatts(watts)} ·{" "}
        {threePhase
          ? `${formatAmps(phaseAmps)} per phase`
          : `${formatAmps(amps)}`}
        {capacityOverride
          ? ` · Shared ${formatAmps(capacityAmps)} / ${capacityRating}A`
          : ` / ${output.rating}A`}
      </p>
      {fedDistro && (
        <p style={styles.downstreamLoadNote}>
          Includes the draw from {displayDistroName(fedDistro)}.
        </p>
      )}

      <div style={styles.capacityBlock}>
        <div style={styles.capacityHeader}>
          <strong>{capacityPercent}%</strong>
          <span>
            {overloaded
              ? "Overloaded"
              : nearLimit
                ? "Near limit"
                : "Capacity OK"}
          </span>
        </div>

        {capacityOverride && (
          <p style={styles.sharedCapacityLabel}>{capacityOverride.label}</p>
        )}

        <div style={styles.capacityMeter}>
          <div
            style={{
              ...styles.capacityFill,
              width: `${Math.min(capacityPercent, 100)}%`,
              background: overloaded
                ? "#E5484D"
                : nearLimit
                  ? "#B7791F"
                  : "#0A8F5D",
            }}
          />
        </div>
      </div>

      <div
        style={styles.dropZone}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "move" ? "move" : "copy";
        }}
        onDrop={onDrop}
      >
        Drop equipment here
      </div>

      {threePhase && (
        <div style={styles.threePhaseGrid}>
          <div style={styles.phaseMini}>L1: {formatAmps(calculatedPhaseLoads?.L1 ?? phaseAmps)}</div>
          <div style={styles.phaseMini}>L2: {formatAmps(calculatedPhaseLoads?.L2 ?? phaseAmps)}</div>
          <div style={styles.phaseMini}>L3: {formatAmps(calculatedPhaseLoads?.L3 ?? phaseAmps)}</div>
        </div>
      )}

      {allowDownstreamFeed && (
        <div style={styles.feedContainer}>
          <label style={styles.feedLabel}>
            Feed Distro From This Output
          <select
            style={styles.input}
            value={currentFedDistroId}
            onChange={(event) => onFeedDistro(event.target.value)}
          >
            <option value="">No downstream distro</option>
            {compatibleDownstreamDistros.map((distro) => (
              <option key={distro.id} value={distro.id}>
                {displayDistroName(distro)} — {distro.input}
              </option>
            ))}
          </select>
          </label>
          {currentFedDistroId && onOpenDownstream && (
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => onOpenDownstream(currentFedDistroId)}
            >
              Open downstream distro
            </button>
          )}
          {compatibleDownstreamDistros.length === 0 && !currentFedDistroId && (
            <small style={styles.feedHelp}>No compatible unassigned downstream distros are available.</small>
          )}
        </div>
      )}

      <div style={styles.addEquipmentRow}>
        <select
          style={styles.input}
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            addEquipment(event.target.value);
            event.target.value = "";
          }}
        >
          <option value="">Add equipment...</option>
          {equipmentOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.category} — {item.name} ({item.watts}W)
            </option>
          ))}
        </select>
      </div>

      {output.items.length > 0 && (
        <div style={styles.assignedList}>
          {output.items.map((item) => (
            <div
              key={item.id}
              style={styles.assignedItem}
              draggable
              onDragStart={(event) => onAssignedItemDragStart(event, item.id)}
              onDragEnd={onAssignedItemDragEnd}
            >
              <div>
                <strong>{item.name}</strong>
                <p style={styles.muted}>
                  {item.watts}W each · Total{" "}
                  {formatWatts(item.watts * item.quantity)}
                </p>

                <label style={styles.itemNotesLabel}>
                  Item Notes
                  <input
                    style={styles.input}
                    value={item.notes ?? ""}
                    onChange={(event) =>
                      updateItemNotes(item.id, event.target.value)
                    }
                    onDragStart={(event) => event.preventDefault()}
                    placeholder="e.g. FOH rack, LX bar 3, spare..."
                  />
                </label>
              </div>

              <label style={styles.qtyLabel}>
                Qty
                <input
                  style={styles.qtyInput}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateQuantity(item.id, Number(event.target.value))
                  }
                  onDragStart={(event) => event.preventDefault()}
                />
              </label>

              <button
                style={styles.dangerButton}
                onClick={() => removeItem(item.id)}
                onDragStart={(event) => event.preventDefault()}
              >
                Remove
              </button>
            </div>
          ))}        </div>
      )}

      <label style={styles.smallLabel}>
        Output Notes
        <textarea
          style={styles.smallTextarea}
          value={output.notes ?? ""}
          onChange={(event) => updateNotes(event.target.value)}
        />
      </label>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  editorLayout: {
    display: "grid",
    gridTemplateColumns: "300px minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
  },
  sidebar: {
    position: "sticky",
    top: "20px",
    maxHeight: "calc(100vh - 40px)",
    overflow: "auto",
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
  },
  mainPanel: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
    minWidth: 0,
  },
  card: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
  },
  muted: {
    color: "#667085",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  editorHeaderActions: {
    display: "flex",
    gap: "10px",
    alignItems: "end",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  editorSelectLabel: {
    display: "block",
    color: "#667085",
    fontWeight: 400,
    fontSize: "12px",
    minWidth: "260px",
  },
  editorSelect: {
    width: "100%",
    padding: "9px 10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    marginBottom: "12px",
  },
  parentPhaseCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "10px 12px",
    border: "1px solid #DCE5EC",
    borderRadius: "10px",
    background: "white",
  },
  expandButton: {
    padding: "6px 9px",
    border: 0,
    background: "transparent",
    color: "#667085",
    cursor: "pointer",
    fontWeight: 500,
  },
  summaryCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "14px",
    background: "#F5F7FA",
  },
  summaryCardCapped: {
    border: "1px solid #B7791F",
    background: "#FFFBEB",
  },
  capNotice: {
    display: "block",
    marginTop: "4px",
    color: "#92400E",
    fontWeight: 500,
  },
  capBanner: {
    marginBottom: "12px",
    border: "1px solid #FDE68A",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#FFFBEB",
    color: "#92400E",
    fontWeight: 500,
    fontSize: "13px",
  },
  phaseCapacityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "18px",
  },
  stickyPhaseDraws: {
    position: "sticky",
    top: "10px",
    zIndex: 20,
    marginBottom: "18px",
    padding: "10px 10px 0",
    border: "1px solid #C7D2DE",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.97)",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.10)",
    backdropFilter: "blur(8px)",
  },
  stickyPhaseHeading: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
    color: "#526071",
    fontSize: "12px",
  },
  stickyPhaseHeadingActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
  },
  currentPhaseHeading: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
    color: "#526071",
    fontSize: "12px",
  },
  stickyUpstreamButton: {
    padding: 0,
    border: 0,
    background: "transparent",
    color: "#667085",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 500,
  },
  stickyUpstreamList: {
    display: "grid",
    gap: "8px",
    margin: "0 0 9px",
    paddingTop: "7px",
    borderTop: "1px solid #E4E9EF",
  },
  stickyDownstreamList: {
    display: "grid",
    gap: "8px",
    margin: "-8px 0 10px",
    paddingTop: "7px",
    borderTop: "1px solid #E4E9EF",
  },
  stickyUpstreamRow: {
    display: "block",
  },
  stickyUpstreamName: {
    display: "block",
    minWidth: 0,
    marginBottom: "3px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#344054",
    fontSize: "12px",
  },
  stickyDistroLink: {
    display: "block",
    maxWidth: "100%",
    margin: 0,
    padding: 0,
    overflow: "hidden",
    border: 0,
    background: "transparent",
    color: "#344054",
    cursor: "pointer",
    font: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "left",
    textDecoration: "underline",
    textDecorationColor: "#C7D2DE",
    textUnderlineOffset: "3px",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  compactPhaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },
  compactPhaseItem: {
    minWidth: 0,
    padding: "0 12px",
  },
  compactPhaseText: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#526071",
    fontSize: "11px",
  },
  compactPhaseMeter: {
    display: "block",
    height: "3px",
    marginTop: "3px",
    overflow: "hidden",
    borderRadius: "999px",
    background: "#E4E9EF",
  },
  compactPhaseFill: {
    display: "block",
    height: "100%",
    borderRadius: "999px",
  },
  phaseCapacityCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "12px",
    background: "#F5F7FA",
  },
  phaseCapacityCritical: {
    border: "1px solid #E5484D",
    background: "#FFF1F1",
  },
  phaseCapacityCapped: {
    border: "1px solid #F59E0B",
    background: "#FFFBEB",
  },
  label: {
    display: "block",
    marginTop: "12px",
    marginBottom: "12px",
    color: "#667085",
    fontWeight: 400,
  },
  feedLabel: {
    display: "block",
    color: "#111827",
    fontWeight: 500,
    fontSize: "12px",
  },
  feedContainer: {
    display: "grid",
    gap: "8px",
    marginTop: "10px",
    padding: "10px",
    border: "1px dashed #0BE3FF",
    borderRadius: "12px",
    background: "#E6FBFF",
  },
  feedHelp: {
    color: "#526071",
    lineHeight: 1.4,
  },
  smallLabel: {
    display: "block",
    marginTop: "10px",
    color: "#667085",
    fontWeight: 400,
    fontSize: "12px",
  },
  itemNotesLabel: {
    display: "block",
    marginTop: "8px",
    color: "#667085",
    fontWeight: 400,
    fontSize: "12px",
  },
  qtyLabel: {
    display: "grid",
    gap: "4px",
    color: "#667085",
    fontWeight: 400,
    fontSize: "12px",
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
  smallTextarea: {
    width: "100%",
    minHeight: "48px",
    padding: "8px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
  },
  qtyInput: {
    width: "64px",
    padding: "8px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #000000",
    background: "var(--lva-workspace-highlight, #ececec)",
    color: "#000000",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
  },
  dangerButton: {
    padding: "8px 10px",
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
  sectionBlock: {
    marginTop: "30px",
    paddingTop: "18px",
    borderTop: "1px solid #DCE5EC",
  },
  sectionTitle: {
    marginBottom: "14px",
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  phaseColumn: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "12px",
    background: "#F5F7FA",
  },
  phaseTitle: {
    marginTop: 0,
    marginBottom: "10px",
  },
  outputList: {
    display: "grid",
    gap: "10px",
  },
  outputCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    padding: "12px",
    background: "white",
  },
  outputCardCritical: {
    border: "1px solid #E5484D",
    background: "#fffafa",
  },
  outputHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    alignItems: "center",
  },
  pill: {
    borderRadius: "999px",
    background: "#E6FBFF",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 400,
    color: "#111827",
  },
  capacityBlock: {
    marginTop: "10px",
  },
  capacityHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    fontSize: "12px",
    marginBottom: "5px",
  },
  sharedCapacityLabel: {
    margin: "0 0 5px",
    color: "#667085",
    fontSize: "11px",
  },
  downstreamLoadNote: {
    margin: "-6px 0 8px",
    color: "#2457A6",
    fontSize: "12px",
    fontWeight: 500,
  },
  capacityMeter: {
    height: "9px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#E9EEF3",
  },
  capacityFill: {
    height: "100%",
    borderRadius: "999px",
  },
  dropZone: {
    marginTop: "10px",
    border: "1px dashed #000000",
    borderRadius: "12px",
    padding: "10px",
    textAlign: "center",
    background: "#ececec",
    color: "#000000",
    fontSize: "12px",
    fontWeight: 500,
  },
  addEquipmentRow: {
    marginTop: "10px",
  },
  assignedList: {
    display: "grid",
    gap: "8px",
    marginTop: "10px",
  },
  assignedItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: "10px",
    alignItems: "start",
    border: "1px solid #DCE5EC",
    borderRadius: "10px",
    padding: "10px",
    background: "#ececec",
    cursor: "grab",
  },

  dragHandle: {
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid #000000",
  background: "#ececec",
  color: "#000000",
  cursor: "grab",
  fontWeight: 500,
  alignSelf: "start",
},

  socapexList: {
    display: "grid",
    gap: "14px",
  },
  pairedSocapexGroup: {
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    padding: "14px",
    background: "#F5F7FA",
  },
  pairedSocapexHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  pairedSocapexOutputs: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
  },
  socapexCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "14px",
    background: "#F5F7FA",
  },
  socapexSocketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "12px",
  },
  socapexPhaseColumn: {
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    padding: "10px",
    background: "white",
  },
  threePhaseList: {
    display: "grid",
    gap: "12px",
  },
  threePhaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "10px",
  },
  phaseMini: {
    border: "1px solid #DCE5EC",
    borderRadius: "10px",
    padding: "8px",
    background: "white",
    fontSize: "12px",
  },
  equipmentList: {
    display: "grid",
    gap: "8px",
    marginTop: "12px",
  },
  equipmentCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    padding: "10px",
    background: "#F5F7FA",
    cursor: "grab",
  },
  equipmentCardDragging: {
    opacity: 0.5,
    border: "1px dashed #b4b4b4",
  },
};
