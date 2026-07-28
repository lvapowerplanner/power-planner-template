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

type PowerSourceDraft = {
  id: string;
  name: string;
  type: string;
  notes: string;
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
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceView, setSourceView] = useState<"all" | "single" | "three">(
    "all",
  );
  const [showAutomaticallyCreatedSources, setShowAutomaticallyCreatedSources] =
    useState(false);
  const [sourceDrafts, setSourceDrafts] = useState<PowerSourceDraft[]>([]);
  const [draggedDraftId, setDraggedDraftId] = useState<string | null>(null);
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [pendingDeleteSourceId, setPendingDeleteSourceId] = useState<
    string | null
  >(null);
  const [expandedSourceIds, setExpandedSourceIds] = useState<Set<string>>(
    () => new Set(),
  );

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

  function sourceMatchesView(source: PowerSource) {
    if (sourceView === "single") return !isThreePhaseConnection(source.conn);
    if (sourceView === "three") return isThreePhaseConnection(source.conn);
    return true;
  }

  const visibleManualSourceSummaries = manualSourceSummaries.filter(
    (summary) => sourceMatchesView(summary.source),
  );
  const visibleAutoSourceSummaries = showAutomaticallyCreatedSources
    ? autoSourceSummaries.filter((summary) => sourceMatchesView(summary.source))
    : [];

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

  function openSourceModal() {
    setSourceDrafts([
      {
        id: createId("source_draft"),
        name: "",
        type: "125A / 3",
        notes: "",
      },
    ]);
    setSourceModalOpen(true);
  }

  function addSourceDraft() {
    setSourceDrafts((drafts) => [
      ...drafts,
      {
        id: createId("source_draft"),
        name: "",
        type: "125A / 3",
        notes: "",
      },
    ]);
  }

  function updateSourceDraft(
    draftId: string,
    field: "name" | "type" | "notes",
    value: string,
  ) {
    setSourceDrafts((drafts) =>
      drafts.map((draft) =>
        draft.id === draftId ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  function removeSourceDraft(draftId: string) {
    setSourceDrafts((drafts) =>
      drafts.length === 1
        ? drafts
        : drafts.filter((draft) => draft.id !== draftId),
    );
  }

  function moveSourceDraft(targetDraftId: string) {
    if (!draggedDraftId || draggedDraftId === targetDraftId) return;

    setSourceDrafts((drafts) => {
      const fromIndex = drafts.findIndex((draft) => draft.id === draggedDraftId);
      const targetIndex = drafts.findIndex((draft) => draft.id === targetDraftId);
      if (fromIndex < 0 || targetIndex < 0) return drafts;

      const nextDrafts = [...drafts];
      const [movedDraft] = nextDrafts.splice(fromIndex, 1);
      nextDrafts.splice(targetIndex, 0, movedDraft);
      return nextDrafts;
    });
    setDraggedDraftId(null);
  }

  function addPowerSources() {
    if (sourceDrafts.some((draft) => !draft.name.trim())) {
      alert("Please enter a source name for every row.");
      return;
    }

    const newSources: PowerSource[] = sourceDrafts.map((draft) => ({
      id: createId("source"),
      name: draft.name.trim(),
      conn: draft.type,
      rating: sourceRating(draft.type),
      notes: draft.notes.trim(),
      auto: false,
      phaseType: draft.type.includes("/ 3") ? "Three-Phase" : "Single-Phase",
    }));

    setPlannerState({
      ...plannerState,
      sources: [...manualSources, ...newSources, ...autoSources],
    });
    setSourceModalOpen(false);
    setSourceDrafts([]);
  }

  function deletePowerSource(sourceId: string) {
    if (sourceIsInUse(plannerState, sourceId)) {
      setPendingDeleteSourceId(sourceId);
      return;
    }

    removePowerSource(sourceId);
  }

  function removePowerSource(sourceId: string) {
    setPlannerState({
      ...plannerState,
      sources: manualSources.filter((source) => source.id !== sourceId),
      distros: plannerState.distros.map((distro) =>
        distro.sourceId === sourceId ? { ...distro, sourceId: "" } : distro,
      ),
    });
    setPendingDeleteSourceId(null);
  }

  function updatePowerSource(
    sourceId: string,
    nextName: string,
    nextNotes: string,
  ) {
    setPlannerState({
      ...plannerState,
      sources: [
        ...manualSources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                name: nextName.trim(),
                notes: nextNotes.trim(),
              }
            : source,
        ),
        ...autoSources,
      ],
    });
  }

  function movePowerSource(targetSourceId: string) {
    if (!draggedSourceId || draggedSourceId === targetSourceId) return;

    const fromIndex = manualSources.findIndex(
      (source) => source.id === draggedSourceId,
    );
    const targetIndex = manualSources.findIndex(
      (source) => source.id === targetSourceId,
    );
    if (fromIndex < 0 || targetIndex < 0) return;

    const nextManualSources = [...manualSources];
    const [movedSource] = nextManualSources.splice(fromIndex, 1);
    nextManualSources.splice(targetIndex, 0, movedSource);
    setPlannerState({
      ...plannerState,
      sources: [...nextManualSources, ...autoSources],
    });
    setDraggedSourceId(null);
  }

  function nudgePowerSource(sourceId: string, direction: -1 | 1) {
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

  const allSourceIds = [
    ...visibleManualSourceSummaries,
    ...visibleAutoSourceSummaries,
  ].map((summary) => summary.source.id);
  const allSourcesCollapsed = allSourceIds.every(
    (sourceId) => !expandedSourceIds.has(sourceId),
  );

  function toggleSource(sourceId: string) {
    setExpandedSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }

  function expandAllSources() {
    setExpandedSourceIds(new Set(allSourceIds));
  }

  function collapseAllSources() {
    setExpandedSourceIds(new Set());
  }

  return (
    <section data-lva-surface style={styles.card}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Power Sources</h2>
          <p style={styles.pageDescription}>
            Manual Power Sources are venue power supplies or generators. Auto
            sources are created from distro outputs and show downstream distro
            loads.
          </p>
        </div>
        <button style={styles.button} onClick={openSourceModal}>
          Add Manual Power Source
        </button>
      </div>

      <WarningPanel
        scope="planner-warnings"
        title="Power Source Warnings"
        issues={allIssues}
        plannerState={plannerState}
        setPlannerState={setPlannerState}
      />

      <hr style={styles.divider} />

      <div style={styles.toolbar}>
        <label style={styles.compactField}>
          <span style={styles.toolbarLabel}>View</span>
          <select
            style={styles.filterInput}
            value={sourceView}
            onChange={(event) =>
              setSourceView(event.target.value as "all" | "single" | "three")
            }
          >
            <option value="all">View All</option>
            <option value="single">Single Phase</option>
            <option value="three">Three Phase</option>
          </select>
        </label>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showAutomaticallyCreatedSources}
            onChange={(event) =>
              setShowAutomaticallyCreatedSources(event.target.checked)
            }
          />
          Show automatically created sources
        </label>
        <button style={styles.textButton} onClick={expandAllSources}>
          Expand all
        </button>
        <button style={styles.textButton} onClick={collapseAllSources}>
          Collapse all
        </button>
      </div>

      <h3>Manual Power Sources</h3>

      <div style={styles.list}>
        {visibleManualSourceSummaries.length === 0 ? (
          <p style={styles.muted}>
            {manualSourceSummaries.length === 0
              ? "No manual power sources added yet."
              : "No manual power sources match the selected view."}
          </p>
        ) : (
          visibleManualSourceSummaries.map((summary) => {
            const sourceIndex = manualSources.findIndex(
              (source) => source.id === summary.source.id,
            );
            return (
            <PowerSourceCard
              key={summary.source.id}
              summary={summary}
              collapsed={!expandedSourceIds.has(summary.source.id)}
              onToggle={() => toggleSource(summary.source.id)}
              allowReorder={allSourcesCollapsed}
              isDragging={draggedSourceId === summary.source.id}
              onDragStart={() => setDraggedSourceId(summary.source.id)}
              onDragEnd={() => setDraggedSourceId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => movePowerSource(summary.source.id)}
              onMoveUp={() => nudgePowerSource(summary.source.id, -1)}
              onMoveDown={() => nudgePowerSource(summary.source.id, 1)}
              moveUpDisabled={sourceIndex === 0}
              moveDownDisabled={sourceIndex === manualSources.length - 1}
              onUpdate={(name, notes) =>
                updatePowerSource(summary.source.id, name, notes)
              }
              onDelete={() => deletePowerSource(summary.source.id)}
              dismissedWarnings={plannerState.dismissedWarnings ?? []}
              openDistroEditor={openDistroEditor}
            />
            );
          })
        )}
      </div>

      {showAutomaticallyCreatedSources && (
        <>
          <hr style={styles.divider} />
          <h3>Distro Output Links</h3>
          <div style={styles.list}>
            {visibleAutoSourceSummaries.length === 0 ? (
              <p style={styles.muted}>
                {autoSourceSummaries.length === 0
                  ? "No auto-created sources yet. Add a distro with 32A+ outputs."
                  : "No automatically created sources match the selected view."}
              </p>
            ) : (
              visibleAutoSourceSummaries.map((summary) => (
                <PowerSourceCard
                  key={summary.source.id}
                  summary={summary}
                  collapsed={!expandedSourceIds.has(summary.source.id)}
                  onToggle={() => toggleSource(summary.source.id)}
                  dismissedWarnings={plannerState.dismissedWarnings ?? []}
                  openDistroEditor={openDistroEditor}
                />
              ))
            )}
          </div>
        </>
      )}

      {sourceModalOpen && (
        <div style={styles.modalBackdrop} role="presentation">
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-power-sources-title"
          >
            <div style={styles.modalHeader}>
              <div>
                <h3 id="add-power-sources-title" style={styles.modalTitle}>
                  Add Manual Power Sources
                </h3>
                <p style={styles.modalDescription}>
                  Add and arrange multiple sources before placing them into the project.
                </p>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => setSourceModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={styles.draftTableWrap}>
              <table style={styles.draftTable}>
                <thead>
                  <tr>
                    <th style={styles.handleColumn} aria-label="Move" />
                    <th style={styles.tableHeader}>Source Name</th>
                    <th style={styles.tableHeader}>Type</th>
                    <th style={styles.tableHeader}>Notes</th>
                    <th style={styles.removeColumn} aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {sourceDrafts.map((draft) => (
                    <tr
                      key={draft.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveSourceDraft(draft.id)}
                    >
                      <td style={styles.tableCell}>
                        <button
                          style={styles.dragHandle}
                          draggable
                          onDragStart={() => setDraggedDraftId(draft.id)}
                          onDragEnd={() => setDraggedDraftId(null)}
                          aria-label={`Move ${draft.name || "power source"}`}
                          title="Drag to reorder"
                        >
                          ⋮⋮
                        </button>
                      </td>
                      <td style={styles.tableCell}>
                        <input
                          style={styles.tableInput}
                          value={draft.name}
                          onChange={(event) =>
                            updateSourceDraft(draft.id, "name", event.target.value)
                          }
                          placeholder="Generator 1"
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <select
                          style={styles.tableInput}
                          value={draft.type}
                          onChange={(event) =>
                            updateSourceDraft(draft.id, "type", event.target.value)
                          }
                        >
                          {sourceTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={styles.tableCell}>
                        <input
                          style={styles.tableInput}
                          value={draft.notes}
                          onChange={(event) =>
                            updateSourceDraft(draft.id, "notes", event.target.value)
                          }
                          placeholder="Optional notes"
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <button
                          style={styles.removeButton}
                          onClick={() => removeSourceDraft(draft.id)}
                          disabled={sourceDrafts.length === 1}
                          aria-label={`Remove ${draft.name || "power source"}`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button style={styles.addRowButton} onClick={addSourceDraft}>
              + Add Power Source
            </button>

            <div style={styles.modalFooter}>
              <button
                style={styles.secondaryButton}
                onClick={() => setSourceModalOpen(false)}
              >
                Cancel
              </button>
              <button style={styles.button} onClick={addPowerSources}>
                Add {sourceDrafts.length} Power Source
                {sourceDrafts.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteSourceId && (
        <div style={styles.modalBackdrop} role="presentation">
          <div
            style={styles.confirmModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-power-source-title"
            aria-describedby="delete-power-source-description"
          >
            <h3 id="delete-power-source-title" style={styles.modalTitle}>
              Delete power source?
            </h3>
            <p
              id="delete-power-source-description"
              style={styles.confirmDescription}
            >
              <strong>
                {manualSources.find(
                  (source) => source.id === pendingDeleteSourceId,
                )?.name ?? "This power source"}
              </strong>{" "}
              is assigned to one or more distros. Deleting it will also
              unassign those distros from this source.
            </p>
            <div style={styles.modalFooter}>
              <button
                style={styles.secondaryButton}
                onClick={() => setPendingDeleteSourceId(null)}
              >
                Cancel
              </button>
              <button
                style={styles.confirmDeleteButton}
                onClick={() => removePowerSource(pendingDeleteSourceId)}
              >
                Delete and Unassign
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PowerSourceCard({
  summary,
  onDelete,
  collapsed,
  onToggle,
  allowReorder = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
  moveUpDisabled = false,
  moveDownDisabled = false,
  onUpdate,
  dismissedWarnings = [],
  openDistroEditor,
}: {
  summary: SourceCardSummary;
  onDelete?: () => void;
  collapsed: boolean;
  onToggle: () => void;
  allowReorder?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  onUpdate?: (name: string, notes: string) => void;
  dismissedWarnings?: PlannerState["dismissedWarnings"];
  openDistroEditor: (distroId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(summary.source.name);
  const [editNotes, setEditNotes] = useState(summary.source.notes);
  const activeIssues = activeIssuesForScope("planner-warnings", summary.issues, dismissedWarnings);
  const health = sourceHealth(activeIssues);
  const imbalance = isThreePhaseConnection(summary.source.conn)
    ? phaseImbalance(summary.phaseLoads)
    : 0;

  function beginEditing() {
    setEditName(summary.source.name);
    setEditNotes(summary.source.notes);
    setIsEditing(true);
  }

  function saveChanges() {
    if (!editName.trim()) {
      alert("Please enter a source name.");
      return;
    }

    onUpdate?.(editName, editNotes);
    setIsEditing(false);
  }

  if (collapsed) {
    return (
      <div
        data-power-source-card
        style={{
          ...styles.sourceCard,
          ...styles.collapsedSourceCard,
          ...(isDragging ? styles.draggingSourceCard : {}),
          ...sourcePhaseStyle(summary.source),
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div style={styles.collapsedIdentity}>
          {allowReorder && onDragStart && (
            <button
              style={styles.sourceDragHandle}
              draggable
              onDragStart={(event) => {
                const sourceCard = event.currentTarget.closest(
                  "[data-power-source-card]",
                );
                if (sourceCard instanceof HTMLElement) {
                  const bounds = sourceCard.getBoundingClientRect();
                  event.dataTransfer.setDragImage(
                    sourceCard,
                    Math.min(40, bounds.width / 2),
                    Math.min(28, bounds.height / 2),
                  );
                }
                event.dataTransfer.effectAllowed = "move";
                onDragStart();
              }}
              onDragEnd={onDragEnd}
              aria-label={`Move ${summary.source.name}`}
              title="Drag to reorder"
            >
              ⋮⋮
            </button>
          )}
          <strong>{summary.source.name}</strong>
          <span style={styles.topRowTotals}>
            {formatWatts(summary.watts)} · {formatAmps(summary.amps)} total draw
          </span>
          <span style={styles.collapsedType}>{summary.source.conn}</span>
        </div>
        <div style={styles.collapsedTotals}>
          {allowReorder && onMoveUp && onMoveDown && (
            <div style={styles.orderButtons}>
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
            </div>
          )}
          <button
            style={styles.expandButton}
            onClick={onToggle}
            aria-label={`Expand ${summary.source.name}`}
          >
            Expand ▾
          </button>
        </div>
      </div>
    );
  }

  return (
      <div
        data-power-source-card
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
            <span style={styles.topRowTotals}>
              {formatWatts(summary.watts)} · {formatAmps(summary.amps)} total draw
            </span>
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
          <div style={styles.actionRow}>
            {onDelete && (
              <>
              <button
                style={styles.secondaryButton}
                onClick={beginEditing}
                disabled={isEditing}
              >
                Edit
              </button>
              <button style={styles.dangerButton} onClick={onDelete}>
                Delete
              </button>
              </>
            )}
            <button style={styles.expandButton} onClick={onToggle}>
              Collapse ▴
            </button>
          </div>
        </div>
      </div>

      {isEditing && (
        <div style={styles.editPanel}>
          <div style={styles.editGrid}>
            <label style={styles.label}>
              Source Name
              <input
                style={styles.input}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                autoFocus
              />
            </label>
            <div style={styles.lockedDetail}>
              <span>Type and rating</span>
              <strong>{displaySourceConnection(summary.source)}</strong>
              <small>Fixed when the source is created</small>
            </div>
          </div>
          <label style={styles.label}>
            Notes
            <textarea
              style={styles.editTextarea}
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              placeholder="Generator location, venue DB details, cable route, restrictions..."
            />
          </label>
          <div style={styles.editActions}>
            <button style={styles.button} onClick={saveChanges}>
              Save Changes
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "18px",
  },
  pageTitle: {
    margin: 0,
  },
  pageDescription: {
    margin: "7px 0 0",
    color: "#667085",
    maxWidth: "720px",
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
  secondaryButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 500,
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
  collapsedSourceCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    minHeight: "62px",
    padding: "12px 16px",
  },
  draggingSourceCard: {
    outline: "2px dashed #2563EB",
    outlineOffset: "3px",
    opacity: 0.72,
    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.18)",
  },
  collapsedIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  collapsedType: {
    padding: "4px 8px",
    borderRadius: "999px",
    background: "white",
    border: "1px solid #DCE5EC",
    color: "#667085",
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  collapsedTotals: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "14px",
    color: "#111827",
    whiteSpace: "nowrap",
  },
  orderButtons: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  expandButton: {
    padding: "6px 9px",
    border: 0,
    background: "transparent",
    color: "#667085",
    cursor: "pointer",
    fontWeight: 500,
  },
  sourceDragHandle: {
    width: "32px",
    height: "32px",
    padding: 0,
    borderRadius: "8px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#667085",
    cursor: "grab",
    fontSize: "16px",
    lineHeight: 1,
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
  topRowTotals: {
    color: "#475467",
    fontSize: "16px",
    fontWeight: 400,
    whiteSpace: "nowrap",
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
  toolbar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "18px",
  },
  compactField: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  toolbarLabel: {
    fontSize: "12px",
    color: "#526071",
    fontWeight: 600,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "14px",
  },
  filterInput: {
    minHeight: "38px",
    padding: "7px 9px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    background: "#FFFFFF",
  },
  textButton: {
    padding: "7px 9px",
    border: 0,
    background: "transparent",
    color: "#334155",
    textDecoration: "underline",
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "rgba(15, 23, 42, 0.55)",
  },
  modal: {
    width: "min(1120px, 100%)",
    maxHeight: "calc(100vh - 48px)",
    overflow: "auto",
    padding: "20px",
    borderRadius: "18px",
    background: "white",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  },
  confirmModal: {
    width: "min(480px, 100%)",
    padding: "20px",
    borderRadius: "18px",
    background: "white",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  },
  confirmDescription: {
    margin: "12px 0 0",
    color: "#475467",
    lineHeight: 1.55,
  },
  confirmDeleteButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #D92D20",
    background: "#D92D20",
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "16px",
  },
  modalTitle: {
    margin: 0,
  },
  modalDescription: {
    margin: "6px 0 0",
    color: "#667085",
  },
  closeButton: {
    width: "34px",
    height: "34px",
    padding: 0,
    borderRadius: "9px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#344054",
    cursor: "pointer",
    fontSize: "22px",
    lineHeight: 1,
  },
  draftTableWrap: {
    overflowX: "auto",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
  },
  draftTable: {
    width: "100%",
    minWidth: "850px",
    borderCollapse: "collapse",
  },
  tableHeader: {
    padding: "10px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
    color: "#475467",
    fontSize: "12px",
    fontWeight: 500,
    textAlign: "left",
  },
  handleColumn: {
    width: "48px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
  },
  removeColumn: {
    width: "90px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
  },
  tableCell: {
    padding: "8px",
    borderBottom: "1px solid #EEF2F6",
    verticalAlign: "middle",
  },
  tableInput: {
    width: "100%",
    minHeight: "38px",
    padding: "8px 9px",
    borderRadius: "8px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    fontWeight: 400,
  },
  dragHandle: {
    width: "32px",
    height: "32px",
    padding: 0,
    borderRadius: "8px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#667085",
    cursor: "grab",
    fontSize: "16px",
    lineHeight: 1,
  },
  removeButton: {
    padding: "7px 9px",
    borderRadius: "8px",
    border: "1px solid #FECACA",
    background: "#FFF7F7",
    color: "#B42318",
    cursor: "pointer",
    fontWeight: 400,
  },
  addRowButton: {
    marginTop: "12px",
    padding: "9px 12px",
    borderRadius: "9px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 500,
  },
  modalFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "18px",
    paddingTop: "16px",
    borderTop: "1px solid #EEF2F6",
  },
  editPanel: {
    marginTop: "14px",
    padding: "14px",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    background: "white",
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1fr) minmax(220px, 0.7fr)",
    gap: "12px",
    alignItems: "start",
  },
  editTextarea: {
    width: "100%",
    minHeight: "76px",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    resize: "vertical",
  },
  lockedDetail: {
    display: "grid",
    gap: "5px",
    padding: "10px",
    border: "1px solid #E5E7EB",
    borderRadius: "10px",
    background: "#F8FAFC",
    color: "#667085",
    fontSize: "13px",
  },
  editActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
};
