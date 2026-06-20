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

type LoginFormProps = {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  signIn: () => void;
  requestPasswordReset: () => void;
  workspaceBranding?: WorkspaceBranding;
};


const defaultWorkspaceFont = "'Outfit', Arial, sans-serif";
const defaultWorkspaceHighlight = "#172033";
const defaultWorkspaceDarkButton = "#172033";

function workspaceFontFamily(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.font_family?.trim() || defaultWorkspaceFont;
}

function workspaceHighlightColour(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.highlight_colour?.trim() || defaultWorkspaceHighlight;
}

function workspaceDarkButtonColour(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.dark_button_colour?.trim() || defaultWorkspaceDarkButton;
}

function workspaceThemeStyle(workspaceBranding?: WorkspaceBranding): React.CSSProperties {
  return {
    fontFamily: workspaceFontFamily(workspaceBranding),
    "--lva-workspace-highlight": workspaceHighlightColour(workspaceBranding),
    "--lva-workspace-dark-button": workspaceDarkButtonColour(workspaceBranding),
    "--lva-ui-hover": workspaceBranding?.highlight_colour?.trim()
      ? `${workspaceHighlightColour(workspaceBranding)}14`
      : "rgba(158, 158, 158, 0.07)",
    "--lva-ui-border-hover": workspaceHighlightColour(workspaceBranding),
  } as React.CSSProperties;
}

function isLvaBrand(workspaceBranding?: WorkspaceBranding) {
  return !workspaceBranding?.company_name ||
    workspaceBranding.company_name.trim().toLowerCase() === "lva power planner";
}

export function LoginForm({
  email,
  password,
  setEmail,
  setPassword,
  signIn,
  requestPasswordReset,
  workspaceBranding,
}: LoginFormProps) {
  const companyName = workspaceBranding?.company_name?.trim() || "LVA Power Planner";
  const showPoweredBy = !isLvaBrand(workspaceBranding);

  return (
    <main style={{ ...styles.page, ...workspaceThemeStyle(workspaceBranding) }}>
      <section style={styles.card}>
        {workspaceBranding?.logo_url && (
          <img
            src={workspaceBranding.logo_url}
            alt={`${companyName} logo`}
            style={styles.logo}
          />
        )}

        <h1>{companyName}</h1>
        {showPoweredBy && <p style={styles.poweredBy}>Powered by LVA Power Planner</p>}
        <p style={styles.muted}>
          Please sign in using the account provided by your administrator.
        </p>

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>

        <div style={styles.row}>
          <button style={styles.button} onClick={signIn}>
            Sign In
          </button>
          <button style={styles.linkButton} onClick={requestPasswordReset}>
            Reset Password
          </button>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "40px",
    color: "#000000",
    background: "#f5f7fb",
  },
  card: {
    maxWidth: "420px",
    margin: "0 auto",
    background: "white",
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid #d9e0ea",
  },
  logo: {
    maxWidth: "150px",
    maxHeight: "70px",
    objectFit: "contain",
    marginBottom: "16px",
  },
  poweredBy: {
    marginTop: "-8px",
    marginBottom: "16px",
    color: "#637083",
    fontSize: "13px",
    fontWeight: 400,
  },
  muted: {
    color: "#000000",
  },
  label: {
    display: "block",
    marginTop: "12px",
    marginBottom: "12px",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
  },
  row: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button, #172033)",
    background: "var(--lva-workspace-dark-button, #172033)",
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
  },
  linkButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    fontWeight: 500,
  },
};
