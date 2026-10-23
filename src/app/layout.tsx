import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Poppins, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./portal-padres.css";
import "./dashboard/dashboard-temas.css";
import "./pos/pos-totality-theme.css";
import "./facturacion/facturacion-totality-overrides.css";
import "./admin-totality-overrides.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import PanelControlAlerta from "@/components/PanelControlAlerta";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--dt-f-poppins",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Servicios Administrativos",
  description: "Sistema administrativo escolar Winston",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeBootstrap = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var d=${JSON.stringify(DEFAULT_THEME)};var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark')t=d;document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${inter.variable} ${poppins.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            <div
              className="pos-totality-theme admin-app-shell"
              data-admin-theme="totality-festival"
            >
              {children}
              <PanelControlAlerta />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
