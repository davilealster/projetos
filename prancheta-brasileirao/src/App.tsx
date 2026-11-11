import { Suspense, lazy, useEffect } from "react";
import { Board } from "./components/Board";
import { CreatorPage } from "./components/CreatorPage";
import { TeamPicker } from "./components/TeamPicker";
import { navigate, useRoute } from "./router";

const AdminApp = lazy(() => import("./admin/AdminApp"));
const MarketApp = lazy(() => import("./market/MarketApp"));

export function App() {
  const route = useRoute();
  useEffect(() => {
    document.documentElement.classList.toggle("is-live", route.page === "board" && route.live);
  }, [route]);

  if (route.page === "home") return <TeamPicker />;
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
      <a href="/" onClick={(e) => (e.preventDefault(), navigate("/"))}>Ver os 20 clubes</a>
    </div>
  );
}
