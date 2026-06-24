import { notFound } from "next/navigation";
import {
  articleBySlug,
  docArticles,
  previousNextArticle,
  relatedArticles,
} from "../docsData";
import {
  ArticleBody,
  ArticleHeader,
  DocsSidebar,
  DocsStyles,
  DocsTopBar,
  FeedbackPanel,
  PreviousNext,
  RelatedArticles,
  TableOfContents,
} from "../DocsLayoutComponents";

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
    <main style={styles.shell} className="docs-shell">
      <DocsStyles />
      <DocsSidebar activeSlug={slug} />

      <section style={styles.main} className="docs-main">
        <DocsTopBar />
        <div style={styles.articleGrid} className="docs-article-grid">
          <article style={styles.article}>
            <ArticleHeader article={article} />
            <ArticleBody article={article} />
            <RelatedArticles articles={related} />
            <PreviousNext previous={previous} next={next} />
            <FeedbackPanel />
          </article>
          <TableOfContents article={article} />
        </div>
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
  main: {
    padding: "32px",
  },
  articleGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 860px) 250px",
    gap: "32px",
    alignItems: "start",
    maxWidth: "1180px",
    margin: "0 auto",
  },
  article: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "24px",
    padding: "clamp(24px, 5vw, 54px)",
    boxShadow: "0 18px 50px rgba(17, 24, 39, 0.05)",
  },
};
