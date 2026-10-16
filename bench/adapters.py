"""Interfaz única: ask(questions)-> {nombre: p_yes}, más tokens. questions = {nombre: {state, q}}."""
import os, json, time, requests

class Adapter:
    name = "base"; price_per_m = 0.0
    def ask(self, qs): raise NotImplementedError

class Oracle(Adapter):  # para generar verdad
    name = "oracle"
    def __init__(self, truth): self.truth = truth
    def ask(self, qs): return {k: float(self.truth[k]) for k in qs}, 0

class RulesOnly(Adapter):  # sin modelo: todo juicio = incierto
    name = "solo-reglas"
    def ask(self, qs): return {k: 0.5 for k in qs}, 0

class SystemOne(Adapter):  # formato TypeSafe (JEV reseller y Fastino GLiDE)
    def __init__(self, name, url, model, headers, price):
        self.name, self.url, self.model, self.h, self.price_per_m = name, url, model, headers, price
    def ask(self, qs):
        # un request por factura; el estado común se pasa como objeto con sub-estados por pregunta
        state = {k: v["state"] for k, v in qs.items()}
        body = {"model": self.model, "state": state,
                "questions": {k: {"type": "noul", "instructions": f"Using `{k}` in the state: {v['q']}"} for k, v in qs.items()}}
        r = requests.post(self.url, headers={**self.h, "Content-Type": "application/json"}, json=body, timeout=120)
        r.raise_for_status(); d = r.json()
        return {k: d["answers"][k]["noul"] for k in qs}, d.get("usage", {}).get("input_tokens", 0)

def jev():
    return SystemOne("JEV (reseller, jev-latest)", "https://jevtypesafeai.com/api/v1/decide", "jev-latest",
                     {"Authorization": "Bearer " + os.environ["JEV_API_KEY"]}, 0.42)
def glide():
    return SystemOne("Fastino GLiDE (API)", "https://api.fastino.ai/v1/systemone", "fastino/GLiDE",
                     {"X-API-Key": os.environ["FASTINO_API_KEY"]}, 0.15)

def _text(v): return "Question: " + v["q"] + "\nData: " + json.dumps(v["state"], ensure_ascii=False)

class GlinerLocal(Adapter):
    name = "GLiNER2.5-Decide (local CPU)"
    def __init__(self):
        from gliner2 import AutoExtractor
        self.m = AutoExtractor.from_pretrained("fastino/GLiNER2.5-Decide")
    def ask(self, qs):
        out = {}
        for k, v in qs.items():
            r = self.m.classify_text(json.dumps(v["state"], ensure_ascii=False),
                    {k: {"labels": ["yes", "no"], "prompt": v["q"]}}, include_confidence=True)
            x = r[k]
            if isinstance(x, dict):
                lab, c = x.get("label"), float(x.get("confidence", 1.0))
            else: lab, c = x, 1.0
            out[k] = c if lab == "yes" else 1 - c
        return out, 0

class GlinerAPI(Adapter):
    name = "GLiNER-2.5-Decide (API)"
    price_per_m = None
    def ask(self, qs):
        out, tok = {}, 0
        for k, v in qs.items():
            body = {"model": "fastino/GLiNER-2.5-Decide", "store": False,
                    "messages": [{"role": "user", "content": _text(v)}],
                    "schema": {"classifications": [{"task": k, "labels": ["yes", "no"], "multi_label": False}]}}
            r = requests.post("https://api.fastino.ai/v1/chat/completions", json=body, timeout=60,
                              headers={"Authorization": "Bearer " + os.environ["FASTINO_API_KEY"]})
            r.raise_for_status(); d = r.json()
            x = json.loads(d["choices"][0]["message"]["content"])[k]
            c = float(x.get("confidence", 1.0)); out[k] = c if x["label"] == "yes" else 1 - c
            tok += d.get("usage", {}).get("prompt_tokens", 0)
        return out, tok
