import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RealSign",
    short_name: "RealSign",
    description: "Find. Book. Pay. Meet.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#f7f7f4",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" }
    ],
  };
}
