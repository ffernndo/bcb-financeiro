"""Shared utility functions for collecting BCB data."""

import json
import requests
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados"
OLINDA_BASE = "https://olinda.bcb.gov.br/olinda/servico/{servico}/versao/{versao}/odata/{recurso}"

# ── Reference institutions ─────────────────────────────────────────────
# Simplified segments: grande (large), outro_banco (other bank), cooperativa (co-op)

INSTITUICOES = {
    "ITAU":        {"cnpj": "60701190", "nome": "Itaú Unibanco",       "segmento": "grande"},
    "BRADESCO":    {"cnpj": "60746948", "nome": "Bradesco",            "segmento": "grande"},
    "BB":          {"cnpj": "00000000", "nome": "Banco do Brasil",     "segmento": "grande"},
    "CAIXA":       {"cnpj": "00360305", "nome": "Caixa Econômica",     "segmento": "grande"},
    "SANTANDER":   {"cnpj": "90400888", "nome": "Santander",           "segmento": "grande"},
    "NUBANK":      {"cnpj": "18236120", "nome": "Nubank",             "segmento": "grande"},
    "BTG":         {"cnpj": "30306294", "nome": "BTG Pactual",         "segmento": "outro"},
    "SAFRA":       {"cnpj": "58160789", "nome": "Safra",               "segmento": "outro"},
    "VOTORANTIM":  {"cnpj": "59588111", "nome": "Banco Votorantim",    "segmento": "outro"},
    "BMG":         {"cnpj": "61186680", "nome": "BMG",                 "segmento": "outro"},
    "PAN":         {"cnpj": "59285411", "nome": "Banco Pan",           "segmento": "outro"},
    "BANCO INTER":  {"cnpj": "00416968", "nome": "Banco Inter",         "segmento": "outro"},
    "C6":          {"cnpj": "31872495", "nome": "C6 Bank",             "segmento": "outro"},
    "ORIGINAL":    {"cnpj": "92894922", "nome": "Banco Original",      "segmento": "outro"},
    "BNDES":       {"cnpj": "33657248", "nome": "BNDES",               "segmento": "outro"},
    "BNB":         {"cnpj": "07237373", "nome": "Banco do Nordeste",   "segmento": "outro"},
    "BASA":        {"cnpj": "04902979", "nome": "Banco da Amazônia",   "segmento": "outro"},
    "SICOOB":      {"cnpj": "02038232", "nome": "Sicoob",              "segmento": "cooperativa"},
    "SICREDI":     {"cnpj": "01181521", "nome": "Sicredi",             "segmento": "cooperativa"},
    "UNICRED":     {"cnpj": "00315557", "nome": "Unicred",             "segmento": "cooperativa"},
    "CRESOL":      {"cnpj": "01330387", "nome": "Cresol",              "segmento": "cooperativa"},
    "AILOS":       {"cnpj": "05765478", "nome": "Ailos",               "segmento": "cooperativa"},
}

SEGMENTO_LABELS = {
    "grande":       "Grandes Bancos",
    "cooperativa":  "Cooperativas",
    "outro":        "Outros",
}

# ── SGS series ──────────────────────────────────────────────────────────────

SERIES_CREDITO = {
    "credito_total":     20539,
    "credito_pf":        20541,
    "credito_pj":        20542,
    "inadimplencia":     21082,
    "inadimplencia_pf":  21083,
    "inadimplencia_pj":  21084,
    "spread_total":      20783,
    "spread_pf":         20784,
}


# ── Collection functions ───────────────────────────────────────────────────────

def fetch_sgs(serie, data_inicial="01/01/2020", data_final=None):
    """Fetches a time series from the BCB SGS."""
    if data_final is None:
        data_final = datetime.now().strftime("%d/%m/%Y")
    url = SGS_BASE.format(serie=serie)
    resp = requests.get(
        url,
        params={"formato": "json", "dataInicial": data_inicial, "dataFinal": data_final},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_olinda(servico, versao, recurso, params=None):
    """Fetches data from the BCB Olinda API."""
    url = OLINDA_BASE.format(servico=servico, versao=versao, recurso=recurso)
    default_params = {"$format": "json"}
    if params:
        default_params.update(params)
    resp = requests.get(url, params=default_params, timeout=60)
    resp.raise_for_status()
    return resp.json()


# ── Parsing and calculations ──────────────────────────────────────────────────────

def parse_month(d):
    """DD/MM/YYYY → YYYY-MM"""
    return datetime.strptime(d, "%d/%m/%Y").strftime("%Y-%m")


def parse_date(d):
    """DD/MM/YYYY → YYYY-MM-DD"""
    return datetime.strptime(d, "%d/%m/%Y").strftime("%Y-%m-%d")


def calc_variacao_yoy(series):
    """Calculates year-on-year % change for monthly series."""
    by_month = {m["data"]: m["valor"] for m in series}
    result = []
    for m in sorted(series, key=lambda x: x["data"]):
        mes = m["data"]
        ano_anterior = str(int(mes[:4]) - 1) + mes[4:]
        if ano_anterior in by_month and by_month[ano_anterior] != 0:
            var = ((m["valor"] / by_month[ano_anterior]) - 1) * 100
            result.append({"data": mes, "valor": round(var, 2)})
    return result


def classificar_instituicao(nome):
    """Classifies an institution by name.
    Returns: 'grande' (large), 'cooperativa' (main systems only) or 'outro' (other).
    """
    nome_upper = nome.upper().strip()
    for key, info in INSTITUICOES.items():
        if key in nome_upper or info["nome"].upper() in nome_upper:
            return info["segmento"]
    # Cooperatives from the 4 main systems
    if any(x in nome_upper for x in ["SICOOB", "SICOO", "BANCOOB",
                                       "SICREDI", "SICRED",
                                       "UNICRED", "UNICR",
                                       "CRESOL", "CRESO", "INTERAÇÃO SOLIDÁRIA", "INTERACAO SOLIDARIA",
                                       "AILOS"]):
        return "cooperativa"
    return "outro"


def limpar_nome_instituicao(nome):
    """Returns a short name for aggregation (cooperative systems → system name)."""
    nome = nome.strip()
    upper = nome.upper()

    # Cooperatives: aggregate by system
    if "SICOOB" in upper or "BANCOOB" in upper:
        return "Sicoob"
    if "SICREDI" in upper or "SICRED" in upper:
        return "Sicredi"
    if "UNICRED" in upper:
        return "Unicred"
    if "CRESOL" in upper or "INTERAÇÃO SOLIDÁRIA" in upper or "INTERACAO SOLIDARIA" in upper:
        return "Cresol"
    if "AILOS" in upper:
        return "Ailos"

    # Mapping of known names
    MAPA = {
        "ITAU UNIBANCO": "Itaú Unibanco", "ITAÚ UNIBANCO": "Itaú Unibanco",
        "ITAU": "Itaú", "ITAÚ": "Itaú",
        "BRADESCO": "Bradesco", "SANTANDER": "Santander",
        "CAIXA ECONÔMICA": "Caixa", "CAIXA ECONOMICA": "Caixa",
        "BANCO DO BRASIL": "Banco do Brasil", "BB -": "BB",
        "NU PAGAMENTOS": "Nubank", "NUBANK": "Nubank",
        "BTG PACTUAL": "BTG Pactual", "C6 BANK": "C6 Bank",
        "BANCO INTER": "Inter", "BANCO PAN": "Pan",
        "BANCO SAFRA": "Safra", "BANCO VOTORANTIM": "Votorantim",
        "BNDES": "BNDES",
        "BANCO DO NORDESTE": "Banco do Nordeste",
        "BANCO DA AMAZONIA": "Banco da Amazônia", "BANCO DA AMAZÔNIA": "Banco da Amazônia",
        "NACIONAL DE DESENVOLVIMENTO": "BNDES",
        "BANRISUL": "Banrisul", "DAYCOVAL": "Daycoval",
        "CITIBANK": "Citibank", "BMG": "BMG",
        "JP MORGAN": "JP Morgan", "GOLDMAN SACHS": "Goldman Sachs",
        "MORGAN STANLEY": "Morgan Stanley", "DEUTSCHE BANK": "Deutsche Bank",
        "BNP PARIBAS": "BNP Paribas", "SOCIETE GENERALE": "Société Générale",
        "CREDIT SUISSE": "Credit Suisse", "UBS": "UBS",
        "HSBC": "HSBC", "RABOBANK": "Rabobank",
        "BOFA MERRILL": "Bank of America",
        "CRÉDIT AGRICOLE": "Crédit Agricole", "CREDIT AGRICOLE": "Crédit Agricole",
        "MUFG BRASIL": "MUFG", "MIZUHO": "Mizuho",
        "BOCOM": "Bocom BBM", "CIELO": "Cielo",
        "REDECARD": "Rede", "GETNET": "Getnet",
        "PAGSEGURO": "PagSeguro", "PAGBANK": "PagBank",
        "STONE": "Stone", "MERCADO PAGO": "Mercado Pago",
        "PICPAY": "PicPay", "AGIBANK": "Agibank",
        "BANESTES": "Banestes", "BRB": "BRB",
        "ABC-BRASIL": "ABC Brasil", "PINE": "Pine",
        "ORIGINAL": "Original", "MASTER": "Master",
        "CLASSICO": "Clássico", "CCB": "CCB Brasil",
        "VOLKSWAGEN": "VW Financeira", "MERCEDES-BENZ": "Mercedes-Benz",
        "CNH INDUSTRIAL": "CNH Industrial", "CSF": "Carrefour",
        "XP": "XP", "MODAL": "Modal", "VOITER": "Voiter",
        "MERCANTIL DO BRASIL": "Mercantil do Brasil",
        "REGIONAL DE DESENVOLVIMENTO": "BRDE",
    }
    for key, val in MAPA.items():
        if key in upper:
            return val

    # Remove generic prefixes
    for prefix in ["BANCO ", "BCO ", "COOP ", "CIA "]:
        if upper.startswith(prefix):
            nome = nome[len(prefix):].strip()
            upper = nome.upper()

    # Remover sufixos comuns
    for suffix in [" S.A.", " S.A", " LTDA.", " LTDA", " - PRUDENCIAL",
                   " INSTITUIÇÃO DE PAGAMENTO", " INSTITUICAO DE PAGAMENTO"]:
        if upper.endswith(suffix.upper()):
            nome = nome[:len(nome)-len(suffix)].strip()

    return nome[:30]


def limpar_nome_singular(nome):
    """Returns a readable name for an individual cooperative."""
    nome = nome.strip()
    upper = nome.upper()

    # 0. Remove generic suffixes, then "COOPERATIVA DE CRÉDITO" from the end
    for suf in [" LTDA.", " LTDA", " S.A.", " S.A"]:
        if upper.endswith(suf.upper()):
            nome = nome[:len(nome)-len(suf)].strip()
            upper = nome.upper()
    for tail in ["COOPERATIVA DE CRÉDITO", "COOPERATIVA DE CREDITO",
                  "DE COOPERATIVAS DE CRÉDITO", "DE COOPERATIVAS DE CREDITO"]:
        if upper.endswith(tail):
            nome = nome[:len(nome)-len(tail)].strip()
            upper = nome.upper()
            break

    # 1. Try to extract the name after " - " (pattern: "LONG COOP - SHORT NAME")
    # Possible separators: " - " or an attached "-"
    sep = " - " if " - " in nome else ("-" if nome.count("-") == 1 else None)
    if sep and sep in nome:
        parts = [p.strip() for p in nome.split(sep) if len(p.strip()) > 3]
        if parts:
            # Identify the part with the system name
            sistemas = ["SICOOB","SICREDI","UNICRED","CRESOL"]
            with_sis = [p for p in parts if any(s in p.upper() for s in sistemas)]
            without = [p for p in parts if not any(s in p.upper() for s in sistemas)]

            if with_sis and len(with_sis) > 1:
                # Several parts with the system → take the shortest
                best = min(with_sis, key=len)
            elif with_sis and without:
                short_sis = min(with_sis, key=len)
                # If the part with the system is short (<30), use it; otherwise prefix the part without it
                if len(short_sis) < 65:
                    best = short_sis
                else:
                    best = without[-1]
                    for s in sistemas:
                        if s in upper:
                            best = s.capitalize() + " " + best
                            break
            elif with_sis:
                best = min(with_sis, key=len)
            else:
                best = parts[-1]
                for s in sistemas:
                    if s in upper:
                        best = s.capitalize() + " " + best
                        break
            for suf in [" LTDA.", " LTDA", " S.A.", "."]:
                if best.upper().endswith(suf.upper()):
                    best = best[:len(best)-len(suf)].strip()
            # If the result still starts with "COOPERATIVA DE...", apply prefix cleaning
            bu = best.upper()
            for pfx in ["COOPERATIVA DE CRÉDITO, POUPANÇA E INVESTIMENTO ","COOPERATIVA DE CREDITO, POUPANÇA E INVESTIMENTO ",
                         "COOPERATIVA DE CRÉDITO E INVESTIMENTO COM INTERAÇÃO SOLIDÁRIA ","COOPERATIVA DE CRÉDITO E ECONOMIA COM INTERAÇÃO SOLIDÁRIA ",
                         "COOPERATIVA DE CRÉDITO DOS MÉDICOS, DENTISTAS, PROFISSIONAIS DA ÁREA DE SAÚDE E DE LIVRE ADMISSÃO ",
                         "COOPERATIVA DE CRÉDITO DOS ","COOPERATIVA DE CREDITO DOS ",
                         "COOPERATIVA DE CRÉDITO DE LIVRE ADMISSÃO ","COOPERATIVA DE CRÉDITO ",
                         "COOPERATIVA DE CREDITO ","COOPERATIVA DE ECONOMIA E CRÉDITO MÚTUO "]:
                if bu.startswith(pfx.upper()):
                    rest = best[len(pfx):].strip()
                    if rest:
                        # Prefix the system if needed
                        if not any(s in rest.upper() for s in sistemas):
                            for s in sistemas:
                                if s in upper:
                                    rest = s.capitalize() + " " + rest
                                    break
                        best = rest
                    break
            return best[:40]

    # 2. Remove long prefixes (longest to shortest)
    prefixos = [
        "COOPERATIVA DE CRÉDITO, POUPANÇA E INVESTIMENTO ",
        "COOPERATIVA DE CREDITO, POUPANÇA E INVESTIMENTO ",
        "COOPERATIVA DE CRÉDITO E INVESTIMENTO COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA DE CREDITO E INVESTIMENTO COM INTERACAO SOLIDARIA ",
        "COOPERATIVA DE CRÉDITO E ECONOMIA COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO E INVESTIMENTO COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO E ECONOMIA COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO COM INTERAÇÃO SOLIDÁRIA ",
        "CONFEDERAÇÃO NACIONAL DAS COOPERATIVAS CENTRAIS DE CRÉDITO E ECONOMIA COM INTERAÇÃO SOLIDÁRIA ",
        "COOPERATIVA CENTRAL DE CRÉDITO ",
        "COOPERATIVA CENTRAL DE CREDITO ",
        "COOPERATIVA DE CRÉDITO DE LIVRE ADMISSÃO ",
        "COOPERATIVA DE CREDITO DE LIVRE ADMISSAO ",
        "COOPERATIVA DE CRÉDITO MÚTUO ",
        "COOPERATIVA DE CREDITO MUTUO ",
        "COOPERATIVA DE CRÉDITO ",
        "COOPERATIVA DE CREDITO ",
        "COOPERATIVA DE ECONOMIA E CRÉDITO MÚTUO ",
        "COOPERATIVA DE ECONOMIA E CREDITO MUTUO ",
        "CONFEDERAÇÃO NACIONAL DAS COOPERATIVAS ",
        "CENTRAL DAS COOPERATIVAS ",
    ]
    for p in sorted(prefixos, key=len, reverse=True):
        if upper.startswith(p.upper()):
            rest = nome[len(p):].strip()
            for suf in [" LTDA.", " LTDA", " S.A.", " S.A"]:
                if rest.upper().endswith(suf.upper()):
                    rest = rest[:len(rest)-len(suf)].strip()
            if rest:
                return rest[:40]

    # 3. For names containing the system, extract system name + complement
    import re
    for sistema in ["UNICRED", "SICOOB", "SICREDI", "CRESOL"]:
        match = re.search(rf'({sistema}\s+\S+(?:\s+\S+)?)', upper)
        if match:
            start = match.start()
            return nome[start:start+40].strip()

    # 4. Fallback
    for suf in [" LTDA.", " LTDA", " S.A.", " S.A"]:
        if upper.endswith(suf.upper()):
            nome = nome[:len(nome)-len(suf)].strip()
    return nome[:40]


# ── Persistence ────────────────────────────────────────────────────────────

def save_json(data, filename):
    """Saves a dictionary as JSON in /data/."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    filepath = DATA_DIR / filename
    filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"✓ {filepath}")


def now_iso():
    """ISO 8601 timestamp for last_updated."""
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
