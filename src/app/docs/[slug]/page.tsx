import Link from "next/link";
import { notFound } from "next/navigation";
import { articleBySlug, docArticles, docCategories, previousNextArticle } from "../docsData";

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

  return (
    <main style={styles.page}>
      <aside style={styles.sidebar}>
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

      <article style={styles.article}>
        <Link href="/docs" style={styles.backLink}>← Documentation</Link>
        <p style={styles.kicker}>{article.category}</p>
        <h1 style={styles.title}>{article.title}</h1>
        <p style={styles.description}>{article.description}</p>
        <p style={styles.meta}>Updated {article.updated} · {article.readTime}</p>

        <div style={styles.divider} />

        {article.sections.map((section) => (
          <section key={section.heading} style={styles.section}>
            <h2 style={styles.sectionTitle}>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} style={styles.paragraph}>{paragraph}</p>
            ))}
            {section.callout && <Callout {...section.callout} />}
          </section>
        ))}

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
  type: "tip" | "warning" | "info" | "best";
  title: string;
  body: string;
}) {
  const typeStyle =
    type === "warning"
      ? styles.calloutWarning
      : type === "tip"
        ? styles.calloutTip
        : type === "best"
          ? styles.calloutBest
          : styles.calloutInfo;

  const label =
    type === "warning" ? "Warning" : type === "tip" ? "Tip" : type === "best" ? "Best Practice" : "Information";

  return (
    <aside style={{ ...styles.callout, ...typeStyle }}>
      <span style={styles.calloutLabel}>{label}</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "300px minmax(0, 1fr)",
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
    fontWeight: 800,
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
  },
  navLinkActive: {
    background: "#EEF2F6",
    color: "#000000",
    fontWeight: 800,
  },
  article: {
    width: "100%",
    maxWidth: "920px",
    padding: "56px 48px 80px",
  },
  backLink: {
    color: "#667085",
    textDecoration: "none",
    fontWeight: 700,
  },
  kicker: {
    margin: "34px 0 8px",
    color: "#667085",
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "clamp(40px, 6vw, 72px)",
    lineHeight: 0.96,
    letterSpacing: "-0.055em",
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
  divider: {
    height: "1px",
    background: "#DCE5EC",
    margin: "34px 0",
  },
  section: {
    marginBottom: "34px",
  },
  sectionTitle: {
    fontSize: "30px",
    letterSpacing: "-0.03em",
    marginBottom: "12px",
  },
  paragraph: {
    color: "#344054",
    fontSize: "17px",
    lineHeight: 1.75,
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
  feedbackBox: {
    border: "1px solid #DCE5EC",
    borderRadius: "20px",
    padding: "20px",
    background: "white",
    marginTop: "44px",
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
