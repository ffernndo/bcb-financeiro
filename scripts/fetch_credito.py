"""Collects credit, delinquency and spread series for the financial system via the SGS/BCB API."""

from utils import (
    fetch_sgs, parse_month, calc_variacao_yoy, save_json, now_iso,
    SERIES_CREDITO,
)


def coletar_serie(nome, codigo):
    """Collects an SGS series and formats it as monthly values."""
    raw = fetch_sgs(codigo)
    monthly = []
    for item in raw:
        monthly.append({
            "data": parse_month(item["data"]),
            "valor": float(item["valor"]),
        })
    return monthly


def main():
    print("── Collecting financial system credit series ──")

    resultado = {
        "last_updated": now_iso(),
        "source": "BCB/SGS",
        "series": {},
    }

    for nome, codigo in SERIES_CREDITO.items():
        print(f"  → {nome} (SGS {codigo})...")
        try:
            monthly = coletar_serie(nome, codigo)
            yoy = calc_variacao_yoy(monthly)
            resultado["series"][nome] = {
                "codigo_sgs": codigo,
                "monthly": monthly,
                "variacao_yoy": yoy,
                "ultimo": monthly[-1] if monthly else None,
            }
            print(f"    {len(monthly)} records")
        except Exception as e:
            print(f"    ERROR: {e}")
            resultado["series"][nome] = {"codigo_sgs": codigo, "erro": str(e)}

    # resumo atual
    series = resultado["series"]
    resultado["resumo"] = {}
    for key in ["credito_total", "credito_pf", "credito_pj"]:
        if key in series and "ultimo" in series[key] and series[key]["ultimo"]:
            resultado["resumo"][key] = series[key]["ultimo"]
    for key in ["inadimplencia", "inadimplencia_pf", "inadimplencia_pj"]:
        if key in series and "ultimo" in series[key] and series[key]["ultimo"]:
            resultado["resumo"][key] = series[key]["ultimo"]
    for key in ["spread_total", "spread_pf"]:
        if key in series and "ultimo" in series[key] and series[key]["ultimo"]:
            resultado["resumo"][key] = series[key]["ultimo"]

    save_json(resultado, "credito.json")
    print("── Done ──")


if __name__ == "__main__":
    main()
