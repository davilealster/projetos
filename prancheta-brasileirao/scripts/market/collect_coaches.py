"""Técnicos para o Mercado: contrato dos que estão empregados e lista dos que estão sem clube.

- Empregados: os técnicos atuais dos clubes já coletados (data/market/tm/*.json, campo `coaches`);
  aqui buscamos o fim do vínculo (`/club/{id}/coach` → endDate) e o status `isAvailable`.
- Sem clube: o Transfermarkt não tem uma lista pública de "técnicos sem clube" na API; partimos de uma
  lista de nomes acompanhados (scripts/market/free-coaches.txt), buscamos cada um e ficamos só com quem
  está `isAvailable` (sem clube) hoje.

Uso: SSL_CERT_FILE=... python scripts/market/collect_coaches.py   →   data/market/coaches-extra.json
"""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

from transfermarkt_api.tfmkt import TfmktClient
from transfermarkt_api.tfmkt.reference import get_reference

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "tm"
OUT = ROOT / "data" / "market" / "coaches-extra.json"


def cache_get(key: str):
    f = CACHE / f"{key}.json"
    return json.loads(f.read_text()) if f.exists() else None


def cache_put(key: str, v) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"{key}.json").write_text(json.dumps(v, ensure_ascii=False))


async def cached(key: str, fetch):
    hit = cache_get(key)
    if hit is not None:
        return hit
    try:
        v = await fetch()
    except Exception as e:  # noqa: BLE001
        print(f"  ! {key}: {e}")
        return None
    cache_put(key, v if v is not None else {})
    return v


async def main() -> None:
    tf = TfmktClient()
    sem = asyncio.Semaphore(6)

    async def lim(coro):
        async with sem:
            return await coro

    # ---- empregados ----
    clubs: dict[str, str] = {}
    for f in sorted((ROOT / "data" / "market" / "tm").glob("*.json")):
        d = json.loads(f.read_text())
        for club_id, c in (d.get("coaches") or {}).items():
            if c and c.get("id"):
                clubs[club_id] = c["id"]
    print(f"Clubes com técnico: {len(clubs)}")
    employed: dict[str, dict] = {}

    async def one(club_id: str, coach_id: str):
        cc = await lim(cached(f"clubcoach_{club_id}", lambda: tf.club_coach(club_id)))
        if cc and str(cc.get("coachId")) == str(coach_id):
            employed[coach_id] = {"since": (cc.get("startDate") or "")[:10] or None, "until": (cc.get("endDate") or "")[:10] or None}

    await asyncio.gather(*(one(k, v) for k, v in clubs.items()))

    # ---- sem clube ----
    # Candidatos: (1) nomes acompanhados em free-coaches.txt; (2) todos os técnicos que enfrentaram os
    # clubes da Série A/B nesta temporada (pega quem foi demitido no meio do ano).
    # Sem clube = não é o técnico atual de nenhum clube coletado E o clube do último jogo dele tem outro técnico.
    current = set(clubs.values())
    names = [n.strip() for n in (ROOT / "scripts" / "market" / "free-coaches.txt").read_text().splitlines() if n.strip() and not n.startswith("#")]
    cand: set[str] = set()

    async def by_name(name: str):
        res = await lim(cached(f"coachsearch_{name.lower()}", lambda: tf.quick_search(name, 1)))
        ids = ((res or {}).get("result") or {}).get("coachIds") or []
        cand.update(str(x) for x in ids[:2])

    await asyncio.gather(*(by_name(n) for n in names))

    def games(perf) -> list[dict]:
        return [g for g in ((perf or {}).get("performance") or []) if not (g.get("gameInformation") or {}).get("isNationalGame")]

    async def perf(cid: str):
        return await lim(cached(f"coachperf_{cid}", lambda: tf.get_optional(f"/coach/{cid}/performance-game")))

    br = []
    for f in ("BRA1.json", "BRA2.json"):
        fp = ROOT / "data" / "market" / "tm" / f
        if fp.exists():
            br += [c["id"] for c in (json.loads(fp.read_text()).get("coaches") or {}).values() if c and c.get("id")]
    season_cut = time.strftime("%Y") + "-01-01"
    for cid, pf in zip(br, await asyncio.gather(*(perf(c) for c in br))):
        for g in games(pf):
            gi = g.get("gameInformation") or {}
            if ((gi.get("date") or {}).get("dateTimeUTC") or "") >= season_cut:
                opp = ((g.get("clubsInformation") or {}).get("opponent") or {}).get("coachId")
                if opp and opp != "0":
                    cand.add(str(opp))
    cand -= current
    print(f"Candidatos a sem clube: {len(cand)}")

    free: list[dict] = []

    async def check(cid: str):
        raw, pf = await asyncio.gather(lim(cached(f"coachraw_{cid}", lambda: tf.coach(cid))), perf(cid))
        gs = sorted(games(pf), key=lambda g: ((g.get("gameInformation") or {}).get("date") or {}).get("dateTimeUTC") or "", reverse=True)
        if not raw or not gs:
            return
        last = gs[0]
        last_date = (((last.get("gameInformation") or {}).get("date") or {}).get("dateTimeUTC") or "")[:10]
        if last_date < "2024-01-01":
            return  # sem trabalhar há muito tempo: fora da lista
        last_club = ((last.get("clubsInformation") or {}).get("club") or {}).get("clubId")
        if last_club:
            cc = await lim(cached(f"clubcoach_{last_club}", lambda: tf.club_coach(str(last_club))))
            if cc and str(cc.get("coachId")) == cid:
                return  # ainda é o técnico desse clube
        life = raw.get("lifeDates") or {}
        nat = ((raw.get("nationalityDetails") or {}).get("nationalities") or {}).get("nationalityId")
        photo = raw.get("portraitUrl")
        free.append({
            "id": cid,
            "name": raw.get("name"),
            "photo": photo if photo and "default" not in photo else None,
            "age": life.get("age"),
            "natId": nat,
            "lastClubId": str(last_club) if last_club else None,
            "lastGame": last_date,
            "games": len(gs),
        })

    await asyncio.gather(*(check(c) for c in cand))
    free.sort(key=lambda c: c["lastGame"], reverse=True)
    # nomes dos últimos clubes
    club_ids = sorted({c["lastClubId"] for c in free if c["lastClubId"]})
    names_by_id: dict[str, str] = {}
    for i in range(0, len(club_ids), 50):
        chunk = club_ids[i : i + 50]
        got = await lim(cached(f"clubsbatch_{'_'.join(chunk)[:180]}", lambda chunk=chunk: tf.clubs(chunk)))
        for k, v in (got or {}).items():
            names_by_id[str(k)] = (v or {}).get("name") or ""
    ref = await get_reference(tf)
    for c in free:
        c["lastClub"] = names_by_id.get(c["lastClubId"] or "", None)
        c["nat"] = ref.country_name(c.pop("natId", None)) if c.get("natId") else None
    await tf.aclose()
    OUT.write_text(json.dumps({"collectedAt": time.strftime("%Y-%m-%d"), "employed": employed, "free": free}, ensure_ascii=False, indent=1))
    print(f"Empregados com vínculo: {sum(1 for v in employed.values() if v['until'])}/{len(employed)} · sem clube: {len(free)}")


if __name__ == "__main__":
    asyncio.run(main())
