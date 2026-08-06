import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Carteira Orbis",
    short_name: "Orbis",
    description: "Carteira manual com inteligência de ativos.",
    start_url: "/",
    display: "standalone",
    background_color: "#08110f",
    theme_color: "#08110f",
    icons: [{ src: "/orbis-icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
