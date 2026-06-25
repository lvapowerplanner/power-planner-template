import Link from "next/link";
import { DocsCommandPalette, DocsSearch } from "./DocsSearch";
import { DocsSidebar, DocsStyles, DocsTopBar } from "./DocsLayoutComponents";
import { docArticles, docCategories } from "./docsData";

export const metadata = {
  title: "Documentation | LVA Power Planner",
  description: "User guides and technical documentation for LVA Power Planner.",
};

export default function DocsHomePage() {
  const featuredArticles = docArticles.filter((article) =>
    ["introduction", "system-overview", "distro-editor", "reports"].includes(article.slug),
  );

  return (
    <main style={styles.shell} className="docs-shell">
      <DocsStyles />
      <DocsCommandPalette />
      <DocsSidebar />

      <section style={styles.main} className="docs-main">
        <DocsTopBar />
        <header style={styles.hero}>
          <img src="/lva-logo.png" alt="LVA Power Planner" style={styles.logo} />
          <p style={styles.kicker}>LVA Docs</p>
          <h1 style={styles.title}>Documentation Centre</h1>
          <p style={styles.subtitle}>
            Searchable product documentation for LVA Power Planner, covering projects,
            power sources, distros, reports, warnings and best practice.
          </p>
          <div style={styles.statsRow}>
            <span>{docArticles.length} articles</span>
            <span>{docCategories.length} categories</span>
            <span>Updated June 2026</span>
          </div>
        </header>

        <section style={styles.content}>
          <DocsSearch />

          <section style={styles.featuredSection}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.kicker}>Start here</p>
                <h2 style={styles.sectionTitle}>Popular guides</h2>
              </div>
              <Link href="/docs/introduction" style={styles.smallLink}>Read introduction →</Link>
            </div>
            <div style={styles.featuredGrid} className="docs-featured-grid">
              {featuredArticles.map((article) => (
                <Link key={article.slug} href={`/docs/${article.slug}`} style={styles.featuredCard}>
                  <span style={styles.featuredCategory}>{article.category}</span>
                  <strong>{article.title}</strong>
                  <span>{article.description}</span>
                </Link>
              ))}
            </div>
          </section>

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
              <p style={styles.kicker}>Support</p>
              <h2 style={styles.footerTitle}>Need help with LVA Power Planner?</h2>
              <p style={styles.footerText}>
                Contact support for onboarding, documentation requests or product demonstrations.
              </p>
            </div>
            <a href="mailto:hello@lvapowerplanner.com" style={styles.ctaButton}>Contact support</a>
          </section>
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "290px 1fr",
    background: "#F9FAFB",
    color: "#111827",
  },
  main: { padding: "32px" },
  hero: {
    maxWidth: "1180px",
    margin: "0 auto 26px",
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "28px",
    padding: "52px",
    textAlign: "center",
    boxShadow: "0 18px 50px rgba(17, 24, 39, 0.05)",
  },
  logo: { width: "112px", height: "112px", objectFit: "contain", marginBottom: "16px" },
  kicker: { margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.09em", color: "#667085", fontSize: "12px", fontWeight: 900 },
  title: { margin: 0, fontSize: "clamp(44px, 7vw, 82px)", lineHeight: 0.92, letterSpacing: "-0.06em" },
  subtitle: { maxWidth: "720px", margin: "20px auto 0", color: "#475467", fontSize: "20px", lineHeight: 1.55 },
  statsRow: { display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginTop: "24px", color: "#475467", fontSize: "13px", fontWeight: 800 },
  content: { maxWidth: "1180px", margin: "0 auto", display: "grid", gap: "22px" },
  featuredSection: { background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "24px", padding: "24px" },
  sectionHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "16px" },
  sectionTitle: { margin: 0, fontSize: "30px", letterSpacing: "-0.04em" },
  smallLink: { color: "#111827", textDecoration: "none", fontWeight: 900, whiteSpace: "nowrap" },
  featuredGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  featuredCard: { display: "grid", gap: "8px", textDecoration: "none", color: "#344054", border: "1px solid #E5E7EB", borderRadius: "16px", padding: "16px", background: "#FCFCFD" },
  featuredCategory: { color: "#667085", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  categoryGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" },
  categoryCard: { background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "22px", padding: "22px" },
  categoryHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" },
  categoryTitle: { margin: 0, fontSize: "24px", letterSpacing: "-0.03em" },
  articleCount: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "999px", background: "#F2F4F7", fontWeight: 900 },
  categoryDescription: { color: "#667085", lineHeight: 1.55 },
  articleList: { display: "grid", gap: "9px" },
  articleLink: { display: "grid", gap: "4px", textDecoration: "none", color: "#344054", border: "1px solid #F2F4F7", borderRadius: "14px", padding: "12px", background: "#FCFCFD" },
  footerCta: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", background: "#111827", color: "white", borderRadius: "24px", padding: "28px", marginBottom: "30px" },
  footerTitle: { margin: 0, fontSize: "28px" },
  footerText: { margin: "8px 0 0", color: "#D0D5DD" },
  ctaButton: { padding: "11px 15px", borderRadius: "12px", background: "white", color: "#111827", textDecoration: "none", fontWeight: 900, whiteSpace: "nowrap" },
};
