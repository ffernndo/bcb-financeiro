"""Builds geographic data (credit and deposits by state) from IF.data.

The BCB ESTBAN has no stable public API, so we use IF.data
(registry + financial data) to aggregate by state.
"""

import requests
import json
from utils import save_json, now_iso

BASE = "https://www3.bcb.gov.br/ifdata/rest/arquivos"

# Quarters for the time series
TRIMESTRES = [202212, 202312, 202412]

# Campos financeiros (layout antigo, cadastro 1005)
CAMPO_ATIVO = 78182
CAMPO_CREDITO = 78183
CAMPO_CAPTACAO = 78185
CAMPO_PL = 78186
CAMPO_LUCRO = 78187


def fetch_arquivo(nome):
    resp = requests.get(BASE, params={"nomeArquivo": nome}, timeout=120)
    resp.raise_for_status()
    return resp.json()


def extrair_por_uf(dt):
    """Aggregates financial data by state for one quarter."""
    prefix = f"ifdata/{dt}"
    cadastro = fetch_arquivo(f"{prefix}/cadastro{dt}_1005.json")
    dados = fetch_arquivo(f"{prefix}/dados{dt}_1.json")

    c0_map = {int(c["c0"]): c for c in cadastro}

    por_uf = {}
    for v in dados["values"]:
        c = c0_map.get(v["e"])
        if not c:
            continue

        uf = c.get("c10", "").strip()
        if not uf or len(uf) != 2:
            continue

        vals = {item["i"]: item["v"] for item in v["v"]}
        ativo = vals.get(CAMPO_ATIVO, 0)
        credito = vals.get(CAMPO_CREDITO, 0)
        captacao = vals.get(CAMPO_CAPTACAO, 0)

        if ativo <= 0:
            continue

        if uf not in por_uf:
            por_uf[uf] = {
                "ativo_total": 0,
                "carteira_credito": 0,
                "captacoes": 0,
                "num_instituicoes": 0,
            }

        por_uf[uf]["ativo_total"] += ativo
        por_uf[uf]["carteira_credito"] += credito
        por_uf[uf]["captacoes"] += captacao
        por_uf[uf]["num_instituicoes"] += 1

    # Arredondar
    for uf in por_uf:
        for k in ["ativo_total", "carteira_credito", "captacoes"]:
            por_uf[uf][k] = round(por_uf[uf][k], 2)

    return por_uf


def main():
    print("── Building geographic data by state ──")

    # Estimated population by state (IBGE 2024, in thousands)
    populacao = {
        "AC": 936, "AL": 3351, "AM": 4308, "AP": 901, "BA": 14985,
        "CE": 9274, "DF": 3094, "ES": 4109, "GO": 7206, "MA": 7154,
        "MG": 21412, "MS": 2867, "MT": 3784, "PA": 8777, "PB": 4059,
        "PE": 9674, "PI": 3289, "PR": 11597, "RJ": 17503, "RN": 3560,
        "RO": 1815, "RR": 716, "RS": 11473, "SC": 7610, "SE": 2346,
        "SP": 46649, "TO": 1607,
    }

    trimestres_data = {}
    for dt in TRIMESTRES:
        print(f"  → {dt}...")
        try:
            por_uf = extrair_por_uf(dt)
            print(f"    {len(por_uf)} UFs")
            trimestres_data[str(dt)] = por_uf
        except Exception as e:
            print(f"    ERROR: {e}")

    # Latest quarter as the main reference
    ultimo_dt = max(trimestres_data.keys())
    ultimo = trimestres_data[ultimo_dt]

    # Calcular per capita
    ufs_lista = []
    for uf, dados in sorted(ultimo.items()):
        pop = populacao.get(uf, 1)
        ufs_lista.append({
            "uf": uf,
            "ativo_total": dados["ativo_total"],
            "carteira_credito": dados["carteira_credito"],
            "captacoes": dados["captacoes"],
            "num_instituicoes": dados["num_instituicoes"],
            "credito_per_capita": round(dados["carteira_credito"] / (pop * 1000), 2),
            "captacao_per_capita": round(dados["captacoes"] / (pop * 1000), 2),
            "populacao_mil": pop,
        })

    resultado = {
        "last_updated": now_iso(),
        "source": "BCB/IF.data (agregado por UF da sede)",
        "periodo": ultimo_dt,
        "por_uf": ufs_lista,
        "evolucao": {
            dt: [{"uf": uf, **dados} for uf, dados in sorted(vals.items())]
            for dt, vals in trimestres_data.items()
        },
    }

    save_json(resultado, "estban.json")
    print("── Done ──")


if __name__ == "__main__":
    main()
