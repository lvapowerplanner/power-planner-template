import Link from "next/link";
import { DocsSearch } from "./DocsSearch";
import { docCategories } from "./docsData";

export const metadata = {
  title: "Documentation | LVA Power Planner",
  description: "User guides and technical documentation for LVA Power Planner.",
};

export default function DocsHomePage() {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/" style={styles.homeLink}>← LVA Power Planner</Link>
        <img src="/lva-logo.png" alt="LVA Power Planner" style={styles.logo} />
        <p style={styles.kicker}>LVA Docs</p>
        <h1 style={styles.title}>Documentation Centre</h1>
        <p style={styles.subtitle}>
          Searchable product documentation for LVA Power Planner, covering projects,
          power sources, distros, reporting, warnings and best practice.
        </p>
      </header>

      <section style={styles.content}>
        <DocsSearch />

        <div style={styles.categoryGrid}>
          {docCategories.map((category) => (
            <section key={category.title} style={styles.categoryCard}>
              <h2 style={styles.categoryTitle}>{category.title}</h2>
              <div style={styles.articleList}>
                {category.items.map((item) => (
                  <Link key={item.slug} href={`/docs/${item.slug}`} style={styles.articleLink}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F5F7FA",
    color: "#172033",
    fontFamily: "'Outfit', Arial, sans-serif",
  },
  header: {
    padding: "32px 24px 52px",
    textAlign: "center",
    background: "linear-gradient(180deg, #FFFFFF 0%, #F5F7FA 100%)",
  },
  homeLink: {
    display: "inline-block",
    marginBottom: "24px",
    color: "#667085",
    textDecoration: "none",
    fontWeight: 600,
  },
  logo: {
    width: "96px",
    height: "96px",
    objectFit: "contain",
    display: "block",
    margin: "0 auto 18px",
  },
  kicker: {
    margin: 0,
    color: "#667085",
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  title: {
    margin: "10px auto 0",
    maxWidth: "880px",
    fontSize: "clamp(42px, 7vw, 76px)",
    lineHeight: 0.95,
    letterSpacing: "-0.06em",
  },
  subtitle: {
    maxWidth: "760px",
    margin: "20px auto 0",
    color: "#667085",
    fontSize: "20px",
    lineHeight: 1.55,
  },
  content: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "0 24px 72px",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
    marginTop: "22px",
  },
  categoryCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "24px",
    padding: "22px",
    background: "white",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  categoryTitle: {
    margin: "0 0 14px",
    fontSize: "20px",
  },
  articleList: {
    display: "grid",
    gap: "10px",
  },
  articleLink: {
    display: "grid",
    gap: "5px",
    padding: "13px 14px",
    borderRadius: "14px",
    background: "#F8FAFC",
    border: "1px solid #E5EAF0",
    color: "#172033",
    textDecoration: "none",
  },
};
