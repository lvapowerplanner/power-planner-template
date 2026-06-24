import Link from "next/link";
import { DocsSearch } from "./DocsSearch";
import { docArticles, docCategories } from "./docsData";

export const metadata = {
  title: "Documentation | LVA Power Planner",
  description: "User guides and technical documentation for LVA Power Planner.",
};

export default function DocsHomePage() {
  return (
    <main style={styles.page}>
      <style>{responsiveStyles}</style>
      <header style={styles.header}>
        <nav style={styles.topNav}>
          <Link href="/" style={styles.homeLink}>← Main website</Link>
          <Link href="mailto:hello@lvapowerplanner.com" style={styles.homeLink}>Support</Link>
        </nav>
        <img src="/lva-logo.png" alt="LVA Power Planner" style={styles.logo} />
        <p style={styles.kicker}>LVA Docs</p>
        <h1 style={styles.title}>Documentation Centre</h1>
        <p style={styles.subtitle}>
          Searchable product documentation for LVA Power Planner, covering projects,
          power sources, distros, reporting, warnings and best practice.
        </p>
        <div style={styles.statsRow}>
          <span>{docArticles.length} articles</span>
          <span>{docCategories.length} categories</span>
          <span>Updated June 2026</span>
        </div>
      </header>

      <section style={styles.content}>
        <DocsSearch />

        <div style={styles.categoryGrid}>
          {docCategories.map((category) => (
            <section key={category.title} style={styles.categoryCard}>
              <div style={styles.categoryHeader}>
                <h2 style={styles.categoryTitle}>{category.title}</h2>
                <span style={styles.articleCount}>{category.items.length}</span>
              </div>
              <p style={styles.categoryDescription}>{category.description}</p>
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

        <section style={styles.footerCta}>
          <div>
            <p style={styles.kicker}>Need more help?</p>
            <h2 style={styles.footerTitle}>Contact LVA Power Planner support</h2>
            <p style={styles.footerText}>
              If an article is missing or unclear, send feedback and it can be added to the documentation centre.
            </p>
          </div>
          <a href="mailto:hello@lvapowerplanner.com" style={styles.primaryLink}>Email support</a>
        </section>
      </section>
    </main>
  );
}

const responsiveStyles = `
  @media (max-width: 760px) {
    .docs-top-nav { flex-direction: column; align-items: center; }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F5F7FA",
    color: "#172033",
    fontFamily: "'Outfit', Arial, sans-serif",
  },
  header: {
    padding: "28px 24px 52px",
    textAlign: "center",
    background: "linear-gradient(180deg, #FFFFFF 0%, #F5F7FA 100%)",
  },
  topNav: {
    display: "flex",
    justifyContent: "center",
    gap: "16px",
    marginBottom: "24px",
  },
  homeLink: {
    color: "#667085",
    textDecoration: "none",
    fontWeight: 700,
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
    fontWeight: 900,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    fontSize: "12px",
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
  statsRow: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "22px",
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
  categoryHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  categoryTitle: {
    margin: 0,
    fontSize: "20px",
  },
  articleCount: {
    minWidth: "32px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    background: "#F2F4F7",
    color: "#667085",
    fontWeight: 900,
  },
  categoryDescription: {
    color: "#667085",
    lineHeight: 1.55,
    marginBottom: "16px",
  },
  articleList: {
    display: "grid",
    gap: "10px",
  },
  articleLink: {
    display: "grid",
    gap: "5px",
    padding: "14px",
    border: "1px solid #E5EAF0",
    borderRadius: "16px",
    color: "#172033",
    textDecoration: "none",
    background: "#F8FAFC",
  },
  footerCta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    marginTop: "26px",
    padding: "26px",
    borderRadius: "28px",
    background: "#172033",
    color: "white",
  },
  footerTitle: {
    margin: "8px 0 0",
    fontSize: "28px",
    letterSpacing: "-0.04em",
  },
  footerText: {
    marginBottom: 0,
    color: "#D0D5DD",
    lineHeight: 1.6,
  },
  primaryLink: {
    display: "inline-flex",
    flexShrink: 0,
    padding: "12px 16px",
    borderRadius: "999px",
    background: "white",
    color: "#172033",
    textDecoration: "none",
    fontWeight: 900,
  },
};
