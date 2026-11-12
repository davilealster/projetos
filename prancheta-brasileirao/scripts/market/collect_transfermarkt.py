"""Coletor de dados do mercado (Transfermarkt) para o módulo /mercado.

Usa o pacote aberto `transfermarkt-api` (MIT, https://github.com/felipeall/transfermarkt-api), que lê a API
JSON interna do Transfermarkt. O código é livre; os DADOS são do Transfermarkt: confira os termos de uso dele
antes de publicar ou monetizar (ver PENDENCIAS.md).

Só baixa dados brutos. A interpretação (empréstimos, chegadas, contratos) é feita por `npm run build:market`.

Requisitos: Python 3.12 ou 3.13 e `pip install "transfermarkt-api==5.*"`.

Uso (na pasta prancheta-brasileirao):
    python scripts/market/collect_transfermarkt.py                 # todas as ligas
    python scripts/market/collect_transfermarkt.py --only BRA1,GB1 # só algumas
    python scripts/market/collect_transfermarkt.py --refresh       # ignora o cache em disco
    npm run build:market                                            # gera os dados do site

Saída: data/market/tm/{competição}.json  (cache em .cache/tm/, pode apagar)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    from transfermarkt_api import CacheConfig, NotFound, Transfermarkt, TransfermarktError, UpstreamBlocked
except ImportError:  # pragma: no cover
    sys.exit('Instale o pacote: pip install "transfermarkt-api==5.*"  (Python 3.12 ou 3.13)')

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "scripts/market/competitions.json"
LOCK = ROOT / "data/market/competitions.lock.json"
OUT = ROOT / "data/market/tm"
CACHE = ROOT / ".cache/tm"


def norm(s: str | None) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


class Collector:
    def __init__(self, tm: Transfermarkt, refresh: bool, delay: float):
        self.tm = tm
        self.refresh = refresh
        self.delay = delay
        self.calls = 0
        self.errors: list[str] = []

    async def cached(self, key: str, fetch):
        """Chamada com cache em disco: re-execuções continuam de onde pararam."""
        file = CACHE / f"{key}.json"
        if not self.refresh and file.exists():
            return json.loads(file.read_text())
        for attempt in range(4):
            try:
                model = await fetch()
                data = model.model_dump(mode="json", by_alias=True)
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(json.dumps(data, ensure_ascii=False))
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
            except TransfermarktError as e:
                if attempt == 3:
                    self.errors.append(f"{key}: {e}")
                    return None
                await asyncio.sleep(5 * (attempt + 1))
        self.errors.append(f"{key}: bloqueado")
        return None

    async def resolve(self, comp: dict, lock: dict) -> str | None:
        if comp.get("id"):
            return comp["id"]
        key = comp["search"]
        if key in lock:
            return lock[key]
        res = await self.cached(f"search_{norm(key).replace(' ', '_')}", lambda: self.tm.search_competitions(key))
        results = (res or {}).get("results") or []
        country = norm(comp.get("country"))
        cands = [r for r in results if not country or norm(r.get("country")) == country]
        # a 1ª divisão costuma ser a de maior valor de mercado do país
        cands.sort(key=lambda r: -(r.get("totalMarketValue") or 0))
        if not cands:
            self.errors.append(f"liga não encontrada: {key}")
            return None
        lock[key] = cands[0]["id"]
        print(f"  {key} → {cands[0]['id']} ({cands[0].get('name')})")
        return cands[0]["id"]

    async def complete(self, club_id: str, players: list[dict]) -> list[dict]:
        """
        Quando o elenco inclui alguém que já saiu, o pacote devolve valor, idade e contrato vazios para o clube
        inteiro. Nesse caso busca a ficha de cada jogador, preenche os campos e descarta quem já está em outro clube.
        """
        if not players or any(p.get("marketValue") is not None or p.get("contract") for p in players):
            return players
        sem = asyncio.Semaphore(6)

        async def one(p: dict) -> dict | None:
            async with sem:
                prof = await self.cached(f"profile_{p['id']}", lambda: self.tm.player_profile(p["id"]))
            if not prof:
                return p
            club = prof.get("club") or {}
            if club.get("id") and str(club["id"]) != str(club_id):
                return None  # já saiu do clube
            return {
                **p,
                "age": prof.get("age"),
                "marketValue": prof.get("marketValue"),
                "contract": club.get("contractExpires"),
                "joinedOn": club.get("joined") or p.get("joinedOn"),
            }

        done = await asyncio.gather(*(one(p) for p in players))
        return [p for p in done if p]

    async def coach(self, club_id: str) -> dict | None:
        """Técnico atual do clube (ficha do clube + ficha do técnico, para foto e nacionalidade)."""
        prof = await self.cached(f"clubprofile_{club_id}", lambda: self.tm.club_profile(club_id))
        c = (prof or {}).get("coach")
        if not c or not c.get("id"):
            return None
        det = await self.cached(f"coach_{c['id']}", lambda: self.tm.coach_profile(c["id"])) or {}
        return {
            "id": c["id"],
            "name": c.get("name") or det.get("name"),
            "since": c.get("since"),
            "imageUrl": det.get("imageUrl"),
            "age": det.get("age"),
            "citizenship": det.get("citizenship") or [],
        }

    async def competition(self, comp: dict, comp_id: str, serie_a_clubs: set[str]) -> dict:
        clubs = await self.cached(f"comp_{comp_id}", lambda: self.tm.competition_clubs(comp_id))
        out = {
            "competition": {"id": comp_id, "name": comp["name"], "group": comp["group"]},
            "collectedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "seasonId": (clubs or {}).get("seasonId"),
            "clubs": [],
            "transfers": {},
            "coaches": {},
        }
        for club in (clubs or {}).get("clubs", []):
            squad = await self.cached(f"club_{club['id']}", lambda cid=club["id"]: self.tm.club_players(cid))
            players = (squad or {}).get("players", [])
            players = await self.complete(club["id"], players)
            out["clubs"].append({"id": club["id"], "name": club.get("name"), "players": players})
            coach = await self.coach(club["id"])
            if coach:
                out["coaches"][club["id"]] = coach
            print(f"  {club.get('name')}: {len(players)} jogadores", flush=True)
            for p in players:
                want = comp["transfers"] == "all" or norm(p.get("signedFrom")) in serie_a_clubs
                if want:
                    t = await self.cached(f"transfers_{p['id']}", lambda pid=p["id"]: self.tm.player_transfers(pid))
                    if t:
                        out["transfers"][p["id"]] = t.get("transfers", [])
        return out


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="códigos separados por vírgula (ex.: BRA1,GB1)")
    ap.add_argument("--refresh", action="store_true", help="ignora o cache em disco")
    ap.add_argument("--delay", type=float, default=0.3, help="pausa entre chamadas, em segundos")
    ap.add_argument("--concurrency", type=int, default=4)
    args = ap.parse_args()

    config = json.loads(CONFIG.read_text())["competitions"]
    lock = json.loads(LOCK.read_text()) if LOCK.exists() else {}
    only = set(args.only.split(",")) if args.only else None
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.time()

    async with Transfermarkt(max_concurrency=args.concurrency, cache=CacheConfig(ttl=3600, max_entries=50_000)) as tm:
        col = Collector(tm, args.refresh, args.delay)
        # Série A primeiro: os nomes dos clubes servem para achar quem está emprestado por eles nas outras ligas
        serie_a_clubs: set[str] = set()
        bra1 = OUT / "BRA1.json"
        if bra1.exists():
            serie_a_clubs = {norm(c["name"]) for c in json.loads(bra1.read_text())["clubs"]}
        for comp in config:
            comp_id = await col.resolve(comp, lock)
            LOCK.parent.mkdir(parents=True, exist_ok=True)
            LOCK.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n")
            if not comp_id or (only and comp_id not in only and comp.get("id") not in only):
                continue
            print(f"\n▶ {comp['name']} ({comp_id})", flush=True)
            data = await col.competition(comp, comp_id, serie_a_clubs)
            (OUT / f"{comp_id}.json").write_text(json.dumps(data, ensure_ascii=False))
            if comp_id == "BRA1":
                serie_a_clubs = {norm(c["name"]) for c in data["clubs"]}
            n = sum(len(c["players"]) for c in data["clubs"])
            print(f"  ✓ {len(data['clubs'])} clubes, {n} jogadores, {len(data['transfers'])} históricos", flush=True)

    print(f"\nChamadas: {col.calls} em {int(time.time() - started)}s. Erros: {len(col.errors)}")
    for e in col.errors[:30]:
        print("  -", e)
    print("Agora rode: npm run build:market")


if __name__ == "__main__":
    asyncio.run(main())
