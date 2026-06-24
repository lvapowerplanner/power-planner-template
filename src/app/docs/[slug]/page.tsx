import Link from "next/link";
import { notFound } from "next/navigation";
import {
  articleBySlug,
  docArticles,
  docCategories,
  previousNextArticle,
  relatedArticles,
  type CalloutType,
} from "../docsData";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return docArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = articleBySlug(slug);

  if (!article) {
    return {
      title: "Documentation | LVA Power Planner",
    };
  }

  return {
    title: `${article.title} | LVA Power Planner Docs`,
    description: article.description,
  };
}

export default async function DocArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = articleBySlug(slug);

  if (!article) notFound();

  const { previous, next } = previousNextArticle(slug);
  const related = relatedArticles(article.related);

  return (
    <main style={styles.page}>
      <style>{responsiveStyles}</style>

      <aside style={styles.sidebar} className="docs-sidebar">
        <Link href="/docs" style={styles.sidebarBrand}>
          <img src="/lva-logo.png" alt="" style={styles.sidebarLogo} />
          <span>LVA Docs</span>
        </Link>

        <nav style={styles.nav}>
          {docCategories.map((category) => (
            <section key={category.title} style={styles.navSection}>
              <h2 style={styles.navTitle}>{category.title}</h2>
              {category.items.map((item) => (
                <Link
                  key={item.slug}
                  href={`/docs/${item.slug}`}
                  style={{
                    ...styles.navLink,
                    ...(item.slug === slug ? styles.navLinkActive : {}),
                  }}
                >
                  {item.title}
                </Link>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <article style={styles.article} className="docs-article">
        <div style={styles.mobileNav} className="docs-mobile-nav">
          <Link href="/docs" style={styles.backLink}>← Documentation</Link>
          <Link href="/" style={styles.backLink}>Main site</Link>
        </div>

        <Link href="/docs" style={styles.backLink} className="docs-desktop-back">← Documentation</Link>
        <p style={styles.kicker}>{article.category}</p>
        <h1 style={styles.title}>{article.title}</h1>
        <p style={styles.description}>{article.description}</p>
        <p style={styles.meta}>Updated {article.updated} · {article.readTime}</p>

        <section style={styles.summaryBox}>
          <strong>In this article</strong>
          <p>{article.summary}</p>
        </section>

        <nav style={styles.onThisPage}>
          <span>On this page</span>
          {article.sections.map((section) => (
            <a key={section.heading} href={`#${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              {section.heading}
            </a>
          ))}
        </nav>

        <div style={styles.divider} />

        {article.sections.map((section) => (
          <section
            key={section.heading}
            id={section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
            style={styles.section}
          >
            <h2 style={styles.sectionTitle}>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} style={styles.paragraph}>{paragraph}</p>
            ))}

            {section.steps && (
              <ol style={styles.stepsList}>
                {section.steps.map((step) => (
                  <li key={step} style={styles.stepItem}>{step}</li>
                ))}
              </ol>
            )}

            {section.callout && <Callout {...section.callout} />}
          </section>
        ))}

        {related.length > 0 && (
          <section style={styles.relatedBox}>
            <p style={styles.relatedKicker}>Related articles</p>
            <div style={styles.relatedGrid}>
              {related.map((item) => (
                <Link key={item.slug} href={`/docs/${item.slug}`} style={styles.relatedCard}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section style={styles.feedbackBox}>
          <strong>Was this page helpful?</strong>
          <p style={styles.feedbackText}>Send feedback or improvement suggestions to hello@lvapowerplanner.com.</p>
        </section>

        <nav style={styles.prevNext}>
          {previous ? (
            <Link href={`/docs/${previous.slug}`} style={styles.prevNextLink}>
              <span>Previous</span>
              <strong>{previous.title}</strong>
            </Link>
          ) : <span />}

          {next ? (
            <Link href={`/docs/${next.slug}`} style={{ ...styles.prevNextLink, textAlign: "right" }}>
              <span>Next</span>
              <strong>{next.title}</strong>
            </Link>
          ) : <span />}
        </nav>
      </article>
    </main>
  );
}

function Callout({
  type,
  title,
  body,
}: {
  type: CalloutType;
  title: string;
  body: string;
}) {
  const typeStyle =
    type === "danger"
      ? styles.calloutDanger
      : type === "warning"
        ? styles.calloutWarning
        : type === "tip"
          ? styles.calloutTip
          : type === "best"
            ? styles.calloutBest
            : styles.calloutInfo;

  const label =
    type === "danger"
      ? "Critical"
      : type === "warning"
        ? "Warning"
        : type === "tip"
          ? "Tip"
          : type === "best"
            ? "Best Practice"
            : "Information";

  return (
    <aside style={{ ...styles.callout, ...typeStyle }}>
      <span style={styles.calloutLabel}>{label}</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </aside>
  );
}

const responsiveStyles = `
  html { scroll-behavior: smooth; }
  @media (max-width: 940px) {
    .docs-sidebar { display: none !important; }
    .docs-article { padding: 28px 22px 64px !important; max-width: 100% !important; }
    .docs-mobile-nav { display: flex !important; }
    .docs-desktop-back { display: none !important; }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "310px minmax(0, 1fr)",
    background: "#F5F7FA",
    color: "#172033",
    fontFamily: "'Outfit', Arial, sans-serif",
  },
  sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    padding: "22px",
    borderRight: "1px solid #DCE5EC",
    background: "white",
  },
  sidebarBrand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "24px",
    color: "#172033",
    textDecoration: "none",
    fontWeight: 900,
  },
  sidebarLogo: {
    width: "38px",
    height: "38px",
    objectFit: "contain",
  },
  nav: {
    display: "grid",
    gap: "20px",
  },
  navSection: {
    display: "grid",
    gap: "6px",
  },
  navTitle: {
    margin: "0 0 4px",
    color: "#667085",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  navLink: {
    padding: "9px 10px",
    borderRadius: "10px",
    color: "#344054",
    textDecoration: "none",
    fontSize: "14px",
    lineHeight: 1.35,
  },
  navLinkActive: {
    background: "#EEF2F6",
    color: "#000000",
    fontWeight: 800,
  },
  article: {
    width: "100%",
    maxWidth: "940px",
    padding: "56px 48px 80px",
  },
  mobileNav: {
    display: "none",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "24px",
  },
  backLink: {
    color: "#667085",
    textDecoration: "none",
    fontWeight: 700,
  },
  kicker: {
    margin: "34px 0 8px",
    color: "#667085",
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "clamp(40px, 6vw, 74px)",
    lineHeight: 0.96,
    letterSpacing: "-0.058em",
  },
  description: {
    maxWidth: "780px",
    color: "#667085",
    fontSize: "21px",
    lineHeight: 1.5,
  },
  meta: {
    color: "#667085",
    fontWeight: 700,
  },
  summaryBox: {
    border: "1px solid #DCE5EC",
    borderRadius: "22px",
    padding: "20px",
    background: "white",
    marginTop: "24px",
  },
  onThisPage: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "18px",
    alignItems: "center",
  },
  divider: {
    height: "1px",
    background: "#DCE5EC",
    margin: "34px 0",
  },
  section: {
    marginBottom: "38px",
    scrollMarginTop: "24px",
  },
  sectionTitle: {
    fontSize: "30px",
    letterSpacing: "-0.035em",
    marginBottom: "12px",
  },
  paragraph: {
    color: "#344054",
    fontSize: "17px",
    lineHeight: 1.75,
  },
  stepsList: {
    display: "grid",
    gap: "9px",
    paddingLeft: "22px",
    color: "#344054",
    fontSize: "17px",
    lineHeight: 1.6,
  },
  stepItem: {
    paddingLeft: "4px",
  },
  callout: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    marginTop: "18px",
  },
  calloutLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#667085",
  },
  calloutInfo: {
    background: "#F8FAFC",
    borderColor: "#DCE5EC",
  },
  calloutTip: {
    background: "#EAF8FF",
    borderColor: "#A8DFF5",
  },
  calloutBest: {
    background: "#ECFDF3",
    borderColor: "#ABEFC6",
  },
  calloutWarning: {
    background: "#FFF8E5",
    borderColor: "#F2C94C",
  },
  calloutDanger: {
    background: "#FDECEC",
    borderColor: "#E5484D",
  },
  relatedBox: {
    borderTop: "1px solid #DCE5EC",
    paddingTop: "28px",
    marginTop: "46px",
  },
  relatedKicker: {
    margin: "0 0 12px",
    color: "#667085",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontSize: "12px",
  },
  relatedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  relatedCard: {
    display: "grid",
    gap: "5px",
    padding: "16px",
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    background: "white",
    color: "#172033",
    textDecoration: "none",
  },
  feedbackBox: {
    border: "1px solid #DCE5EC",
    borderRadius: "20px",
    padding: "20px",
    background: "white",
    marginTop: "28px",
  },
  feedbackText: {
    color: "#667085",
    marginBottom: 0,
  },
  prevNext: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "22px",
  },
  prevNextLink: {
    display: "grid",
    gap: "4px",
    padding: "18px",
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    color: "#172033",
    textDecoration: "none",
    background: "white",
  },
};
