import Link from "next/link";
import { DocsSearch } from "./DocsSearch";
import { docArticles, docCategories } from "./docsData";

export const metadata = {
  title: "Documentation | LVA Power Planner",
  description: "User guides and technical documentation for LVA Power Planner.",
};

export default function DocsHomePage() {
  const featuredArticles = ["creating-projects", "system-overview", "distro-editor", "reports"]
    .map((slug) => docArticles.find((article) => article.slug === slug))
    .filter(Boolean);

  return (
    <main style={styles.page}>
      <style>{responsiveStyles}</style>
      <header style={styles.header}>
        <nav style={styles.topNav}>
          <Link href="/" style={styles.homeLink}>← LVA Power Planner</Link>
          <div style={styles.topLinks}>
            <Link href="/privacy" style={styles.topLink}>Privacy</Link>
            <Link href="/terms" style={styles.topLink}>Terms</Link>
            <a href="mailto:hello@lvapowerplanner.com" style={styles.topLink}>Contact</a>
          </div>
        </nav>

        <img src="/lva-logo.png" alt="LVA Power Planner" style={styles.logo} />
        <p style={styles.kicker}>LVA Docs</p>
        <h1 style={styles.title}>Documentation Centre</h1>
        <p style={styles.subtitle}>
          Searchable product documentation for LVA Power Planner, covering projects,
          power sources, distros, reporting, warnings and best practice.
        </p>

        <div style={styles.metricsRow}>
          <span style={styles.metric}><strong>{docArticles.length}</strong> articles</span>
          <span style={styles.metric}><strong>{docCategories.length}</strong> categories</span>
          <span style={styles.metric}><strong>v1.0</strong> docs</span>
        </div>
      </header>

      <section style={styles.content}>
        <DocsSearch />

        <section style={styles.featuredSection}>
          <div style={styles.sectionHeadingRow}>
            <div>
              <p style={styles.kickerSmall}>Start here</p>
              <h2 style={styles.sectionHeading}>Common workflows</h2>
            </div>
          </div>

          <div style={styles.featuredGrid}>
            {featuredArticles.map((article) => article && (
              <Link key={article.slug} href={`/docs/${article.slug}`} style={styles.featuredCard}>
                <span style={styles.category}>{article.category}</span>
                <strong>{article.title}</strong>
                <p>{article.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section style={styles.categorySection}>
          <div style={styles.sectionHeadingRow}>
            <div>
              <p style={styles.kickerSmall}>Browse</p>
              <h2 style={styles.sectionHeading}>All documentation</h2>
            </div>
          </div>

          <div style={styles.categoryGrid}>
            {docCategories.map((category) => (
              <section key={category.title} style={styles.categoryCard}>
                <h3 style={styles.categoryTitle}>{category.title}</h3>
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
        </section>
      </section>
    </main>
  );
}

const responsiveStyles = `
  @media (max-width: 720px) {
    [data-docs-top-links] { display: none !important; }
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
    padding: "26px 24px 56px",
    textAlign: "center",
    background: "radial-gradient(circle at top, #FFFFFF 0%, #F5F7FA 64%)",
  },
  topNav: {
    maxWidth: "1180px",
    margin: "0 auto 28px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  homeLink: {
    color: "#667085",
    textDecoration: "none",
    fontWeight: 700,
  },
  topLinks: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
  },
  topLink: {
    color: "#667085",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "14px",
  },
  logo: {
    width: "104px",
    height: "104px",
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
  },
  title: {
    margin: "10px auto 0",
    maxWidth: "920px",
    fontSize: "clamp(42px, 7vw, 78px)",
    lineHeight: 0.95,
    letterSpacing: "-0.065em",
  },
  subtitle: {
    maxWidth: "780px",
    margin: "22px auto 0",
    color: "#667085",
    fontSize: "20px",
    lineHeight: 1.55,
  },
  metricsRow: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "24px",
  },
  metric: {
    padding: "9px 13px",
    border: "1px solid #DCE5EC",
    borderRadius: "999px",
    background: "white",
    color: "#667085",
    fontSize: "14px",
  },
  content: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "0 24px 76px",
  },
  featuredSection: {
    marginTop: "32px",
  },
  categorySection: {
    marginTop: "34px",
  },
  sectionHeadingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: "16px",
    marginBottom: "16px",
  },
  kickerSmall: {
    margin: 0,
    color: "#667085",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  sectionHeading: {
    margin: "5px 0 0",
    fontSize: "32px",
    letterSpacing: "-0.045em",
  },
  featuredGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "16px",
  },
  featuredCard: {
    display: "grid",
    alignContent: "start",
    gap: "9px",
    minHeight: "170px",
    padding: "22px",
    borderRadius: "24px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#172033",
    textDecoration: "none",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  category: {
    color: "#667085",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "18px",
  },
  categoryCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "24px",
    padding: "22px",
    background: "white",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  categoryTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
  },
  categoryDescription: {
    margin: "0 0 16px",
    color: "#667085",
    lineHeight: 1.5,
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
