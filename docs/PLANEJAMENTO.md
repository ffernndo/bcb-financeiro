# Planning | BCB Financial Project

## Phase 1: Data collection
- [ ] Collect IF.data (quarterly financial statements)
- [ ] Set up scripts for the SGS API (time series: Selic, IPCA, credit, delinquency)
- [ ] Collect interest rates by institution via the Olinda/BCB API
- [ ] Download ESTBAN (banking statistics by municipality)
- [ ] Collect the complaints ranking

## Phase 2: Processing
- [ ] Standardise institution names across sources
- [ ] Classify institutions by segment (large, mid-sized, digital, cooperatives, public)
- [ ] Process ESTBAN data (map accounting items)
- [ ] Unify periods and time granularity
- [ ] Build a master table of institutions with metadata

## Phase 3: Analysis
- [ ] Calculate financial indicators (ROE, ROA, Basel ratio, margin)
- [ ] Market share and concentration analysis (HHI)
- [ ] Banks vs cooperatives comparison (rates, delinquency, growth)
- [ ] Credit trends by segment and loan type
- [ ] Geographic analysis of credit/deposits (ESTBAN)
- [ ] Correlation between complaints and growth

## Phase 4: Visualisation
- [ ] Ranking charts (horizontal bars): profitability by institution
- [ ] Time series: credit and market share trends
- [ ] Choropleth map: credit per capita by state/municipality
- [ ] Heatmap: interest rates by institution x loan type
- [ ] Scatter: ROE vs loan book size

## Phase 5: Dashboard
- [ ] Build an interactive dashboard (Streamlit)
- [ ] Filters by segment, period and loan type
- [ ] Publish and document

## Suggested order

1. Start with the **SGS API** (easiest, straight JSON)
2. Then **interest rates by institution** (Olinda API)
3. Then **IF.data** (may need scraping)
4. **ESTBAN** and **complaints** last (complementary)
