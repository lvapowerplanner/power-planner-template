import Link from "next/link";
import { docCategories, type CalloutType, type DocArticle } from "./docsData";

export function sectionId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function DocsStyles() {
  return <style>{responsiveStyles}</style>;
}

export function DocsSidebar({ activeSlug }: { activeSlug?: string }) {
  return (
    <aside style={styles.sidebar} className="docs-sidebar">
      <Link href="/docs" style={styles.sidebarBrand}>
        <img src="/lva-logo.png" alt="" style={styles.sidebarLogo} />
        <span>LVA Docs</span>
      </Link>

      <nav style={styles.nav} aria-label="Documentation navigation">
        {docCategories.map((category) => (
          <section key={category.title} style={styles.navSection}>
            <p style={styles.navCategory}>{category.title}</p>
            <div style={styles.navItems}>
              {category.items.map((item) => {
                const active = item.slug === activeSlug;
                return (
                  <Link
                    key={item.slug}
                    href={`/docs/${item.slug}`}
                    style={{
                      ...styles.navLink,
                      ...(active ? styles.navLinkActive : {}),
                    }}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}

export function DocsTopBar() {
  return (
    <div style={styles.topBar}>
      <Link href="/" style={styles.topBarLink}>← Main website</Link>
      <Link href="/docs" style={styles.topBarLink}>Docs home</Link>
      <a href="mailto:hello@lvapowerplanner.com" style={styles.topBarLink}>Support</a>
    </div>
  );
}

export function ArticleHeader({ article }: { article: DocArticle }) {
  return (
    <header style={styles.articleHeader}>
      <div style={styles.breadcrumbs}>
        <Link href="/docs" style={styles.breadcrumbLink}>Documentation</Link>
        <span>/</span>
        <span>{article.category}</span>
      </div>
      <p style={styles.kicker}>{article.category}</p>
      <h1 style={styles.articleTitle}>{article.title}</h1>
      <p style={styles.articleSummary}>{article.summary}</p>
      <div style={styles.metaRow}>
        <span>Updated {article.updated}</span>
        <span>{article.readTime}</span>
        <span>{article.sections.length} sections</span>
      </div>
    </header>
  );
}

export function TableOfContents({ article }: { article: DocArticle }) {
  return (
    <aside style={styles.toc} className="docs-toc" aria-label="On this page">
      <p style={styles.tocTitle}>On this page</p>
      {article.sections.map((section) => (
        <a key={section.heading} href={`#${sectionId(section.heading)}`} style={styles.tocLink}>
          {section.heading}
        </a>
      ))}
    </aside>
  );
}

export function Callout({ type, title, body }: { type: CalloutType; title: string; body: string }) {
  const config = calloutConfig[type];
  return (
    <div style={{ ...styles.callout, borderColor: config.border, background: config.background }}>
      <div style={styles.calloutTitleRow}>
        <span aria-hidden="true">{config.icon}</span>
        <strong>{title}</strong>
      </div>
      <p style={styles.calloutBody}>{body}</p>
    </div>
  );
}

export function ArticleBody({ article }: { article: DocArticle }) {
  return (
    <div style={styles.articleBody}>
      {article.sections.map((section) => (
        <section key={section.heading} id={sectionId(section.heading)} style={styles.section}>
          <h2 style={styles.sectionTitle}>{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} style={styles.paragraph}>{paragraph}</p>
          ))}
          {section.steps && (
            <ol style={styles.steps}>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {section.callout && <Callout {...section.callout} />}
        </section>
      ))}
    </div>
  );
}

export function RelatedArticles({ articles }: { articles: DocArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <section style={styles.relatedSection}>
      <h2 style={styles.relatedTitle}>Related articles</h2>
      <div style={styles.relatedGrid}>
        {articles.map((article) => (
          <Link key={article.slug} href={`/docs/${article.slug}`} style={styles.relatedCard}>
            <span style={styles.relatedCategory}>{article.category}</span>
            <strong>{article.title}</strong>
            <span>{article.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PreviousNext({ previous, next }: { previous?: DocArticle; next?: DocArticle }) {
  if (!previous && !next) return null;
  return (
    <nav style={styles.previousNext} aria-label="Article navigation">
      {previous ? (
        <Link href={`/docs/${previous.slug}`} style={styles.previousNextCard}>
          <span>Previous</span>
          <strong>← {previous.title}</strong>
        </Link>
      ) : <span />}
      {next ? (
        <Link href={`/docs/${next.slug}`} style={{ ...styles.previousNextCard, textAlign: "right" }}>
          <span>Next</span>
          <strong>{next.title} →</strong>
        </Link>
      ) : <span />}
    </nav>
  );
}

export function FeedbackPanel() {
  return (
    <section style={styles.feedbackPanel}>
      <div>
        <strong>Was this page helpful?</strong>
        <p style={styles.feedbackText}>Send feedback or request extra documentation for this topic.</p>
      </div>
      <a href="mailto:hello@lvapowerplanner.com?subject=LVA%20Docs%20Feedback" style={styles.feedbackButton}>
        Send feedback
      </a>
    </section>
  );
}

const calloutConfig: Record<CalloutType, { icon: string; border: string; background: string }> = {
  tip: { icon: "💡", border: "#60A5FA", background: "#EFF6FF" },
  warning: { icon: "⚠️", border: "#F59E0B", background: "#FFFBEB" },
  info: { icon: "ℹ️", border: "#94A3B8", background: "#F8FAFC" },
  best: { icon: "✅", border: "#10B981", background: "#ECFDF5" },
  danger: { icon: "⛔", border: "#EF4444", background: "#FEF2F2" },
};

const styles: Record<string, React.CSSProperties> = {
  topBar: { display: "flex", gap: "14px", justifyContent: "flex-end", marginBottom: "22px", flexWrap: "wrap" },
  topBarLink: { color: "#475467", textDecoration: "none", fontSize: "14px", fontWeight: 700 },
  sidebar: { position: "sticky", top: 0, alignSelf: "start", height: "100vh", overflow: "auto", borderRight: "1px solid #E5E7EB", padding: "28px 18px", background: "#FFFFFF" },
  sidebarBrand: { display: "flex", alignItems: "center", gap: "10px", color: "#111827", textDecoration: "none", fontWeight: 900, marginBottom: "24px" },
  sidebarLogo: { width: "34px", height: "34px", objectFit: "contain" },
  nav: { display: "grid", gap: "18px" },
  navSection: { display: "grid", gap: "8px" },
  navCategory: { margin: 0, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#667085", fontWeight: 900 },
  navItems: { display: "grid", gap: "3px" },
  navLink: { color: "#344054", textDecoration: "none", padding: "8px 10px", borderRadius: "10px", fontSize: "14px", border: "1px solid transparent" },
  navLinkActive: { background: "#F2F4F7", color: "#111827", borderColor: "#D0D5DD", fontWeight: 800 },
  articleHeader: { borderBottom: "1px solid #E5E7EB", paddingBottom: "28px", marginBottom: "30px" },
  breadcrumbs: { display: "flex", gap: "8px", flexWrap: "wrap", color: "#667085", fontSize: "14px", marginBottom: "22px" },
  breadcrumbLink: { color: "#344054", textDecoration: "none", fontWeight: 700 },
  kicker: { margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.09em", color: "#667085", fontSize: "12px", fontWeight: 900 },
  articleTitle: { margin: 0, fontSize: "clamp(38px, 6vw, 68px)", lineHeight: 0.95, letterSpacing: "-0.055em", color: "#111827" },
  articleSummary: { maxWidth: "780px", color: "#475467", fontSize: "20px", lineHeight: 1.55, margin: "20px 0 0" },
  metaRow: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "20px", color: "#475467", fontSize: "13px", fontWeight: 800 },
  toc: { position: "sticky", top: "22px", alignSelf: "start", border: "1px solid #E5E7EB", borderRadius: "16px", padding: "16px", background: "#FFFFFF" },
  tocTitle: { margin: "0 0 10px", color: "#111827", fontWeight: 900 },
  tocLink: { display: "block", color: "#475467", textDecoration: "none", padding: "7px 0", fontSize: "14px", borderTop: "1px solid #F2F4F7" },
  articleBody: { display: "grid", gap: "36px" },
  section: { scrollMarginTop: "28px" },
  sectionTitle: { margin: "0 0 12px", fontSize: "28px", letterSpacing: "-0.03em", color: "#111827" },
  paragraph: { color: "#344054", fontSize: "17px", lineHeight: 1.75, margin: "0 0 14px" },
  steps: { color: "#344054", fontSize: "17px", lineHeight: 1.75, paddingLeft: "24px", marginTop: "12px" },
  callout: { marginTop: "18px", border: "1px solid", borderRadius: "16px", padding: "16px" },
  calloutTitleRow: { display: "flex", gap: "10px", alignItems: "center", color: "#111827", marginBottom: "8px" },
  calloutBody: { margin: 0, color: "#344054", lineHeight: 1.6 },
  relatedSection: { borderTop: "1px solid #E5E7EB", marginTop: "38px", paddingTop: "28px" },
  relatedTitle: { margin: "0 0 16px", fontSize: "24px" },
  relatedGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" },
  relatedCard: { display: "grid", gap: "8px", border: "1px solid #E5E7EB", borderRadius: "16px", padding: "16px", color: "#344054", textDecoration: "none", background: "#FFFFFF" },
  relatedCategory: { color: "#667085", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  previousNext: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "24px" },
  previousNextCard: { border: "1px solid #E5E7EB", borderRadius: "16px", padding: "16px", textDecoration: "none", color: "#111827", display: "grid", gap: "6px", background: "#FFFFFF" },
  feedbackPanel: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", marginTop: "24px", border: "1px solid #D0D5DD", borderRadius: "18px", padding: "18px", background: "#F9FAFB" },
  feedbackText: { margin: "4px 0 0", color: "#667085" },
  feedbackButton: { padding: "10px 14px", borderRadius: "10px", background: "#111827", color: "white", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" },
};

const responsiveStyles = `
  @media (max-width: 1100px) {
    .docs-shell { grid-template-columns: 1fr !important; }
    .docs-sidebar { position: relative !important; height: auto !important; border-right: 0 !important; border-bottom: 1px solid #E5E7EB !important; }
    .docs-article-grid { grid-template-columns: 1fr !important; }
    .docs-toc { display: none !important; }
  }
  @media (max-width: 760px) {
    .docs-main { padding: 22px !important; }
    .docs-related-grid { grid-template-columns: 1fr !important; }
  }
`;
