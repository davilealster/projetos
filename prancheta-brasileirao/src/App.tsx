import { useEffect } from "react";
import { Board } from "./components/Board";
import { TeamPicker } from "./components/TeamPicker";
import { navigate, useRoute } from "./router";

export function App() {
  const route = useRoute();
  useEffect(() => {
    document.documentElement.classList.toggle("is-live", route.page === "board" && route.live);
  }, [route]);

  if (route.page === "home") return <TeamPicker />;
  if (route.page === "board") return <Board key={route.slug} slug={route.slug} live={route.live} />;
  return (
    <div className="notfound">
      <p>Página não encontrada.</p>
      <a href="/" onClick={(e) => (e.preventDefault(), navigate("/"))}>Ver os 20 clubes</a>
    </div>
  );
}
