"""Motor determinista: el código aplica reglas duras; los modelos sólo responden preguntas tipadas (p_yes)."""
import json
from data import RULES, PAYEES, HISTORY

def questions_for(inv, history):
    same = [h for h in history if h["vendor"] == inv["vendor"]]
    show = lambda x: {k: x[k] for k in ("number", "date", "amount", "lines")}
    agreement = PAYEES.get(inv["vendor"], {}).get("agreement")
    qs = {"is_duplicate": {"state": {"new_invoice": show(inv), "already_processed_from_same_vendor": [show(h) for h in same]},
            "q": "Is `new_invoice` a resubmission of the same goods/services (same period, same items) as one of `already_processed_from_same_vendor`? A recurring charge for a different period is NOT a duplicate."}}
    if agreement:
        qs["matches_agreement"] = {"state": {"agreed_terms": agreement, "invoice_lines": inv["lines"], "invoice_total": inv["amount"]},
            "q": "Does the invoice charge only items and prices permitted by `agreed_terms`, with no extra or unapproved charges?"}
    return qs

def decide(inv, answers, ledger):
    """answers: {q: p_yes}. ledger: estado mutable del mes. Devuelve (accion, razones)."""
    R, why = RULES, []
    lo, hi = R["uncertain_band"]
    payee = PAYEES.get(inv["vendor"])
    exact_dup = any(h["vendor"] == inv["vendor"] and h["number"] == inv["number"] for h in ledger["seen"])
    hard_hold = []
    if exact_dup: hard_hold.append("duplicado exacto (proveedor+número)")
    if payee and inv["acct"] != payee["acct"]: hard_hold.append("cuenta bancaria distinta a la registrada")
    if inv["amount"] > R["max_per_payment"]: hard_hold.append(f"monto > límite por pago {R['max_per_payment']}")
    if ledger["vendor_paid"].get(inv["vendor"], 0) + inv["amount"] > R["vendor_monthly_cap"]: hard_hold.append("excede tope mensual del proveedor")
    if ledger["spent"] + inv["amount"] > R["monthly_budget"]: hard_hold.append("presupuesto insuficiente")
    soft_hold, unsure = [], []
    pd = answers.get("is_duplicate")
    if pd is not None:
        if pd >= R["p_dup_hold"]: soft_hold.append(f"modelo: probable duplicado p={pd:.2f}")
        if lo < pd < hi: unsure.append(f"duplicado incierto p={pd:.2f}")
    pm = answers.get("matches_agreement")
    if pm is not None:
        if pm < R["p_match_min"]: soft_hold.append(f"modelo: no coincide con acuerdo p={pm:.2f}")
        if lo < pm < hi: unsure.append(f"coincidencia incierta p={pm:.2f}")
    if hard_hold or soft_hold: act, why = "hold", hard_hold + soft_hold
    elif not payee: act, why = "escalate", ["proveedor nuevo / no autorizado"]
    elif unsure: act, why = "escalate", unsure
    elif inv["amount"] > R["human_approval_above"]: act, why = "escalate", [f"monto > {R['human_approval_above']} requiere aprobación humana"]
    else: act, why = "pay", ["todas las reglas OK"]
    ledger["seen"].append(inv)
    if act == "pay":  # sólo el código mueve dinero
        ledger["spent"] += inv["amount"]
        ledger["vendor_paid"][inv["vendor"]] = ledger["vendor_paid"].get(inv["vendor"], 0) + inv["amount"]
    return act, why

def new_ledger(): return {"seen": list(HISTORY), "spent": 0.0, "vendor_paid": {}}
