# Project: Financial Analysis of Institutions in Brazil's National Financial System

## Overview

Analysis of public data from the Central Bank of Brazil (BCB) to investigate the financial health, lending behaviour and competitiveness of banks and credit cooperatives in Brazil.

**Author:** Fernando (Data Analyst)
**Started:** April 2026
**Status:** In planning

---

## Goals

1. **Map the financial health** of institutions (commercial banks, investment banks, credit cooperatives) using indicators such as net income, equity, ROE and ROA.
2. **Analyse credit trends** by institution type and loan type, identifying expansion or contraction.
3. **Compare banks vs cooperatives** on interest rates, delinquency, growth and geographic presence.
4. **Measure banking concentration**: how much of the market the largest banks hold and how that changes over time.
5. **Visualise the geographic distribution** of credit and deposits by state/municipality.

---

## Data Sources

### 1. IF.data (Financial Institution Data)
- **What it is:** BCB portal with quarterly financial statements for every authorised institution.
- **URL:** https://www3.bcb.gov.br/ifdata/
- **Available data:**
  - Total assets, liabilities, equity
  - Net income
  - Loan book (by loan type)
  - Funding (deposits)
  - Basel ratio
  - Number of branches and service points
- **Granularity:** By institution, quarterly
- **Period:** Available from 2010
- **Formats:** CSV download or scraping of the web interface

### 2. SGS (Time Series Management System)
- **What it is:** Public BCB API with thousands of economic and financial time series.
- **API base URL:** https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json
- **Relevant series:**
  - Selic (code 432)
  - IPCA (code 433)
  - Total financial system credit (codes 20539, 20541, 20542)
  - Delinquency (codes 21082, 21083, 21084)
  - Banking spread (codes 20783, 20784)
- **Format:** JSON / CSV
- **Documentation:** https://dadosabertos.bcb.gov.br/

### 3. Interest Rates by Institution
- **What it is:** Rates charged by each institution for each loan type.
- **URL:** https://www.bcb.gov.br/estatisticas/txjuros
- **API:** https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/
- **Available data:**
  - Average monthly and annual rate by institution
  - Loan types: payroll loans, vehicles, mortgages, overdraft, credit card, working capital, etc.
- **Granularity:** By institution, by loan type, monthly

### 4. ESTBAN (Banking Statistics by Municipality)
- **What it is:** Balances of banking operations by branch/municipality.
- **URL:** https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios
- **Available data:**
  - Deposits (demand, savings, time)
  - Credit operations
  - By municipality and by branch
- **Granularity:** Monthly, by municipality
- **Format:** Compressed CSV

### 5. Complaints Ranking
- **What it is:** Quarterly ranking of complaints filed against financial institutions.
- **URL:** https://www.bcb.gov.br/ranking
- **Available data:**
  - Total complaints by institution
  - Complaints index (per million customers)
  - Percentage of upheld complaints
- **Format:** CSV / spreadsheet

### 6. BCB Open Data (Portal)
- **URL:** https://dadosabertos.bcb.gov.br/
- **Additional datasets:**
  - List of authorised institutions
  - Bank branches
  - Banking agents
  - Credit cooperatives

---

## Project Structure

```
bcb-financeiro/
├── 01_dados_brutos/          # Raw downloaded data, unchanged
│   ├── ifdata/               # Financial statements
│   ├── sgstaxas/             # Time series and interest rates
│   ├── estban/               # Municipal banking statistics
│   └── reclamacoes/          # Complaints ranking
├── 02_coleta/                # Data collection/download scripts
├── 03_tratamento/            # Cleaning and transformation scripts
├── 04_analise/               # Exploratory analysis notebooks
├── 05_visualizacao/          # Exported charts and maps
├── 06_dashboard/             # Interactive dashboard (Streamlit or similar)
└── docs/                     # Project documentation
    ├── CONTEXTO.md           # This document
    └── PLANEJAMENTO.md       # Schedule and stages
```

---

## Institution Segmentation

For analysis, institutions are grouped into:

| Segment | Examples |
|----------|----------|
| **Large banks (S1)** | Itaú, Bradesco, Banco do Brasil, Caixa, Santander |
| **Mid-sized banks (S2/S3)** | BTG, Safra, Votorantim, BMG, Pan |
| **Digital banks** | Nubank, Inter, C6, Original, Neon |
| **Cooperatives** | Sicoob, Sicredi, Unicred, Cresol |
| **Public banks** | BB, Caixa, BNDES, BNB, Basa |
| **Finance companies/SCDs** | Creditas, Will Bank, Agibank |

---

## Key Indicators

### Financial health
- **ROE** (Return on Equity) = Net Income / Equity
- **ROA** (Return on Assets) = Net Income / Total Assets
- **Basel ratio** = Capital / Risk-Weighted Assets
- **Net margin** = Net Income / Total Revenue

### Credit
- **Total loan book** (and by loan type)
- **Delinquency** (% of the loan book more than 90 days overdue)
- **Banking spread** (difference between the funding rate and the lending rate)
- **Average interest rate** by loan type

### Market
- **Market share** of credit and deposits (by institution and segment)
- **HHI** (Herfindahl-Hirschman Index) to measure concentration
- **Loan book growth** (YoY, QoQ)

### Customer service
- **Complaints index** per million customers
- **Geographic coverage** (branches by state/municipality)

---

## Tools and Stack

- **Python 3.10+**
- **Pandas / Polars**: data manipulation
- **Requests / httpx**: API collection
- **Plotly / Matplotlib / Seaborn**: visualisation
- **GeoPandas + Folium**: maps
- **Streamlit**: interactive dashboard
- **Jupyter Notebook**: exploratory analysis
- **GitHub**: version control

---

## Questions the Project Should Answer

1. Which institutions are the most profitable? Do cooperatives compete with large banks on profitability?
2. How has market share (credit) changed over the last 5 years? Have digital banks and cooperatives gained ground?
3. Which institutions charge the lowest interest rates by loan type? Do cooperatives really charge less?
4. How concentrated is banking in Brazil and how has that evolved?
5. How is credit distributed geographically? Are there "unbanked" municipalities?
6. Is there a correlation between the complaints index and customer base growth?
7. Which credit segments (payroll loans, mortgages, vehicles) grew the most?

---

## Limitations and Considerations

- **Lag:** IF.data is quarterly, with a delay of about 2 months.
- **Comparability:** Institutions of very different sizes require normalisation (relative, not absolute, indicators).
- **Cooperatives:** Some individual cooperatives report consolidated data through the central system, so watch out for double counting.
- **Digital banks:** Not all are "banks" from a regulatory standpoint; some are SCDs or SEPs, with data in different categories.
- **ESTBAN:** Data comes as accounting items and must be mapped to become readable.
