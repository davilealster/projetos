import { Suspense, lazy, useEffect } from "react";
import { Board } from "./components/Board";
import { CreatorPage } from "./components/CreatorPage";
import { TeamPicker } from "./components/TeamPicker";
import { teamSummary } from "./data";
import { Home } from "./home/Home";
import { setLastClub } from "./lib/lastClub";
import { navigate, useRoute } from "./router";

const AdminApp = lazy(() => import("./admin/AdminApp"));
const MarketApp = lazy(() => import("./market/MarketApp"));

export function App() {
  const route = useRoute();
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("is-live", route.page === "board" && route.live);
    html.classList.toggle("is-brand", route.page === "home");
    const slug = route.page === "board" && !route.live ? route.slug : route.page === "market" ? route.slug : null;
    if (slug && teamSummary(slug)) setLastClub(slug);
  }, [route]);

  if (route.page === "home") return <Home />;
  if (route.page === "picker") return <TeamPicker />;
  if (route.page === "creator") return <CreatorPage />;
  if (route.page === "market")
    return (
      <Suspense fallback={<div className="loading">Carregando…</div>}>
        <MarketApp slug={route.slug} />
      </Suspense>
    );
  if (route.page === "admin")
    return (
      <Suspense fallback={<div className="admin-loading">Carregando…</div>}>
        <AdminApp />
      </Suspense>
    );
  if (route.page === "board") return <Board key={route.slug} slug={route.slug} live={route.live} />;
  return (
    <div className="notfound">
      <p>Página não encontrada.</p>
      <a href="/" onClick={(e) => (e.preventDefault(), navigate("/"))}>Voltar ao início</a>
    </div>
  );
}
