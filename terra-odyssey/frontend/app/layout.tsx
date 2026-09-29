import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Terra Odyssey — Earth System Trend Detective",
  description: "Reproducible NASA Earth Data Trend Investigation Workspace for Space Apps Challenge",
};

// Inline script runs before paint to apply the persisted theme.
// Without this the page flashes the default (light) palette for ~1 frame
// before React mounts and applies the saved value. SSR markup renders
// without `data-theme`, so the inline script must succeed for the no-flash
// guarantee. The default theme is "light" so first-time visitors see the
// light palette immediately without following OS-level dark mode.
const themeBootstrapScript = `
(function() {
  try {
    var t = localStorage.getItem('terra-odyssey:theme') || 'light';
    var r = t === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.documentElement.setAttribute('data-theme', r);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
