"""Collects financial statements from IF.data/BCB (internal REST API)."""

import requests
import json
from collections import defaultdict
from utils import save_json, now_iso, classificar_instituicao, limpar_nome_instituicao, limpar_nome_singular, INSTITUICOES

BASE = "https://www3.bcb.gov.br/ifdata/rest/arquivos"

TRIMESTRES = [
    202203, 202206, 202209, 202212,
    202303, 202306, 202309, 202312,
    202403, 202406, 202409, 202412,
]

# Cooperatives that must be aggregated by system
SISTEMAS_COOP = {"Sicoob", "Sicredi", "Unicred", "Cresol", "Ailos"}


def fetch_arquivo(nome_arquivo):
    resp = requests.get(BASE, params={"nomeArquivo": nome_arquivo}, timeout=120)
    resp.raise_for_status()
    return resp.json()


def extrair_dados_trimestre(dt):
    """Extracts financial data for one quarter."""
    prefix = f"ifdata/{dt}"
    cadastro_file = f"{prefix}/cadastro{dt}_1005.json"
    dados_file = f"{prefix}/dados{dt}_1.json"

    print(f"    Registry + data...")
    cadastro = fetch_arquivo(cadastro_file)
    c0_map = {int(c["c0"]): c for c in cadastro}
    dados = fetch_arquivo(dados_file)

    resultados = []
    for v in dados["values"]:
        c = c0_map.get(v["e"])
        if not c:
            continue

        nome_raw = c.get("c2", "").strip()
        nome_limpo = limpar_nome_instituicao(nome_raw)
        segmento = classificar_instituicao(nome_raw)
        uf = c.get("c10", "")
        tipo = c.get("c4", "")

        vals = {item["i"]: item["v"] for item in v["v"]}
        ativo = vals.get(78182, 0)
        pl = vals.get(78186, 0)
        lucro = vals.get(78187, 0)
        credito = vals.get(78183, 0)
        captacao = vals.get(78185, 0)
        basileia = vals.get(79664, vals.get(79790, vals.get(79700, None)))

        if ativo <= 0:
            continue

        roe = round((lucro / pl) * 100, 2) if pl and pl != 0 else None
        roa = round((lucro / ativo) * 100, 4) if ativo and ativo != 0 else None

        resultados.append({
            "nome": nome_limpo,
            "nome_raw": nome_raw,
            "segmento": segmento,
            "tipo": tipo,
            "uf": uf,
            "ativo_total": round(ativo, 2),
            "patrimonio_liquido": round(pl, 2),
            "lucro_liquido": round(lucro, 2),
            "carteira_credito": round(credito, 2),
            "captacoes": round(captacao, 2),
            "indice_basileia": round(basileia, 4) if basileia else None,
            "roe": roe,
            "roa": roa,
        })

    return resultados


def agregar_por_sistema(resultados):
    """Groups institutions by clean name. Individual cooperatives are summed by system."""
    grupos = defaultdict(list)
    for inst in resultados:
        grupos[inst["nome"]].append(inst)

    agregado = []
    singulares = {}

    for nome, insts in grupos.items():
        if len(insts) == 1:
            # Single institution: keep as is
            i = insts[0]
            agregado.append({
                "nome": nome,
                "segmento": i["segmento"],
                "ativo_total": i["ativo_total"],
                "patrimonio_liquido": i["patrimonio_liquido"],
                "lucro_liquido": i["lucro_liquido"],
                "carteira_credito": i["carteira_credito"],
                "captacoes": i["captacoes"],
                "indice_basileia": i["indice_basileia"],
                "roe": i["roe"],
                "roa": i["roa"],
                "qtd_singulares": 1,
            })
        else:
            # Multiple entries: aggregate (financial sum, recalculate indicators)
            ativo = sum(i["ativo_total"] for i in insts)
            pl = sum(i["patrimonio_liquido"] for i in insts)
            lucro = sum(i["lucro_liquido"] for i in insts)
            credito = sum(i["carteira_credito"] for i in insts)
            captacao = sum(i["captacoes"] for i in insts)

            # Basel ratio: asset-weighted average
            bas_vals = [(i["indice_basileia"], i["ativo_total"]) for i in insts if i["indice_basileia"] is not None]
            basileia = None
            if bas_vals:
                total_peso = sum(a for _, a in bas_vals)
                if total_peso > 0:
                    basileia = round(sum(b * a for b, a in bas_vals) / total_peso, 4)

            roe = round((lucro / pl) * 100, 2) if pl and pl != 0 else None
            roa = round((lucro / ativo) * 100, 4) if ativo and ativo != 0 else None

            agregado.append({
                "nome": nome,
                "segmento": insts[0]["segmento"],
                "ativo_total": round(ativo, 2),
                "patrimonio_liquido": round(pl, 2),
                "lucro_liquido": round(lucro, 2),
                "carteira_credito": round(credito, 2),
                "captacoes": round(captacao, 2),
                "indice_basileia": basileia,
                "roe": roe,
                "roa": roa,
                "qtd_singulares": len(insts),
            })

            # Keep individual co-ops for drill-down (main cooperatives only)
            if nome in SISTEMAS_COOP:
                singulares[nome] = sorted(
                    [{
                        "nome": limpar_nome_singular(i["nome_raw"]),
                        "uf": i["uf"],
                        "ativo_total": i["ativo_total"],
                        "lucro_liquido": i["lucro_liquido"],
                        "roe": i["roe"],
                        "carteira_credito": i["carteira_credito"],
                    } for i in insts],
                    key=lambda x: x["ativo_total"],
                    reverse=True,
                )[:50]  # Top 50 individual co-ops per system

    return agregado, singulares


def calcular_concentracao(agregado, campo="ativo_total"):
    total = sum(i[campo] for i in agregado if i[campo] > 0)
    if total == 0:
        return [], 0
    ranking = sorted(agregado, key=lambda x: x[campo], reverse=True)
    shares = []
    hhi = 0
    for inst in ranking[:50]:
        share = (inst[campo] / total) * 100
        hhi += share ** 2
        shares.append({
            "nome": inst["nome"],
            "segmento": inst["segmento"],
            "valor": inst[campo],
            "share": round(share, 4),
        })
    return shares, round(hhi, 2)


def main():
    print("── Collecting IF.data data ──")

    all_raw = {}
    for dt in TRIMESTRES:
        print(f"  → {dt}...")
        try:
            resultados = extrair_dados_trimestre(dt)
            if resultados:
                all_raw[str(dt)] = resultados
            print(f"    {len(resultados)} raw institutions")
        except Exception as e:
            print(f"    ERROR: {e}")

    if not all_raw:
        print("  ERROR: No quarter collected")
        return

    # ── Aggregate by system ──
    all_agregado = {}
    all_singulares = {}
    for dt, raw in all_raw.items():
        agregado, singulares = agregar_por_sistema(raw)
        all_agregado[dt] = agregado
        all_singulares[dt] = singulares
        print(f"  → {dt}: {len(raw)} → {len(agregado)} after aggregation")

    ultimo_dt = max(all_agregado.keys())
    ultimo = all_agregado[ultimo_dt]

    # 1. Institutions (master table)
    instituicoes_master = []
    seen = set()
    for inst in sorted(ultimo, key=lambda x: x["ativo_total"], reverse=True):
        if inst["nome"] not in seen:
            seen.add(inst["nome"])
            instituicoes_master.append({
                "nome": inst["nome"],
                "segmento": inst["segmento"],
                "qtd_singulares": inst.get("qtd_singulares", 1),
            })

    save_json({
        "last_updated": now_iso(),
        "source": "BCB/IF.data",
        "periodo": ultimo_dt,
        "total": len(instituicoes_master),
        "instituicoes": instituicoes_master,
    }, "instituicoes.json")

    # 2. Resultados financeiros
    resultados_por_tri = {}
    for dt, insts in all_agregado.items():
        top50 = sorted(insts, key=lambda x: x["ativo_total"], reverse=True)[:50]
        resultados_por_tri[dt] = [{
            "nome": i["nome"], "segmento": i["segmento"],
            "ativo_total": i["ativo_total"], "patrimonio_liquido": i["patrimonio_liquido"],
            "lucro_liquido": i["lucro_liquido"], "carteira_credito": i["carteira_credito"],
            "captacoes": i["captacoes"],
        } for i in top50]

    save_json({
        "last_updated": now_iso(), "source": "BCB/IF.data",
        "trimestres": resultados_por_tri,
    }, "resultados.json")

    # 3. Indicators (with individual co-ops for drill-down)
    indicadores_por_tri = {}
    for dt, insts in all_agregado.items():
        indicadores_por_tri[dt] = {
            "agregado": [{
                "nome": i["nome"], "segmento": i["segmento"],
                "roe": i["roe"], "roa": i["roa"],
                "indice_basileia": i["indice_basileia"],
                "ativo_total": i["ativo_total"],
                "qtd_singulares": i.get("qtd_singulares", 1),
            } for i in sorted(insts, key=lambda x: x["ativo_total"], reverse=True)],
            "singulares": all_singulares.get(dt, {}),
        }

    save_json({
        "last_updated": now_iso(), "source": "BCB/IF.data",
        "trimestres": indicadores_por_tri,
    }, "indicadores.json")

    # 4. Concentration
    concentracao_por_tri = {}
    for dt, insts in all_agregado.items():
        shares_ativo, hhi_ativo = calcular_concentracao(insts, "ativo_total")
        shares_credito, hhi_credito = calcular_concentracao(insts, "carteira_credito")

        por_segmento = defaultdict(float)
        total_ativo = sum(i["ativo_total"] for i in insts if i["ativo_total"] > 0)
        for inst in insts:
            por_segmento[inst["segmento"]] += inst["ativo_total"]
        share_segmento = {
            seg: round((val / total_ativo) * 100, 2) if total_ativo > 0 else 0
            for seg, val in por_segmento.items()
        }

        concentracao_por_tri[dt] = {
            "hhi_ativo": hhi_ativo, "hhi_credito": hhi_credito,
            "top5_share_ativo": round(sum(s["share"] for s in shares_ativo[:5]), 2),
            "top10_share_ativo": round(sum(s["share"] for s in shares_ativo[:10]), 2),
            "share_por_segmento": share_segmento,
            "ranking_ativo": shares_ativo[:20],
            "ranking_credito": shares_credito[:20],
        }

    save_json({
        "last_updated": now_iso(), "source": "BCB/IF.data",
        "trimestres": concentracao_por_tri,
    }, "concentracao.json")

    print("── Done ──")


if __name__ == "__main__":
    main()
