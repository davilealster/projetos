import { Suspense, lazy, useEffect } from "react";
import { spaLink } from "./brand/BrandMark";
import { redirectTarget } from "./brand/nav";
import { Board } from "./components/Board";
import { CreatorPage } from "./components/CreatorPage";
import { teamSummary } from "./data";
import { Home } from "./home/Home";
import { getLastClub, setLastClub } from "./lib/lastClub";
import { replace, useRoute, type Route } from "./router";

const AdminApp = lazy(() => import("./admin/AdminApp"));
const MarketApp = lazy(() => import("./market/MarketApp"));

/** Link do bloco "não encontrado": volta para escolher um clube. */
function NotFound({ message = "Página não encontrada." }: { message?: string }) {
  return (
    <div className="notfound">
      <p>{message}</p>
      <a href="/?trocar=1" onClick={spaLink("/?trocar=1")}>Escolher um clube</a>
    </div>
  );
}

const isBrandPage = (r: Route) => r.page === "home" || r.page === "redirect" || (r.page === "board" && !r.live);

export function App() {
  const route = useRoute();
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("is-live", route.page === "board" && route.live);
    html.classList.toggle("is-brand", isBrandPage(route));
    if (route.page === "redirect") {
      replace(redirectTarget(route.module, getLastClub()));
      return;
    }
    const slug = route.page === "board" && !route.live ? route.slug : route.page === "market" ? route.slug : null;
    if (slug && teamSummary(slug)) setLastClub(slug);
  }, [route]);

  if (route.page === "home") return <Home />;
  if (route.page === "redirect") return null;
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
  return <NotFound />;
}
