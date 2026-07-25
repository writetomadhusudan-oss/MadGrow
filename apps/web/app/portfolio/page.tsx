import { redirect } from "next/navigation";

// The paper-trading account IS the user's portfolio. This legacy route now
// redirects there so old links and bookmarks keep working.
export default function PortfolioPage() {
  redirect("/trading");
}
