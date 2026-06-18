type LoginFormProps = {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  signIn: () => void;
};

export function LoginForm({
  email,
  password,
  setEmail,
  setPassword,
  signIn,
}: LoginFormProps) {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>LVA Power Planner</h1>
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
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>

        <div style={styles.row}>
          <button style={styles.button} onClick={signIn}>
            Sign In
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
    fontFamily: "'Outfit', Arial, sans-serif",
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
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
  },
};

