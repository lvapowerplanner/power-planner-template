import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "LVA Power Planner",
  description: "Professional power planning for live events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lato.variable} h-full antialiased`}>
      <body className={`${lato.className} min-h-full flex flex-col`}>
        <style>{`
          :root {
            --lva-ui-hover: rgba(158, 158, 158, 0.07);
            --lva-ui-hover-strong: rgba(122, 122, 122, 0.12);
            --lva-ui-border-hover: #5c5c5c;
            --lva-ui-soft-shadow: 0 2px 8px rgba(17, 24, 39, 0.04);
          }

          button,
          a,
          input,
          select,
          textarea,
          [role="button"] {
            transition:
              background-color 140ms ease,
              border-color 140ms ease,
              box-shadow 140ms ease,
              color 140ms ease,
              filter 140ms ease,
              transform 140ms ease;
          }

          button:hover,
          [role="button"]:hover {
            box-shadow: inset 0 0 0 999px var(--lva-ui-hover) !important;
            border-color: var(--lva-ui-border-hover) !important;
          }

          button:active,
          [role="button"]:active {
            transform: translateY(1px);
            filter: brightness(0.98);
          }

          input:hover,
          select:hover,
          textarea:hover {
            border-color: var(--lva-ui-border-hover) !important;
          }

          input:focus,
          select:focus,
          textarea:focus {
            border-color: var(--lva-ui-border-hover) !important;
            box-shadow: 0 0 0 3px var(--lva-ui-hover) !important;
            outline: none !important;
          }

          a:hover {
            text-decoration-thickness: 2px;
            text-underline-offset: 5px;
          }

          [style*="box-shadow"],
          [style*="boxShadow"] {
            box-shadow: var(--lva-ui-soft-shadow) !important;
          }

          @media (prefers-reduced-motion: reduce) {
            button,
            a,
            input,
            select,
            textarea,
            [role="button"] {
              transition: none !important;
            }

            button:active,
            [role="button"]:active {
              transform: none !important;
            }
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
