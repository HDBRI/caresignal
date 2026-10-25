import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/dm-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareSignal — classroom prototype",
  description:
    "Turn everyday observations into clearer care conversations. Classroom prototype using synthetic data only; not medical advice.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
