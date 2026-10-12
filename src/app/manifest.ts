import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BP 周报分析 Dashboard",
    short_name: "BP Dashboard",
    description: "把 BP 周报 Excel 转换为可解释的经营分析。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#101c2c",
  };
}

