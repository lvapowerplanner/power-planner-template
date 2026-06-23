import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ValidationIssue } from "@/planner/calculations";
import type { DismissedWarning, PlannerState } from "@/planner/types";

type WarningPanelProps = {
  scope: string;
  title: string;
  issues: ValidationIssue[];
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

const dismissConfirmationStorageKey = "lva-warning-dismiss-confirmation-muted-until";

function warningKey(scope: string, issue: ValidationIssue) {
  return `${scope}:${issue.id}`;
}

function warningCurrentValue(issue: ValidationIssue) {
  if (typeof issue.currentValue === "number" && Number.isFinite(issue.currentValue)) {
    return issue.currentValue;
  }

  const match = issue.message.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : undefined;
}

function dismissedWarningForIssue(
  scope: string,
  issue: ValidationIssue,
  dismissedWarnings: DismissedWarning[] = [],
) {
  return dismissedWarnings.find(
    (dismissed) =>
      dismissed.scope === scope && dismissed.issueId === issue.id,
  );
}

function shouldAutoReinstate(issue: ValidationIssue, dismissed?: DismissedWarning) {
  if (!dismissed) return false;

  const currentValue = warningCurrentValue(issue);
  const dismissedAtValue = dismissed.dismissedAtValue;

  if (
    typeof currentValue !== "number" ||
    typeof dismissedAtValue !== "number" ||
    !Number.isFinite(currentValue) ||
    !Number.isFinite(dismissedAtValue) ||
    dismissedAtValue <= 0
  ) {
    return false;
  }

  return currentValue >= dismissedAtValue * 1.1;
}


function reinstatementInfoForIssue(
  scope: string,
  issue: ValidationIssue,
  dismissedWarnings: DismissedWarning[] = [],
) {
  const dismissed = dismissedWarningForIssue(scope, issue, dismissedWarnings);

  if (!dismissed || !shouldAutoReinstate(issue, dismissed)) return null;

  const currentValue = warningCurrentValue(issue);
  const dismissedAtValue = dismissed.dismissedAtValue;

  if (
    typeof currentValue !== "number" ||
    typeof dismissedAtValue !== "number" ||
    !Number.isFinite(currentValue) ||
    !Number.isFinite(dismissedAtValue) ||
    dismissedAtValue <= 0
  ) {
    return {
      text: "Automatically reinstated because the warning has increased since it was dismissed.",
    };
  }

  const increase = ((currentValue - dismissedAtValue) / dismissedAtValue) * 100;

  return {
    text: `Automatically reinstated because this warning has increased by ${Math.round(
      increase,
    )}% since it was dismissed.`,
  };
}

function formatDismissedAt(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dismissalConfirmationIsMuted() {
  if (typeof window === "undefined") return false;

  const rawValue = window.localStorage.getItem(dismissConfirmationStorageKey);
  const mutedUntil = rawValue ? Number(rawValue) : 0;

  return Number.isFinite(mutedUntil) && Date.now() < mutedUntil;
}

function muteDismissalConfirmationForFiveMinutes() {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    dismissConfirmationStorageKey,
    String(Date.now() + 5 * 60 * 1000),
  );
}

function highestSeverity(issues: ValidationIssue[]) {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.some((issue) => issue.severity === "warning")) return "warning";
  return "neutral";
}

export function issueIsDismissed(
  scope: string,
  issue: ValidationIssue,
  dismissedWarnings: DismissedWarning[] = [],
) {
  if (issue.severity === "critical") return false;

  const dismissed = dismissedWarningForIssue(scope, issue, dismissedWarnings);
  if (!dismissed) return false;

  return !shouldAutoReinstate(issue, dismissed);
}

export function activeIssuesForScope(
  scope: string,
  issues: ValidationIssue[],
  dismissedWarnings: DismissedWarning[] = [],
) {
  return issues.filter(
    (issue) => !issueIsDismissed(scope, issue, dismissedWarnings),
  );
}

export function dismissedIssuesForScope(
  scope: string,
  issues: ValidationIssue[],
  dismissedWarnings: DismissedWarning[] = [],
) {
  return issues.filter((issue) => issueIsDismissed(scope, issue, dismissedWarnings));
}

export function hasActiveWarnings(
  scope: string,
  issues: ValidationIssue[],
  dismissedWarnings: DismissedWarning[] = [],
) {
  return activeIssuesForScope(scope, issues, dismissedWarnings).length > 0;
}

export function WarningPanel({
  scope,
  title,
  issues,
  plannerState,
  setPlannerState,
}: WarningPanelProps) {
  const [activeOpen, setActiveOpen] = useState(true);
  const [dismissedOpen, setDismissedOpen] = useState(false);
  const [pendingDismissIssue, setPendingDismissIssue] =
    useState<ValidationIssue | null>(null);
  const [muteConfirmation, setMuteConfirmation] = useState(false);

  const dismissedWarnings = plannerState.dismissedWarnings ?? [];
  const activeIssues = activeIssuesForScope(scope, issues, dismissedWarnings);
  const dismissedIssues = dismissedIssuesForScope(scope, issues, dismissedWarnings);
  const activeSeverity = highestSeverity(activeIssues);

  function commitDismissIssue(issue: ValidationIssue) {
    const nextDismissedWarnings = dismissedWarnings.filter(
      (dismissed) =>
        !(dismissed.scope === scope && dismissed.issueId === issue.id),
    );

    nextDismissedWarnings.push({
      scope,
      issueId: issue.id,
      message: issue.message,
      context: issue.context,
      dismissedAtValue: warningCurrentValue(issue),
      dismissedAt: new Date().toISOString(),
    });

    setPlannerState({
      ...plannerState,
      dismissedWarnings: nextDismissedWarnings,
    });
  }

  function dismissIssue(issue: ValidationIssue) {
    if (issue.severity === "critical") return;

    if (dismissalConfirmationIsMuted()) {
      commitDismissIssue(issue);
      return;
    }

    setMuteConfirmation(false);
    setPendingDismissIssue(issue);
  }

  function confirmDismissIssue() {
    if (!pendingDismissIssue) return;

    if (muteConfirmation) {
      muteDismissalConfirmationForFiveMinutes();
    }

    commitDismissIssue(pendingDismissIssue);
    setPendingDismissIssue(null);
    setMuteConfirmation(false);
  }

  function reinstateIssue(issue: ValidationIssue) {
    setPlannerState({
      ...plannerState,
      dismissedWarnings: dismissedWarnings.filter(
        (dismissed) =>
          !(dismissed.scope === scope && dismissed.issueId === issue.id),
      ),
    });
  }

  if (issues.length === 0) return null;

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.title}>{title}</h3>
          <p style={styles.helpText}>
            Critical warnings must be resolved. Non-critical warnings can be dismissed by the system designer where diversity or site-specific judgement has been considered.
          </p>
        </div>
        <div style={styles.countRow}>
          <span style={styles.criticalCount}>
            {activeIssues.filter((issue) => issue.severity === "critical").length} critical
          </span>
          <span style={styles.warningCount}>
            {activeIssues.filter((issue) => issue.severity === "warning").length} active
          </span>
          <span style={styles.dismissedCount}>
            {dismissedIssues.length} dismissed
          </span>
        </div>
      </div>

      <WarningGroup
        title={`Active Warnings (${activeIssues.length})`}
        open={activeOpen}
        setOpen={setActiveOpen}
        severity={activeSeverity}
      >
        {activeIssues.length === 0 ? (
          <p style={styles.emptyText}>No active warnings.</p>
        ) : (
          <div style={styles.issueList}>
            {activeIssues.map((issue) => {
              const reinstatementInfo = reinstatementInfoForIssue(
                scope,
                issue,
                dismissedWarnings,
              );

              return (
              <div
                key={warningKey(scope, issue)}
                style={{
                  ...styles.issueItem,
                  ...(issue.severity === "critical"
                    ? styles.issueCritical
                    : styles.issueWarning),
                }}
              >
                <div>
                  <strong>
                    {issue.severity === "critical" ? "Critical" : "Warning"}
                  </strong>
                  <span style={styles.issueMessage}>{issue.message}</span>
                </div>
                {issue.severity === "warning" && (
                  <button style={styles.smallButton} onClick={() => dismissIssue(issue)}>
                    Dismiss
                  </button>
                )}
                {reinstatementInfo && (
                  <div style={styles.reinstatedNotice}>
                    <strong>Automatically reinstated</strong>
                    <span>{reinstatementInfo.text}</span>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </WarningGroup>

      <WarningGroup
        title={`Dismissed Warnings (${dismissedIssues.length})`}
        open={dismissedOpen}
        setOpen={setDismissedOpen}
        severity="neutral"
      >
        {dismissedIssues.length === 0 ? (
          <p style={styles.emptyText}>No dismissed warnings.</p>
        ) : (
          <div style={styles.issueList}>
            {dismissedIssues.map((issue) => (
              <div key={warningKey(scope, issue)} style={styles.dismissedIssueItem}>
                <div>
                  <strong>Dismissed</strong>
                  <span style={styles.issueMessage}>{issue.message}</span>
                  {(() => {
                    const dismissed = dismissedWarningForIssue(
                      scope,
                      issue,
                      dismissedWarnings,
                    );
                    const dismissedAt = formatDismissedAt(dismissed?.dismissedAt);
                    return dismissedAt ? (
                      <span style={styles.dismissedMeta}>Dismissed {dismissedAt}</span>
                    ) : null;
                  })()}
                </div>
                <button style={styles.smallButton} onClick={() => reinstateIssue(issue)}>
                  Reinstate
                </button>
              </div>
            ))}
          </div>
        )}
      </WarningGroup>

      {pendingDismissIssue && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Dismiss warning?</h3>
            <p style={styles.modalText}>
              Only dismiss this warning if the system designer has accounted for diversity factors or other site-specific conditions.
            </p>
            <div style={styles.modalWarningBox}>
              <strong>Warning</strong>
              <span style={styles.issueMessage}>{pendingDismissIssue.message}</span>
            </div>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={muteConfirmation}
                onChange={(event) => setMuteConfirmation(event.target.checked)}
              />
              Do not show this confirmation again for 5 minutes
            </label>

            <div style={styles.modalButtonRow}>
              <button
                style={styles.cancelButton}
                onClick={() => {
                  setPendingDismissIssue(null);
                  setMuteConfirmation(false);
                }}
              >
                Cancel
              </button>
              <button style={styles.confirmButton} onClick={confirmDismissIssue}>
                Dismiss Warning
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function WarningGroup({
  title,
  open,
  setOpen,
  severity,
  children,
}: {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  severity: "critical" | "warning" | "neutral";
  children: ReactNode;
}) {
  const groupStyle =
    severity === "critical"
      ? styles.groupCritical
      : severity === "warning"
        ? styles.groupWarning
        : styles.groupNeutral;

  const groupHeaderStyle =
    severity === "critical"
      ? styles.groupHeaderCritical
      : severity === "warning"
        ? styles.groupHeaderWarning
        : styles.groupHeaderNeutral;

  return (
    <section style={{ ...styles.group, ...groupStyle }}>
      <button
        style={{ ...styles.groupHeader, ...groupHeaderStyle }}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={styles.groupBody}>{children}</div>}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    padding: "14px",
    background: "#F8FAFC",
    margin: "16px 0 20px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
  },
  helpText: {
    margin: "4px 0 0",
    color: "#667085",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  countRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  criticalCount: {
    border: "1px solid #E5484D",
    borderRadius: "999px",
    padding: "4px 8px",
    background: "#FDECEC",
    color: "#8A1F24",
    fontSize: "12px",
    fontWeight: 400,
    whiteSpace: "nowrap",
  },
  warningCount: {
    border: "1px solid #D4A72C",
    borderRadius: "999px",
    padding: "4px 8px",
    background: "#FFF3C4",
    color: "#6B4E00",
    fontSize: "12px",
    fontWeight: 400,
    whiteSpace: "nowrap",
  },
  dismissedCount: {
    border: "1px solid #D0D5DD",
    borderRadius: "999px",
    padding: "4px 8px",
    background: "#FFFFFF",
    color: "#475467",
    fontSize: "12px",
    fontWeight: 400,
    whiteSpace: "nowrap",
  },
  group: {
    borderRadius: "12px",
    marginTop: "8px",
    overflow: "hidden",
  },
  groupCritical: {
    border: "1px solid #E5484D",
    background: "#FEF2F2",
  },
  groupWarning: {
    border: "1px solid #F2C94C",
    background: "#FFFBEB",
  },
  groupNeutral: {
    border: "1px solid #DCE5EC",
    background: "#FFFFFF",
  },
  groupHeader: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    border: 0,
    cursor: "pointer",
    fontWeight: 400,
  },
  groupHeaderCritical: {
    background: "#FDECEC",
    color: "#8A1F24",
  },
  groupHeaderWarning: {
    background: "#FFF3C4",
    color: "#6B4E00",
  },
  groupHeaderNeutral: {
    background: "#F8FAFC",
    color: "#344054",
  },
  groupBody: {
    padding: "12px",
  },
  issueList: {
    display: "grid",
    gap: "8px",
  },
  issueItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "center",
    borderRadius: "10px",
    padding: "10px",
    border: "1px solid transparent",
  },
  issueCritical: {
    borderColor: "#E5484D",
    background: "#FDECEC",
  },
  issueWarning: {
    borderColor: "#F2C94C",
    background: "#FFF7D6",
  },
  dismissedIssueItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    borderRadius: "10px",
    padding: "10px",
    border: "1px solid #D0D5DD",
    background: "#F8FAFC",
    color: "#475467",
  },
  issueMessage: {
    display: "block",
    marginTop: "2px",
    fontSize: "13px",
  },
  reinstatedNotice: {
    gridColumn: "1 / -1",
    border: "1px solid #BFDBFE",
    borderRadius: "10px",
    padding: "8px 10px",
    background: "#EFF6FF",
    color: "#1D4ED8",
    fontSize: "12px",
    lineHeight: 1.35,
  },
  dismissedMeta: {
    display: "block",
    marginTop: "4px",
    color: "#667085",
    fontSize: "12px",
  },
  smallButton: {
    padding: "7px 10px",
    borderRadius: "8px",
    border: "1px solid #D0D5DD",
    background: "white",
    color: "#344054",
    cursor: "pointer",
    fontWeight: 400,
    whiteSpace: "nowrap",
  },
  emptyText: {
    margin: 0,
    color: "#667085",
    fontSize: "13px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(17, 24, 39, 0.45)",
  },
  modalCard: {
    width: "100%",
    maxWidth: "520px",
    borderRadius: "16px",
    border: "1px solid #DCE5EC",
    background: "white",
    padding: "18px",
    boxShadow: "0 18px 45px rgba(17, 24, 39, 0.22)",
  },
  modalTitle: {
    margin: 0,
    fontSize: "18px",
  },
  modalText: {
    margin: "8px 0 12px",
    color: "#667085",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  modalWarningBox: {
    border: "1px solid #F2C94C",
    borderRadius: "12px",
    background: "#FFF7D6",
    padding: "10px",
    marginBottom: "12px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#344054",
    fontSize: "13px",
    cursor: "pointer",
  },
  modalButtonRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "16px",
  },
  cancelButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #D0D5DD",
    background: "white",
    color: "#344054",
    cursor: "pointer",
    fontWeight: 400,
  },
  confirmButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #B7791F",
    background: "#B7791F",
    color: "white",
    cursor: "pointer",
    fontWeight: 400,
  },
};
