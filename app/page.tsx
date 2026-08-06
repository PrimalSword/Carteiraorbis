import { AppShell } from "@/components/app-shell";
import { PortfolioProvider } from "@/components/portfolio-provider";

export default function Home() {
  return <PortfolioProvider><AppShell /></PortfolioProvider>;
}
