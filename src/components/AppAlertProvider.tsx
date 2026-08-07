"use client";

import { useEffect, useState } from "react";
import { registerAppConfirmHandler } from "@/lib/appDialogs";

type ConfirmRequest = {
  message: string;
  resolve: (confirmed: boolean) => void;
};

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<string[]>([]);
  const [confirmations, setConfirmations] = useState<ConfirmRequest[]>([]);

  useEffect(() => {
    const browserAlert = window.alert;

    window.alert = (message?: unknown) => {
      setMessages((current) => [...current, String(message ?? "")]);
    };

    registerAppConfirmHandler(
      (message) =>
        new Promise<boolean>((resolve) => {
          setConfirmations((current) => [...current, { message, resolve }]);
        }),
    );

    return () => {
      window.alert = browserAlert;
      registerAppConfirmHandler(null);
      setConfirmations((current) => {
        current.forEach((request) => request.resolve(false));
        return [];
      });
    };
  }, []);

  const currentMessage = messages[0];
  const currentConfirmation = confirmations[0];

  function closeAlert() {
    setMessages((current) => current.slice(1));
  }

  function answerConfirmation(confirmed: boolean) {
    currentConfirmation?.resolve(confirmed);
    setConfirmations((current) => current.slice(1));
  }

  return (
    <>
      {children}
      {currentConfirmation !== undefined && (
        <div style={styles.backdrop} role="presentation">
          <section
            style={styles.modal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="application-confirm-title"
            aria-describedby="application-confirm-message"
          >
            <div style={styles.confirmIcon} aria-hidden="true">
              ?
            </div>
            <div>
              <h2 id="application-confirm-title" style={styles.title}>
                Confirm action
              </h2>
              <p id="application-confirm-message" style={styles.message}>
                {currentConfirmation.message}
              </p>
            </div>
            <div style={styles.actions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => answerConfirmation(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={() => answerConfirmation(true)}
              >
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}
      {currentMessage !== undefined && (
        <div style={styles.backdrop} role="presentation">
          <section
            style={styles.modal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="application-alert-title"
            aria-describedby="application-alert-message"
          >
            <div style={styles.icon} aria-hidden="true">
              i
            </div>
            <div>
              <h2 id="application-alert-title" style={styles.title}>
                LVA Power Planner
              </h2>
              <p id="application-alert-message" style={styles.message}>
                {currentMessage}
              </p>
            </div>
            <div style={styles.actions}>
              <button type="button" style={styles.button} onClick={closeAlert}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000000,
    display: "grid",
    placeItems: "center",
    padding: "20px",
    background: "rgba(15, 23, 42, 0.55)",
  },
  modal: {
    width: "min(520px, 100%)",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "14px",
    padding: "22px",
    borderRadius: "14px",
    border: "1px solid #d9e0ea",
    background: "white",
    boxShadow: "0 20px 55px rgba(0, 0, 0, 0.25)",
    color: "#172033",
  },
  icon: {
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "#e8eef5",
    color: "#344054",
    fontWeight: 700,
  },
  confirmIcon: {
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "#fff4d6",
    color: "#8a5b00",
    fontWeight: 700,
  },
  title: { margin: 0, fontSize: "20px" },
  message: {
    margin: "8px 0 0",
    color: "#475467",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  actions: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button, #172033)",
    background: "var(--lva-workspace-dark-button, #172033)",
    color: "white",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 500,
  },
  secondaryButton: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #cfd7e3",
    background: "white",
    color: "#344054",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 500,
  },
};
