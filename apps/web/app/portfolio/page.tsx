import { Suspense } from "react";
import { PortfolioClient } from "./PortfolioClient";

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-card/70" />}>
      <PortfolioClient />
    </Suspense>
  );
}
