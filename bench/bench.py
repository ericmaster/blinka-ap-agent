import sys, time, json, statistics as st
from data import INVOICES
import engine, adapters as A

def run(adapter, truth_actions=None):
    led, rows = engine.new_ledger(), []
    for inv in INVOICES:
        qs = engine.questions_for(inv, led["seen"])
        t = time.perf_counter()
        try: ans, tok = (adapter.ask(qs) if not isinstance(adapter, A.Oracle) else A.Oracle(inv["truth"]).ask(qs)); err = None
        except Exception as e: ans, tok, err = {k: 0.5 for k in qs}, 0, repr(e)[:200]
        lat = (time.perf_counter() - t) * 1000
        act, why = engine.decide(inv, ans, led)
        rows.append({"id": inv["id"], "act": act, "why": why, "ans": ans, "lat": lat, "tok": tok, "err": err})
    return rows

def pct(xs, p): xs = sorted(xs); return xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))]

def metrics(name, rows, truth, price):
    acc = sum(r["act"] == t["act"] for r, t in zip(rows, truth)) / len(rows)
    unsafe = [r["id"] for r, t in zip(rows, truth) if r["act"] == "pay" and t["act"] != "pay"]
    missed = sum(r["act"] != "pay" and t["act"] == "pay" for r, t in zip(rows, truth))
    qa, br = [], []
    for r, inv in zip(rows, INVOICES):
        for k, p in r["ans"].items():
            y = float(inv["truth"][k]); qa.append((p >= 0.5) == bool(y)); br.append((p - y) ** 2)
    lats = [r["lat"] for r in rows]; tok = sum(r["tok"] for r in rows)
    return {"modelo": name, "acc_decision": acc, "acc_preguntas": sum(qa) / len(qa), "brier": sum(br) / len(br),
            "p50_ms": pct(lats, .5), "p95_ms": pct(lats, .95), "tokens": tok,
            "costo_usd": (tok / 1e6 * price) if price else None, "unsafe": unsafe, "pagos_perdidos": missed,
            "errores": sum(1 for r in rows if r["err"]), "err_ej": next((r["err"] for r in rows if r["err"]), None)}

if __name__ == "__main__":
    truth = run(A.Oracle({}))
    json.dump(truth, open("results/truth.json", "w"), ensure_ascii=False, indent=1, default=str)
    which = sys.argv[1:]
    mk = {"rules": A.RulesOnly, "jev": A.jev, "glide": A.glide, "gliner_local": A.GlinerLocal, "gliner_api": A.GlinerAPI}
    for w in which:
        a = mk[w](); rows = run(a)
        m = metrics(a.name, rows, truth, a.price_per_m)
        json.dump({"metrics": m, "rows": rows}, open(f"results/{w}.json", "w"), ensure_ascii=False, indent=1, default=str)
        print(json.dumps(m, ensure_ascii=False))
