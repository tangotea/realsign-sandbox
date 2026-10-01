import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import GlobalAuthAction from "@/components/GlobalAuthAction";
import { ExperienceMode } from "@/components/ExperienceMode";

export const metadata: Metadata = {
  title: "RealSign",
  description: "Find. Book. Pay. Meet. Deaf-first tutoring and interpreting.",
  applicationName: "RealSign",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <ExperienceMode>
          <GlobalAuthAction />
          {children}
        </ExperienceMode>
      </body>
    </html>
  );
}
