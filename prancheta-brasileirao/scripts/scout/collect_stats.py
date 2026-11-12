"""Coletor de estatísticas do Olheiro (Transfermarkt).

Para cada jogador das ligas do mercado (src/data/market/leagues/*.json, mais os elencos da Série A em
src/data/market/clubs/*.json) baixa `player_stats` (jogos, minutos, gols, cartões... por competição e temporada)
e `player_market_value` (histórico de valor). Só baixa dados brutos; a escolha da temporada e os agregados
são feitos por `npm run build:scout`.

Os DADOS são do Transfermarkt: confira os termos de uso antes de publicar ou monetizar (ver PENDENCIAS.md).

Requisitos: Python 3.12 ou 3.13 e `pip install "transfermarkt-api==5.*"`.

Uso (na pasta prancheta-brasileirao):
    python scripts/scout/collect_stats.py                       # todas as ligas (BRA1 primeiro)
    python scripts/scout/collect_stats.py --leagues BRA1,AR1N   # só algumas
    python scripts/scout/collect_stats.py --limit 50            # no máximo 50 jogadores por liga (teste)
    python scripts/scout/collect_stats.py --refresh             # ignora o cache em disco
    npm run build:scout                                          # gera src/data/scout

Saída: data/scout/tm/{liga}.json (cache em .cache/tm/stats_{id}.json e mv_{id}.json; re-execuções continuam
de onde pararam).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from transfermarkt_api import CacheConfig, NotFound, Transfermarkt, TransfermarktError, UpstreamBlocked
except ImportError:  # pragma: no cover
    sys.exit('Instale o pacote: pip install "transfermarkt-api==5.*"  (Python 3.12 ou 3.13)')

ROOT = Path(__file__).resolve().parents[2]
MARKET = ROOT / "src/data/market"
OUT = ROOT / "data/scout/tm"
CACHE = ROOT / ".cache/tm"


def league_order() -> list[str]:
    """BRA1 primeiro, depois a ordem do índice do mercado (Brasil → América do Sul → Europa → resto)."""
    ids = [lg["id"] for lg in json.loads((MARKET / "index.json").read_text())["leagues"]]
    return ["BRA1"] + [i for i in ids if i != "BRA1"]


def league_players(league_id: str) -> list[str]:
    file = MARKET / "leagues" / f"{league_id}.json"
    ids = [str(p["id"]) for p in json.loads(file.read_text())["players"]] if file.exists() else []
    if league_id == "BRA1":  # elencos completos da Série A (inclui quem não aparece na lista da liga)
        for club in sorted((MARKET / "clubs").glob("*.json")):
            ids += [str(p["id"]) for p in json.loads(club.read_text()).get("squad", [])]
    seen: set[str] = set()
    return [i for i in ids if i and not (i in seen or seen.add(i))]


class Collector:
    def __init__(self, tm: Transfermarkt, refresh: bool, delay: float):
        self.tm = tm
        self.refresh = refresh
        self.delay = delay
        self.calls = 0
        self.errors: list[str] = []

    async def cached(self, key: str, fetch):
        """Chamada com cache em disco (mesmo esquema do coletor do mercado)."""
        file = CACHE / f"{key}.json"
        if not self.refresh and file.exists():
            try:
                return json.loads(file.read_text())
            except json.JSONDecodeError:
                pass  # arquivo corrompido (coleta interrompida): baixa de novo
        for attempt in range(4):
            try:
                model = await fetch()
                data = model.model_dump(mode="json", by_alias=True)
                file.parent.mkdir(parents=True, exist_ok=True)
                tmp = file.with_suffix(".tmp")
                tmp.write_text(json.dumps(data, ensure_ascii=False))
                tmp.replace(file)
                self.calls += 1
                if self.delay:
                    await asyncio.sleep(self.delay)
                return data
            except NotFound:
                return None
            except UpstreamBlocked:
                wait = 30 * (attempt + 1)
                print(f"  bloqueado pelo Transfermarkt em {key}; aguardando {wait}s", flush=True)
                await asyncio.sleep(wait)
            except (TransfermarktError, Exception) as e:  # noqa: BLE001 — registra e segue
                if attempt == 3:
                    self.errors.append(f"{key}: {type(e).__name__}: {e}")
                    return None
                await asyncio.sleep(5 * (attempt + 1))
        self.errors.append(f"{key}: bloqueado")
        return None

    async def player(self, pid: str) -> dict:
        stats = await self.cached(f"stats_{pid}", lambda: self.tm.player_stats(pid))
        mv = await self.cached(f"mv_{pid}", lambda: self.tm.player_market_value(pid))
        return {
            "id": pid,
            "stats": (stats or {}).get("stats") or [],
            "marketValue": (mv or {}).get("marketValue"),
            "history": [
                {"date": h.get("date"), "value": h.get("marketValue")}
                for h in (mv or {}).get("marketValueHistory") or []
                if h.get("date") and h.get("marketValue") is not None
            ],
        }

    async def league(self, league_id: str, ids: list[str], concurrency: int) -> dict:
        sem = asyncio.Semaphore(concurrency)
        done = 0
        started = time.time()

        async def one(pid: str) -> dict:
            nonlocal done
            async with sem:
                r = await self.player(pid)
            done += 1
            if done % 100 == 0 or done == len(ids):
                print(f"  {league_id}: {done}/{len(ids)} ({int(time.time() - started)}s, {self.calls} chamadas)", flush=True)
            return r

        players = await asyncio.gather(*(one(pid) for pid in ids))
        return {
            "id": league_id,
            "collectedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "players": players,
        }


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", help="ids separados por vírgula (ex.: BRA1,AR1N); padrão: todas")
    ap.add_argument("--limit", type=int, help="no máximo N jogadores por liga (para testes)")
    ap.add_argument("--refresh", action="store_true", help="ignora o cache em disco")
    ap.add_argument("--delay", type=float, default=0.3, help="pausa após cada chamada, em segundos")
    ap.add_argument("--concurrency", type=int, default=4)
    args = ap.parse_args()

    order = league_order()
    if args.leagues:
        want = [s.strip() for s in args.leagues.split(",") if s.strip()]
        order = [i for i in order if i in want] + [i for i in want if i not in order]
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.time()

    async with Transfermarkt(max_concurrency=args.concurrency, cache=CacheConfig(ttl=3600, max_entries=5_000)) as tm:
        col = Collector(tm, args.refresh, args.delay)
        for league_id in order:
            ids = league_players(league_id)
            if args.limit:
                ids = ids[: args.limit]
            if not ids:
                print(f"\n▶ {league_id}: sem jogadores no mercado, pulando", flush=True)
                continue
            print(f"\n▶ {league_id}: {len(ids)} jogadores", flush=True)
            data = await col.league(league_id, ids, args.concurrency)
            (OUT / f"{league_id}.json").write_text(json.dumps(data, ensure_ascii=False))
            with_stats = sum(1 for p in data["players"] if p["stats"])
            print(f"  ✓ {league_id}: {with_stats}/{len(ids)} com estatísticas", flush=True)

    print(f"\nChamadas: {col.calls} em {int(time.time() - started)}s. Erros: {len(col.errors)}")
    for e in col.errors[:30]:
        print("  -", e)
    print("Agora rode: npm run build:scout")


if __name__ == "__main__":
    asyncio.run(main())
