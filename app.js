/* ═══════════════════════════════════════
   BCB FINANCIAL | Dashboard v3
   ═══════════════════════════════════════ */

/* ─── PLUGIN: HIERARCHICAL AXIS ──────── */
const _hAxisCfg = {};
function setHAxis(id, cfg) { _hAxisCfg[id] = cfg; }
const MESES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const AXIS_MONTH = { key: d => d.getFullYear()+'-'+d.getMonth(), label: d => MESES[d.getMonth()] };
const AXIS_YEAR = { key: d => d.getFullYear(), label: d => String(d.getFullYear()), bold: true };

const hierarchicalAxisPlugin = {
    id: 'hierarchicalAxis',
    afterDraw(chart) {
        try {
            const config = _hAxisCfg[chart.canvas.id];
            if (!config?.levels) return;
            const { ctx } = chart;
            const xScale = chart.scales.x;
            if (!xScale) return;
            const labels = chart.data.labels;
            if (!labels?.length) return;
            const bottom = chart.chartArea.bottom;
            const left = chart.chartArea.left;
            const right = chart.chartArea.right;
            const dates = labels.map(l => { const p = String(l).split('-'); return new Date(+p[0]||2024, (+p[1]||1)-1, +p[2]||1); });
            const totalH = config.levels.length * 22;
            const lv0 = config.levels[0];
            const slots = [];
            let lastK = null;
            dates.forEach(d => { const k = lv0.key(d); if (k !== lastK) { slots.push({key:k, label:lv0.label(d), date:d}); lastK=k; }});
            if (!slots.length) return;
            const sw = (right - left) / slots.length;
            slots.forEach((s,i) => { s.x0 = left+sw*i; s.x1 = left+sw*(i+1); s.cx = s.x0+sw/2; });
            const y0 = bottom + 14;
            ctx.save(); ctx.textAlign='center'; ctx.textBaseline='top';
            ctx.font = lv0.bold ? "bold 11px 'Inter',sans-serif" : "11px 'Inter',sans-serif";
            ctx.fillStyle = config.color || '#8b949e';
            slots.forEach((s,i) => {
                ctx.fillText(s.label, s.cx, y0);
                if (i > 0) { ctx.beginPath(); ctx.strokeStyle=config.lineColor||'#30363d60'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.moveTo(Math.round(s.x0)+.5, bottom+4); ctx.lineTo(Math.round(s.x0)+.5, bottom+10+totalH); ctx.stroke(); ctx.setLineDash([]); }
            });
            ctx.restore();
            for (let li = 1; li < config.levels.length; li++) {
                const lv = config.levels[li]; const y = bottom + 14 + li * 22;
                const groups = []; let cur = null;
                slots.forEach(s => { const k = lv.key(s.date); if (!cur||cur.key!==k) { cur={key:k,label:lv.label(s.date),x0:s.x0,x1:s.x1}; groups.push(cur); } else { cur.x1=s.x1; }});
                ctx.save(); ctx.textAlign='center'; ctx.textBaseline='top';
                ctx.font = lv.bold ? "bold 11px 'Inter',sans-serif" : "11px 'Inter',sans-serif";
                ctx.fillStyle = config.color || '#8b949e';
                groups.forEach((g,gi) => {
                    ctx.fillText(g.label, (g.x0+g.x1)/2, y);
                    if (gi > 0) { ctx.beginPath(); ctx.strokeStyle=config.lineColor||'#30363d60'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.moveTo(Math.round(g.x0)+.5, bottom+4); ctx.lineTo(Math.round(g.x0)+.5, bottom+10+totalH); ctx.stroke(); ctx.setLineDash([]); }
                });
                ctx.restore();
            }
        } catch(e) { console.warn('hAxis:', e); }
    }
};

/* ─── DISCLAIMER TOOLTIPS ──────────────── */
const FORMULAS = {
    roe: '<strong>ROE (Return on Equity)</strong><br>Formula: Net Income &divide; Shareholders\' Equity &times; 100<br><br>Measures the return on own capital. The higher it is, the more efficiently shareholders\' capital is used.',
    roa: '<strong>ROA (Return on Assets)</strong><br>Formula: Net Income &divide; Total Assets &times; 100<br><br>Measures how efficiently the institution generates profit from its total assets.',
    basileia: '<strong>Basel Ratio</strong><br>Formula: Regulatory Capital &divide; Risk-Weighted Assets<br><br>Measures the institution\'s soundness. The regulatory minimum in Brazil is 10.5%. The higher it is, the better capitalised.',
    inadimplencia: '<strong>Delinquency</strong><br>Share of the loan book more than 90 days overdue.<br><br>Source: SGS/BCB series 21082 (total), 21083 (individuals), 21084 (companies).',
    spread: '<strong>Banking Spread</strong><br>Difference between the average rate charged on loans and the average rate paid on funding (in percentage points).<br><br>Source: SGS/BCB series 20783 (total) and 20784 (individuals).',
    hhi: '<strong>HHI | Herfindahl-Hirschman Index</strong><br>Formula: sum of the squares of each institution\'s market share.<br><br>Interpretation:<br>&bull; Below 1,000 = competitive market<br>&bull; 1,000 to 1,800 = moderately concentrated<br>&bull; Above 1,800 = highly concentrated',
    share: '<strong>Market Share</strong><br>Formula: Institution\'s assets &divide; Total assets of the financial system &times; 100<br><br>Market share measured by total assets.',
    credpc: '<strong>Credit Per Capita</strong><br>Formula: State loan book &divide; Population (IBGE 2024)<br><br>Data is aggregated by the institution\'s <strong>headquarters</strong>, not by the borrower\'s location. States such as DF and SP are inflated because they host the headquarters of large banks.',
    credito: '<strong>Total Credit in the Financial System</strong><br>Outstanding balance of all credit operations in Brazil\'s National Financial System (SFN).<br><br>Source: SGS/BCB series 20539. Includes individuals and companies, all loan types.',
};
function tip(key) { return `<span class="info-tip">?<span class="info-box">${FORMULAS[key]||''}</span></span>`; }

/* ─── STATE ────────────────────────────── */
const APP = {
    data: {}, charts: {}, activeSection: 'resumo',
    filters: { trimestre: null, segmento: 'todos', instituicao: '' },
    sort: { col: null, dir: 'desc' },
};

const SEG_HEX = { grande:'#58a6ff', cooperativa:'#5eead4', outro:'#d29922' };
const SEG_LABELS = { grande:'Large Banks', cooperativa:'Credit Cooperatives', outro:'Others' };
const PAL = ['#58a6ff','#5eead4','#d29922','#bc8cff','#3fb950','#f85149','#f0a050','#60a5fa','#a78bfa','#4ade80','#fb923c','#38bdf8','#e879f9','#facc15','#34d399'];
const SECTIONS = [
    {id:'resumo',label:'Summary'},{id:'rentabilidade',label:'Profitability'},
    {id:'credito',label:'Credit'},{id:'taxas',label:'Interest Rates'},
    {id:'concentracao',label:'Concentration'},{id:'comparativo',label:'Banks vs Co-ops'},
    {id:'geografico',label:'Map'},{id:'reclamacoes',label:'Complaints'},
];

const FMT = {
    brl: v => v>=1e12?`R$ ${(v/1e12).toFixed(1)}T`:v>=1e9?`R$ ${(v/1e9).toFixed(1)}B`:v>=1e6?`R$ ${(v/1e6).toFixed(0)}M`:`R$ ${v.toLocaleString('en-GB')}`,
    pct: (v,d=2) => `${v.toFixed(d)}%`,
    tri: dt => { const q={'03':'Q1','06':'Q2','09':'Q3','12':'Q4'}[dt.slice(4)]||''; return `${q}/${dt.slice(0,4)}`; },
};

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function segC(s) { return SEG_HEX[s]||'#6e7681'; }

function getTris() { const i=APP.data.indicadores?.trimestres; return i?Object.keys(i).sort():[]; }
function activeTri() { const t=getTris(), f=APP.filters.trimestre; return (f&&t.includes(f))?f:t[t.length-1]||null; }
function getAg(tri) { return APP.data.indicadores?.trimestres?.[tri]?.agregado || []; }
function getSing(tri, nome) { return APP.data.indicadores?.trimestres?.[tri]?.singulares?.[nome] || []; }
function filtered(tri) {
    let d = getAg(tri).filter(i=>i.ativo_total>0);
    const f = APP.filters;
    if (f.segmento !== 'todos') d = d.filter(i=>i.segmento===f.segmento);
    if (f.instituicao) d = d.filter(i=>i.nome===f.instituicao);
    return d;
}
function allNames() {
    const tri = activeTri(); if (!tri) return [];
    let d = getAg(tri);
    if (APP.filters.segmento !== 'todos') d = d.filter(i=>i.segmento===APP.filters.segmento);
    return [...new Set(d.map(i=>i.nome))].sort();
}

/* ─── Sortable table helper ────────────── */
function sortData(data, col, dir) {
    return [...data].sort((a,b) => {
        let va = a[col], vb = b[col];
        if (va == null) va = -Infinity; if (vb == null) vb = -Infinity;
        return dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
}
function sortHeader(col, label, extraClass='') {
    const s = APP.sort;
    const cls = s.col===col ? (s.dir==='asc' ? 'sort-asc' : 'sort-desc') : '';
    return `<th class="sortable ${cls} ${extraClass}" data-sort="${col}">${label}</th>`;
}

/* ─── Init ─────────────────────────────── */
async function init() {
    const files = ['credito','taxas','resultados','indicadores','concentracao','estban','reclamacoes','instituicoes'];
    try {
        const res = await Promise.allSettled(files.map(f=>fetch(`data/${f}.json`).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})));
        let n=0; files.forEach((f,i)=>{if(res[i].status==='fulfilled'){APP.data[f]=res[i].value;n++;}else{APP.data[f]=null;}});
        if(n===0){document.getElementById('app').innerHTML='<div class="loading" style="color:var(--accent-red)"><p>Error loading data.</p></div>';return;}
    } catch(e) { return; }
    render();
}

/* ─── Render ───────────────────────────── */
function render() {
    try {
        document.getElementById('app').innerHTML = renderHeader()+renderNav()+renderViewToggle()+renderToolbar()+renderKPIs()+renderSections()+renderFooter();
        bindEvents(); showSection(APP.activeSection);
    } catch(e) { console.error('Render:', e); }
}

function renderHeader() {
    const ts = APP.data.credito?.last_updated?.slice(0,10)||'';
    return `<header class="header"><div class="header-left"><div class="header-logo"><span>BCB</span> Financial</div><span class="header-badge">SFN</span></div><div class="header-right"><span class="header-timestamp">Updated: ${ts}</span><button class="theme-toggle" id="themeToggle">☀</button></div></header>`;
}

function renderNav() {
    return `<nav class="nav" role="navigation" aria-label="Sections">${SECTIONS.map(s=>`<button class="nav-btn${s.id===APP.activeSection?' active':''}" data-section="${s.id}">${s.label}</button>`).join('')}</nav>`;
}

function renderViewToggle() {
    const f=APP.filters.segmento;
    return `<div class="view-toggle"><button class="view-btn${f==='todos'?' active':''}" data-view="todos">All</button><button class="view-btn${f==='grande'?' active':''}" data-view="grande">Banks</button><button class="view-btn${f==='cooperativa'?' active':''}" data-view="cooperativa">Co-ops</button></div>`;
}

function renderToolbar() {
    const tris=getTris(), at=activeTri(), names=allNames(), f=APP.filters;
    return `<div class="filter-toolbar">
        <div class="filter-field"><label>Period</label><select class="filter-select" id="fTri">${tris.map(t=>`<option value="${t}"${t===at?' selected':''}>${FMT.tri(t)}</option>`).join('')}</select></div>
        <div class="filter-field"><label>Segment</label><select class="filter-select" id="fSeg"><option value="todos"${f.segmento==='todos'?' selected':''}>All</option>${Object.entries(SEG_LABELS).map(([k,v])=>`<option value="${k}"${f.segmento===k?' selected':''}>${v}</option>`).join('')}</select></div>
        <div class="filter-divider"></div>
        <div class="filter-field"><label>Institution</label><select class="filter-select" id="fInst" style="min-width:200px"><option value="">All</option>${names.map(n=>`<option value="${n}"${f.instituicao===n?' selected':''}>${n}</option>`).join('')}</select></div>
    </div>`;
}

/* ─── KPI Helpers ─────────────────────── */
function prevTri(tri) { const t=getTris(), i=t.indexOf(tri); return i>0?t[i-1]:null; }
function fmtDelta(cur, prev) {
    if(cur==null||prev==null) return '';
    const d=cur-prev;
    if(Math.abs(d)<0.005) return '';
    const arrow=d>0?'▲':'▼', cls=d>0?'delta-up':'delta-down';
    return `<span class="${cls}">${arrow} ${Math.abs(d).toFixed(Math.abs(d)<1?2:1)}</span>`;
}
function kpiCard(label, value, detail, tipKey, delta) {
    return `<div class="kpi-card"><div class="kpi-label">${label} ${tipKey?tip(tipKey):''}</div><div class="kpi-value">${value} ${delta||''}</div><div class="kpi-detail">${detail}</div></div>`;
}
function safeMetric(v, fmt) { return (v!=null && !(v===0)) ? fmt(v) : (v===0?'N/A':'—'); }

function renderKPIs() {
    const f=APP.filters, tri=activeTri();
    if(f.instituicao) return kpiInstituicao(tri);
    if(f.segmento!=='todos') return kpiSegmento(tri);
    return kpiSistema(tri);
}

function kpiSistema(tri) {
    const s=APP.data.credito?.series, conc=APP.data.concentracao?.trimestres?.[tri];
    const ct=s?.credito_total?.ultimo?.valor, inad=s?.inadimplencia?.ultimo?.valor;
    const spr=s?.spread_total?.ultimo?.valor, t5=conc?.top5_share_ativo;
    return `<div class="kpi-grid">
        ${kpiCard('Total Credit',ct?FMT.brl(ct*1e6):'—','Financial system total balance','credito')}
        ${kpiCard('Delinquency',inad?FMT.pct(inad):'—','More than 90 days overdue','inadimplencia')}
        ${kpiCard('Spread',spr?FMT.pct(spr,1):'—','Funding vs lending','spread')}
        ${kpiCard('Top 5 Share',t5?FMT.pct(t5,1):'—','Concentration'+(tri?' ('+FMT.tri(tri)+')':''),'share')}
    </div>`;
}

function kpiInstituicao(tri) {
    const inst=filtered(tri)[0]; if(!inst) return '<div class="kpi-grid"></div>';
    const prev=prevTri(tri), instP=prev?getAg(prev).find(i=>i.nome===inst.nome):null;
    const roe=inst.roe, roa=inst.roa, bas=inst.indice_basileia;
    const roeFmt = (roe===0&&roa===0&&inst.ativo_total>1e9) ? 'N/A*' : (roe!=null?FMT.pct(roe):'—');
    const roaFmt = (roe===0&&roa===0&&inst.ativo_total>1e9) ? 'N/A*' : (roa!=null?FMT.pct(roa,3):'—');
    return `<div class="kpi-grid">
        ${kpiCard('Total Assets',FMT.brl(inst.ativo_total),inst.nome,'',fmtDelta(inst.ativo_total/1e9,instP?.ativo_total/1e9))}
        ${kpiCard('ROE',roeFmt,inst.nome,'roe',fmtDelta(roe,instP?.roe))}
        ${kpiCard('ROA',roaFmt,inst.nome,'roa',fmtDelta(roa,instP?.roa))}
        ${kpiCard('Basel Ratio',bas!=null?FMT.pct(bas*100,1):'N/A',inst.nome,'basileia',fmtDelta(bas?bas*100:null,instP?.indice_basileia?instP.indice_basileia*100:null))}
    </div>${(roe===0&&roa===0&&inst.ativo_total>1e9)?'<div class="note-box" style="margin:0 24px">* Not enough profitability data for this institution. Individual co-ops may not be grouped correctly in the BCB database.</div>':''}`;
}

function kpiSegmento(tri) {
    const data=filtered(tri);
    if(!data.length) return '<div class="kpi-grid"></div>';
    const totalAtivo=data.reduce((s,i)=>s+i.ativo_total,0);
    const wRoe=data.filter(i=>i.roe!=null&&!(i.roe===0&&i.roa===0&&i.ativo_total>1e9));
    const avgRoe=wRoe.length?wRoe.reduce((s,i)=>s+i.roe*i.ativo_total,0)/wRoe.reduce((s,i)=>s+i.ativo_total,0):null;
    const wBas=data.filter(i=>i.indice_basileia!=null);
    const avgBas=wBas.length?wBas.reduce((s,i)=>s+i.indice_basileia*i.ativo_total,0)/wBas.reduce((s,i)=>s+i.ativo_total,0):null;
    const segLabel=SEG_LABELS[APP.filters.segmento]||APP.filters.segmento;
    // Trends
    const prev=prevTri(tri), dataPrev=prev?getAg(prev).filter(i=>i.ativo_total>0&&i.segmento===APP.filters.segmento):[];
    const totalAtivoPrev=dataPrev.reduce((s,i)=>s+i.ativo_total,0)||null;
    const wRoeP=dataPrev.filter(i=>i.roe!=null&&!(i.roe===0&&i.roa===0&&i.ativo_total>1e9));
    const avgRoeP=wRoeP.length?wRoeP.reduce((s,i)=>s+i.roe*i.ativo_total,0)/wRoeP.reduce((s,i)=>s+i.ativo_total,0):null;
    return `<div class="kpi-grid">
        ${kpiCard('Total Assets',FMT.brl(totalAtivo),segLabel,'',fmtDelta(totalAtivo/1e9,totalAtivoPrev?totalAtivoPrev/1e9:null))}
        ${kpiCard('Average ROE',avgRoe!=null?FMT.pct(avgRoe):'—','Asset-weighted','roe',fmtDelta(avgRoe,avgRoeP))}
        ${kpiCard('Average Basel Ratio',avgBas!=null?FMT.pct(avgBas*100,1):'—','Asset-weighted','basileia')}
        ${kpiCard('Institutions',String(data.length),segLabel+' ('+FMT.tri(tri)+')','')}
    </div>`;
}

function renderFooter() {
    return `<footer class="footer">Source: <a href="https://www.bcb.gov.br" target="_blank">Banco Central do Brasil</a> | IF.data, SGS, Olinda<br><a href="https://github.com/Fexndev/bcb-financeiro" target="_blank">GitHub</a></footer>`;
}

const SECTION_FN = {resumo:rResumo,rentabilidade:rRent,credito:rCred,taxas:rTaxas,concentracao:rConc,comparativo:rComp,geografico:rGeo,reclamacoes:rRec};
function renderSections() {
    // Lazy: render only active section
    return SECTIONS.map(s=>`<div class="section${s.id===APP.activeSection?' active':''}" id="sec-${s.id}">${s.id===APP.activeSection?(SECTION_FN[s.id]?.()??''):''}</div>`).join('');
}

/* ─── SUMMARY ──────────────────────────── */
function rResumo() {
    const tri=activeTri(); if(!tri) return '<p>Data unavailable</p>';
    let data = filtered(tri).sort((a,b)=>b.ativo_total-a.ativo_total);
    if (APP.sort.col) data = sortData(data, APP.sort.col, APP.sort.dir);
    data = data.slice(0,20);
    const hasSing = APP.filters.instituicao && getSing(tri, APP.filters.instituicao).length;
    return `<div class="section-title">Overview | ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Top 10 ROE ${tip('roe')}</div><div class="chart-container-sm"><canvas id="c-roe-top"></canvas></div></div>
        <div class="card"><div class="card-title">${(APP.filters.instituicao||APP.filters.segmento!=='todos')?'Total Assets Trend':'Total Credit Trend'} ${tip('credito')}</div><div class="chart-container-sm"><canvas id="c-cred-evo"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Main Institutions</div><div class="table-wrap">
        <table id="tbl-resumo"><thead><tr><th>#</th>${sortHeader('nome','Institution')}${sortHeader('segmento','Segment')}${sortHeader('ativo_total','Total Assets','td-right')}${sortHeader('roe','ROE '+tip('roe'),'td-right')}${sortHeader('roa','ROA '+tip('roa'),'td-right')}${sortHeader('indice_basileia','Basel '+tip('basileia'),'td-right')}</tr></thead>
        <tbody>${data.map((i,x)=>`<tr><td class="td-mono">${x+1}</td><td class="td-name">${i.nome}${i.qtd_singulares>1?' <span style="color:var(--text-muted);font-size:.65rem">(${i.qtd_singulares})</span>':''}</td><td><span class="td-seg seg-${i.segmento}">${SEG_LABELS[i.segmento]||i.segmento}</span></td><td class="td-mono td-right">${FMT.brl(i.ativo_total)}</td><td class="td-mono td-right ${i.roe>0?'badge-positive':'badge-negative'}">${i.roe!=null?FMT.pct(i.roe):'—'}</td><td class="td-mono td-right">${i.roa!=null?FMT.pct(i.roa,3):'—'}</td><td class="td-mono td-right">${i.indice_basileia!=null?FMT.pct(i.indice_basileia*100,1):'—'}</td></tr>`).join('')}</tbody></table>
    </div></div>
    ${hasSing ? rDrillDown(tri) : ''}`;
}

function rDrillDown(tri) {
    const nome = APP.filters.instituicao;
    let sings = getSing(tri, nome);
    if (!sings.length) return '';
    if (APP.sort.col) sings = sortData(sings, APP.sort.col, APP.sort.dir);
    return `<div class="card"><div class="card-title">Individual co-ops | ${nome} (${sings.length})</div><div class="table-wrap">
        <table><thead><tr><th>#</th>${sortHeader('nome','Name')}${sortHeader('uf','UF')}${sortHeader('ativo_total','Assets','td-right')}${sortHeader('carteira_credito','Credit','td-right')}${sortHeader('roe','ROE','td-right')}</tr></thead>
        <tbody>${sings.map((s,i)=>`<tr><td class="td-mono">${i+1}</td><td class="td-name">${s.nome}</td><td>${s.uf||''}</td><td class="td-mono td-right">${FMT.brl(s.ativo_total)}</td><td class="td-mono td-right">${FMT.brl(s.carteira_credito)}</td><td class="td-mono td-right">${s.roe!=null?FMT.pct(s.roe):'—'}</td></tr>`).join('')}</tbody></table>
    </div></div>`;
}

/* ─── PROFITABILITY ────────────────────── */
function rRent() {
    const tri=activeTri(); if(!tri) return '<p>Data unavailable</p>';
    return `<div class="section-title">Profitability | ${FMT.tri(tri)}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">ROE by Institution ${tip('roe')}</div><div class="chart-container"><canvas id="c-roe"></canvas></div></div>
        <div class="card"><div class="card-title">Average ROE Trend ${tip('roe')}</div><div class="chart-container"><canvas id="c-roe-evo"></canvas></div></div>
    </div>`;
}

/* ─── CREDIT ───────────────────────────── */
function rCred() {
    const f=APP.filters, hasFilter = f.instituicao || f.segmento!=='todos';
    if (hasFilter) {
        const label = f.instituicao || SEG_LABELS[f.segmento] || f.segmento;
        return `<div class="section-title">Credit | ${label}</div>
        <div class="grid-2">
            <div class="card"><div class="card-title">Loan Book Trend ${tip('credito')}</div><div class="chart-container"><canvas id="c-cred-filt"></canvas></div></div>
            <div class="card"><div class="card-title">Total Assets vs Loan Book</div><div class="chart-container"><canvas id="c-ativo-cred"></canvas></div></div>
        </div>
        <div class="note-box">Delinquency and banking spread data are only available as a financial system average (SGS/BCB series).</div>
        <div class="card"><div class="card-title">Banking Spread | Financial System ${tip('spread')}</div><div class="chart-container-sm"><canvas id="c-spread"></canvas></div></div>`;
    }
    return `<div class="section-title">Credit and Delinquency</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Credit: Individuals vs Companies ${tip('credito')}</div><div class="chart-container"><canvas id="c-pfpj"></canvas></div></div>
        <div class="card"><div class="card-title">Delinquency ${tip('inadimplencia')}</div><div class="chart-container"><canvas id="c-inad"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">Banking Spread ${tip('spread')}</div><div class="chart-container-sm"><canvas id="c-spread"></canvas></div></div>`;
}

/* ─── RATES ────────────────────────────── */
function rTaxas() {
    const tx=APP.data.taxas?.modalidades; if(!tx) return '<p>Data unavailable</p>';
    const mods=Object.entries(tx).filter(([,v])=>!v.erro);
    const f=APP.filters, hasFilter = f.instituicao || f.segmento!=='todos';
    return `<div class="section-title">Interest Rates</div>
    ${hasFilter?'<div class="note-box">Interest rates by loan type are available as a national financial system average. The BCB does not publish data per individual institution in this format.</div>':''}
    <div class="card"><div class="card-title">Average Annual Rate by Loan Type</div><div class="chart-container"><canvas id="c-taxas"></canvas></div></div>
    <div class="card"><div class="card-title">Comparison by Segment (% p.a.)</div><div class="table-wrap"><table>
        <thead><tr><th>Loan type</th>${Object.values(SEG_LABELS).map(v=>`<th class="td-right">${v}</th>`).join('')}</tr></thead>
        <tbody>${mods.map(([,m])=>`<tr><td class="td-name">${m.descricao}</td>${Object.keys(SEG_LABELS).map(s=>{const v=m.media_por_segmento?.[s];return`<td class="td-mono td-right">${v?FMT.pct(v,1):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody>
    </table></div></div>`;
}

/* ─── CONCENTRATION ────────────────────── */
function rConc() {
    const tri=activeTri(); if(!tri) return '<p>Data unavailable</p>';
    return `<div class="section-title">Concentration | ${FMT.tri(tri)} ${tip('hhi')}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Market Share | Assets ${tip('share')}</div><div class="chart-container"><canvas id="c-share"></canvas></div></div>
        <div class="card"><div class="card-title">Share by Segment</div><div class="chart-container"><canvas id="c-share-seg"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title">HHI and Top 5 Trend</div><div class="chart-container-sm"><canvas id="c-hhi"></canvas></div></div>`;
}

/* ─── COMPARISON ───────────────────────── */
function rComp() {
    const f=APP.filters;
    const title = f.instituicao ? `${f.instituicao} vs Segment` : 'Large Banks vs Credit Cooperatives';
    return `<div class="section-title">${title}</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Average ROE ${tip('roe')}</div><div class="chart-container"><canvas id="c-comp-roe"></canvas></div></div>
        <div class="card"><div class="card-title">Rates Compared (% p.a.)</div><div class="chart-container"><canvas id="c-comp-tx"></canvas></div></div>
    </div>`;
}

/* ─── GEOGRAPHY ────────────────────────── */
const UF_REGIAO = {AC:'North',AL:'Northeast',AM:'North',AP:'North',BA:'Northeast',CE:'Northeast',DF:'Centre-West',ES:'Southeast',GO:'Centre-West',MA:'Northeast',MG:'Southeast',MS:'Centre-West',MT:'Centre-West',PA:'North',PB:'Northeast',PE:'Northeast',PI:'Northeast',PR:'South',RJ:'Southeast',RN:'Northeast',RO:'North',RR:'North',RS:'South',SC:'South',SE:'Northeast',SP:'Southeast',TO:'North'};
const GEO_REGIOES = ['North','Northeast','Centre-West','Southeast','South'];
const GEO_PAGE_SIZE = 10;

function rGeo() {
    const e=APP.data.estban; if(!e?.por_uf) return '<p>Data unavailable</p>';
    return `<div class="section-title">Credit by State ${tip('credpc')}</div>
    <div class="geo-layout">
        <div class="geo-left">
            <div class="card geo-map-card"><div id="mapa-container"></div></div>
        </div>
        <div class="geo-right">
            <div class="card geo-table-card" id="geo-table-root"></div>
        </div>
    </div>
    <div class="note-box">Data aggregated by <strong>institution headquarters</strong>. States such as DF and SP host the headquarters of large national banks, which artificially inflates credit per capita. Hover over each state on the map for details.</div>`;
}

function renderGeoTable() {
    const root = document.getElementById('geo-table-root');
    if (!root) return;
    const e = APP.data.estban; if (!e?.por_uf) return;
    const sel = APP._geoRegioes || new Set();
    const page = APP._geoPage || 0;
    let ufs = [...e.por_uf].sort((a,b)=>b.credito_per_capita-a.credito_per_capita);
    if (sel.size) ufs = ufs.filter(u => sel.has(UF_REGIAO[u.uf]));
    const totalCred = e.por_uf.reduce((s,u)=>s+(u.carteira_credito||0),0);
    const totalPages = Math.ceil(ufs.length / GEO_PAGE_SIZE);
    const paged = ufs.slice(page * GEO_PAGE_SIZE, (page+1) * GEO_PAGE_SIZE);
    const fmtCred = v => v>=1e12?`${(v/1e12).toFixed(1)}T`:v>=1e9?`${(v/1e9).toFixed(1)}B`:v>=1e6?`${(v/1e6).toFixed(0)}M`:`${(v/1e3).toFixed(0)}K`;

    root.innerHTML = `<div class="card-title">Ranking by State</div>
        <div class="geo-filters">${GEO_REGIOES.map(r=>`<button class="geo-reg-btn${sel.has(r)?' active':''}" data-reg="${r}">${r}</button>`).join('')}</div>
        <div class="table-wrap"><table class="geo-table">
            <thead><tr><th>#</th><th>State</th><th>Region</th><th class="td-right">Credit</th><th class="td-right">%</th><th class="td-right">Per capita</th></tr></thead>
            <tbody>${paged.map((u,i)=>`<tr><td class="td-mono">${page*GEO_PAGE_SIZE+i+1}</td><td><strong>${u.uf}</strong></td><td class="td-muted">${UF_REGIAO[u.uf]||''}</td><td class="td-mono td-right">${fmtCred(u.carteira_credito)}</td><td class="td-mono td-right">${(u.carteira_credito/totalCred*100).toFixed(1)}%</td><td class="td-mono td-right">R$ ${u.credito_per_capita.toLocaleString('en-GB',{maximumFractionDigits:0})}</td></tr>`).join('')}</tbody>
        </table></div>
        ${totalPages>1?`<div class="geo-pager">${Array.from({length:totalPages},(_,i)=>`<button class="geo-page-btn${i===page?' active':''}" data-page="${i}">${i+1}</button>`).join('')}<span class="td-muted" style="font-size:.72rem;margin-left:8px">${ufs.length} UFs</span></div>`:''}`;

    // Bind region filter buttons (multi-select toggle)
    root.querySelectorAll('.geo-reg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = btn.dataset.reg;
            if (!APP._geoRegioes) APP._geoRegioes = new Set();
            if (APP._geoRegioes.has(r)) APP._geoRegioes.delete(r); else APP._geoRegioes.add(r);
            APP._geoPage = 0;
            renderGeoTable();
        });
    });
    // Bind page buttons
    root.querySelectorAll('.geo-page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            APP._geoPage = +btn.dataset.page;
            renderGeoTable();
        });
    });
}

/* ─── COMPLAINTS ───────────────────────── */
function rRec() {
    const r=APP.data.reclamacoes; if(!r) return '<p>Data unavailable</p>';
    const rk=[...r.ranking].sort((a,b)=>b.indice-a.indice);
    const SEG_NAMES = {S1:'Large Private',S2:'Mid-sized',S1_publico:'Public',digital:'Digital',cooperativa:'Co-ops',grande:'Large',outro:'Others'};
    return `<div class="section-title">Complaints</div>
    <div class="note-box">Index = upheld regulated complaints per million customers. Source: ${r.source||'BCB'}.</div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Index by Institution</div><div class="chart-container"><canvas id="c-rec"></canvas></div></div>
        <div class="card"><div class="card-title">Distribution by Complaint Type</div><div class="chart-container"><canvas id="c-rec-tipo"></canvas></div></div>
    </div>
    <div class="grid-2">
        <div class="card"><div class="card-title">Average by Segment</div><div class="chart-container-sm"><canvas id="c-rec-seg"></canvas></div></div>
        <div class="card"><div class="card-title">Detailed Ranking</div><div class="table-wrap"><table>
            <thead><tr><th>#</th><th>Institution</th><th>Segment</th><th class="td-right">Index</th><th class="td-right">Complaints</th><th class="td-right">Customers (M)</th></tr></thead>
            <tbody>${rk.map((r,i)=>`<tr><td class="td-mono">${i+1}</td><td class="td-name">${r.instituicao}</td><td><span class="td-seg seg-${r.segmento==='cooperativa'?'cooperativa':r.segmento==='S1'||r.segmento==='S1_publico'?'grande':'outro'}">${SEG_NAMES[r.segmento]||r.segmento}</span></td><td class="td-mono td-right">${r.indice.toFixed(2)}</td><td class="td-mono td-right">${r.reclamacoes?.toLocaleString('en-GB')||'—'}</td><td class="td-mono td-right">${r.clientes_milhoes||'—'}</td></tr>`).join('')}</tbody>
        </table></div></div>
    </div>`;
}

/* ═══════════════════════════════════════
   CHARTS
   ═══════════════════════════════════════ */

function defs(hideY=true) {
    const t=css('--text-secondary'),m=css('--text-muted'),b=css('--border');
    return { responsive:true, maintainAspectRatio:false,
        plugins: { legend:{labels:{color:t,font:{family:"'Inter'",size:11}}}, datalabels:{display:false} },
        scales: { x:{display:false}, y:hideY?{display:false}:{ticks:{color:m,font:{size:10}},grid:{color:b+'30'},border:{display:false}} },
    };
}

function dlabel(fmt) {
    return { display:true, color:css('--text-primary'), font:{family:"'JetBrains Mono'",size:10,weight:600}, anchor:'end', align:'end', offset:2, formatter:fmt||(v=>v?.toFixed?.(1)) };
}

// Datalabel for line charts: show every Nth point + last
function dlabelLine(fmt, every=6) {
    return { display: (ctx) => { const i=ctx.dataIndex, len=ctx.dataset.data.length; return i===len-1 || i%every===0; },
        color:css('--text-primary'), font:{family:"'JetBrains Mono'",size:9,weight:600}, anchor:'end', align:'top', offset:4, formatter:fmt };
}

function hbar(labels, values, colors, fmtFn) {
    return { type:'bar', data:{labels, datasets:[{data:values, backgroundColor:colors, borderRadius:6}]},
        options: { ...defs(), indexAxis:'y',
            plugins:{...defs().plugins, legend:{display:false}, datalabels:dlabel(fmtFn)},
            scales:{x:{display:false}, y:{display:true, ticks:{color:css('--text-primary'),font:{size:10}}, grid:{display:false}, border:{display:false}}},
        },
    };
}

// Line chart with hierarchical axis
function lineHAxis(canvasId, labels, datasets, yFmt) {
    setHAxis(canvasId, { color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[AXIS_MONTH, AXIS_YEAR] });
    return { type:'line', data:{labels, datasets},
        options: { ...defs(false),
            plugins:{...defs(false).plugins, datalabels:{display:false}},
            scales: { x:{display:false}, y:{display:false} },
            layout: { padding: { bottom: 50 } },
        },
    };
}

function destroyCharts() { Object.values(APP.charts).forEach(c=>c.destroy()); APP.charts={}; }

function mountCharts() {
    destroyCharts();
    try { ({resumo:mResumo,rentabilidade:mRent,credito:mCred,taxas:mTaxas,concentracao:mConc,comparativo:mComp,geografico:mGeo,reclamacoes:mRec})[APP.activeSection]?.(); } catch(e) { console.error('Chart:',e); }
}

/* ─── Summary ──────────────────────────── */
function mResumo() {
    const tri=activeTri();
    const data=filtered(tri).filter(i=>i.roe!=null&&i.ativo_total>1e9).sort((a,b)=>b.roe-a.roe).slice(0,10);
    const ctx1=document.getElementById('c-roe-top');
    if(ctx1&&data.length) APP.charts.a=new Chart(ctx1, hbar(data.map(i=>i.nome), data.map(i=>i.roe), data.map((_,i)=>PAL[i%PAL.length]), v=>v.toFixed(1)+'%'));

    const f=APP.filters, hasFilter = f.instituicao || f.segmento!=='todos';
    if (hasFilter) {
        // Quarterly trend of filtered assets
        const tris2=getTris(), ind2=APP.data.indicadores?.trimestres;
        const vals=tris2.map(t=>{
            let items=(ind2[t]?.agregado||[]).filter(i=>i.ativo_total>0);
            if(f.segmento!=='todos') items=items.filter(i=>i.segmento===f.segmento);
            if(f.instituicao) items=items.filter(i=>i.nome===f.instituicao);
            return items.reduce((s,i)=>s+i.ativo_total,0);
        });
        triLineChart('c-cred-evo', tris2, [{label:'Total Assets',data:vals,borderColor:'#5eead4',backgroundColor:'rgba(94,234,212,.1)',fill:true,tension:.3,pointRadius:4,_fmt:v=>FMT.brl(v)}]);
    } else {
        const cr=APP.data.credito?.series?.credito_total?.monthly;
        if(cr) {
            const d=cr.slice(-24), id='c-cred-evo', ctx2=document.getElementById(id);
            if(ctx2) {
                setHAxis(id, {color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[AXIS_MONTH,AXIS_YEAR]});
                APP.charts.b=new Chart(ctx2, { type:'line',
                    data:{labels:d.map(m=>m.data+'-01'), datasets:[{data:d.map(m=>m.valor),borderColor:'#5eead4',backgroundColor:'rgba(94,234,212,.1)',fill:true,tension:.3,pointRadius:0}]},
                    options:{...defs(false), plugins:{legend:{display:false}, datalabels:dlabelLine(v=>(v/1e6).toFixed(1)+' tri',6)}, scales:{x:{display:false},y:{display:false}}, layout:{padding:{bottom:50}}},
                });
            }
        }
    }
}

/* ─── Profitability ────────────────────── */
function mRent() {
    const tri=activeTri(), f=APP.filters;
    const data=filtered(tri).filter(i=>i.roe!=null&&i.ativo_total>1e9).sort((a,b)=>b.roe-a.roe).slice(0,15);
    const ctx1=document.getElementById('c-roe');
    if(ctx1&&data.length) APP.charts.c=new Chart(ctx1, hbar(data.map(i=>i.nome), data.map(i=>i.roe), data.map(i=>segC(i.segmento)), v=>v.toFixed(1)+'%'));

    const tris=getTris(), ind=APP.data.indicadores?.trimestres;
    let ds;
    if (f.instituicao) {
        // ROE trend for this institution
        const vals = tris.map(t => { const inst = (ind[t]?.agregado||[]).find(i=>i.nome===f.instituicao); return inst?.roe ?? null; });
        ds = [{ label:f.instituicao, data:vals, borderColor:'#5eead4', backgroundColor:'rgba(94,234,212,.1)', fill:true, tension:.3, pointRadius:4 }];
    } else if (f.segmento !== 'todos') {
        // ROE trend for the filtered segment
        const vals = tris.map(t => { const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===f.segmento&&i.roe!=null); return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null; });
        ds = [{ label:SEG_LABELS[f.segmento]||f.segmento, data:vals, borderColor:segC(f.segmento), backgroundColor:'transparent', tension:.3, pointRadius:4 }];
    } else {
        // All: 3 lines by segment
        ds = Object.keys(SEG_LABELS).map(seg=>({label:SEG_LABELS[seg], data:tris.map(t=>{const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===seg&&i.roe!=null);return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null;}), borderColor:segC(seg), backgroundColor:'transparent', tension:.3, pointRadius:3}));
    }
    const id='c-roe-evo', ctx2=document.getElementById(id);
    if(ctx2) {
        const tLabels = tris.map(t => t.slice(0,4)+'-'+t.slice(4)+'-01');
        setHAxis(id, {color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[{key:d=>`${d.getFullYear()}-${d.getMonth()}`, label:d=>FMT.tri(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`)}, AXIS_YEAR]});
        APP.charts.d=new Chart(ctx2, {type:'line', data:{labels:tLabels, datasets:ds}, options:{...defs(false), plugins:{...defs(false).plugins,datalabels:dlabelLine(v=>v?.toFixed(1)+'%',3)}, scales:{x:{display:false},y:{display:false}}, layout:{padding:{bottom:50}}}});
    }
}

/* ─── Credit ───────────────────────────── */
function lineTS(canvasId, datasets) {
    const id=canvasId, ctx=document.getElementById(id); if(!ctx) return;
    const labels = datasets[0].raw.map(m=>m.data+'-01');
    setHAxis(id, {color:css('--text-secondary'), lineColor:css('--border')+'60', levels:[AXIS_MONTH,AXIS_YEAR]});
    APP.charts[id]=new Chart(ctx, {type:'line', data:{labels, datasets:datasets.map(d=>({label:d.label, data:d.raw.map(m=>m.valor), borderColor:d.color, tension:.3, pointRadius:0, borderWidth:d.width||1.5, borderDash:d.dash||[]}))},
        options:{...defs(false), plugins:{legend:{labels:{color:css('--text-secondary')}}, datalabels:dlabelLine(datasets[0].fmt||null,8)}, scales:{x:{display:false},y:{display:false}}, layout:{padding:{bottom:50}}}});
}
function triLineChart(canvasId, tris, datasets) {
    const id=canvasId, ctx=document.getElementById(id); if(!ctx) return;
    const tLabels=tris.map(t=>t.slice(0,4)+'-'+t.slice(4)+'-01');
    setHAxis(id,{color:css('--text-secondary'),lineColor:css('--border')+'60',levels:[{key:d=>`${d.getFullYear()}-${d.getMonth()}`,label:d=>FMT.tri(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`)},AXIS_YEAR]});
    APP.charts[id]=new Chart(ctx,{type:'line',data:{labels:tLabels,datasets},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:dlabelLine(datasets[0]._fmt||null,3)},scales:{x:{display:false},y:{display:false}},layout:{padding:{bottom:50}}}});
}
function mCred() {
    const f=APP.filters, hasFilter = f.instituicao || f.segmento!=='todos';

    if (hasFilter) {
        // Quarterly trend of filtered credit and assets
        const tris=getTris(), ind=APP.data.indicadores?.trimestres;
        const credData=tris.map(t=>{
            let items = (ind[t]?.agregado||[]).filter(i=>i.ativo_total>0);
            if(f.segmento!=='todos') items=items.filter(i=>i.segmento===f.segmento);
            if(f.instituicao) items=items.filter(i=>i.nome===f.instituicao);
            return {credito:items.reduce((s,i)=>s+(i.carteira_credito||0),0), ativo:items.reduce((s,i)=>s+i.ativo_total,0)};
        });
        // Loan book
        triLineChart('c-cred-filt', tris, [{label:'Loan Book',data:credData.map(d=>d.credito),borderColor:'#5eead4',backgroundColor:'rgba(94,234,212,.1)',fill:true,tension:.3,pointRadius:4,_fmt:v=>FMT.brl(v)}]);
        // Assets vs credit
        triLineChart('c-ativo-cred', tris, [{label:'Total Assets',data:credData.map(d=>d.ativo),borderColor:'#58a6ff',tension:.3,pointRadius:4,_fmt:v=>FMT.brl(v)},{label:'Loan Book',data:credData.map(d=>d.credito),borderColor:'#5eead4',tension:.3,pointRadius:4}]);
    } else {
        // National SGS charts (no filter)
        const s=APP.data.credito?.series; if(!s) return;
        const pf=s.credito_pf?.monthly?.slice(-24)||[], pj=s.credito_pj?.monthly?.slice(-24)||[];
        if(pf.length) lineTS('c-pfpj', [{label:'PF',raw:pf,color:'#58a6ff',fmt:v=>(v/1e6).toFixed(1)+'T'},{label:'PJ',raw:pj,color:'#d29922'}]);
        const i=s.inadimplencia?.monthly?.slice(-24)||[], ipf=s.inadimplencia_pf?.monthly?.slice(-24)||[], ipj=s.inadimplencia_pj?.monthly?.slice(-24)||[];
        if(i.length) lineTS('c-inad', [{label:'Total',raw:i,color:'#f85149',width:2,fmt:v=>v.toFixed(2)+'%'},{label:'PF',raw:ipf,color:'#58a6ff',dash:[5,3]},{label:'PJ',raw:ipj,color:'#d29922',dash:[5,3]}]);
    }
    // Spread always visible (national)
    const s2=APP.data.credito?.series;
    if(s2) {
        const sp=s2.spread_total?.monthly?.slice(-24)||[], spf=s2.spread_pf?.monthly?.slice(-24)||[];
        if(sp.length) lineTS('c-spread', [{label:'Total',raw:sp,color:'#5eead4',fmt:v=>v.toFixed(1)+' p.p.'},{label:'PF',raw:spf,color:'#bc8cff'}]);
    }
}

/* ─── Rates ────────────────────────────── */
function mTaxas() {
    const tx=APP.data.taxas?.modalidades; if(!tx) return;
    const mods=Object.entries(tx).filter(([,v])=>!v.erro&&v.media_geral);
    const ctx=document.getElementById('c-taxas');
    if(ctx) APP.charts.h=new Chart(ctx, hbar(mods.map(([,v])=>v.descricao), mods.map(([,v])=>v.media_geral), mods.map((_,i)=>PAL[i%PAL.length]), v=>v.toFixed(1)+'%'));
}

/* ─── Concentration ────────────────────── */
function mConc() {
    const conc=APP.data.concentracao?.trimestres; if(!conc) return;
    const tri=activeTri(), last=conc[tri]; if(!last) return;
    const top10=last.ranking_ativo.slice(0,10), outros=100-top10.reduce((s,i)=>s+i.share,0);
    const c1=document.getElementById('c-share');
    if(c1) APP.charts.i=new Chart(c1,{type:'doughnut',data:{labels:[...top10.map(i=>i.nome),'Others'],datasets:[{data:[...top10.map(i=>i.share),outros],backgroundColor:[...PAL.slice(0,10),'#3b4654'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:css('--text-secondary'),font:{size:10},boxWidth:10,padding:6}},datalabels:{color:'#fff',font:{size:9,weight:700},formatter:v=>v>3?v.toFixed(1)+'%':''}}}});
    const ss=last.share_por_segmento, segs=Object.entries(ss).sort((a,b)=>b[1]-a[1]);
    const c2=document.getElementById('c-share-seg');
    if(c2) APP.charts.j=new Chart(c2,{type:'doughnut',data:{labels:segs.map(([s])=>SEG_LABELS[s]||s),datasets:[{data:segs.map(([,v])=>v),backgroundColor:segs.map(([s])=>segC(s)),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:css('--text-secondary'),font:{size:11},boxWidth:10,padding:6}},datalabels:{color:'#fff',font:{size:11,weight:700},formatter:v=>v>3?v.toFixed(1)+'%':''}}}});
    const tris=Object.keys(conc).sort(), id='c-hhi', c3=document.getElementById(id);
    if(c3) {
        const tLabels=tris.map(t=>t.slice(0,4)+'-'+t.slice(4)+'-01');
        setHAxis(id,{color:css('--text-secondary'),lineColor:css('--border')+'60',levels:[{key:d=>`${d.getFullYear()}-${d.getMonth()}`,label:d=>FMT.tri(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`)},AXIS_YEAR]});
        APP.charts.k=new Chart(c3,{type:'line',data:{labels:tLabels,datasets:[{label:'HHI',data:tris.map(t=>conc[t].hhi_ativo),borderColor:'#5eead4',tension:.3,pointRadius:3,yAxisID:'y'},{label:'Top 5 %',data:tris.map(t=>conc[t].top5_share_ativo),borderColor:'#58a6ff',tension:.3,pointRadius:3,yAxisID:'y1'}]},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:{display:false}},scales:{x:{display:false},y:{position:'left',ticks:{color:css('--text-muted')},grid:{color:css('--border')+'30'},border:{display:false}},y1:{position:'right',ticks:{color:css('--text-muted')},grid:{display:false},border:{display:false}}},layout:{padding:{bottom:50}}}});
    }
}

/* ─── Comparison ───────────────────────── */
function mComp() {
    const ind=APP.data.indicadores?.trimestres; if(!ind) return;
    const tris=getTris(), f=APP.filters;
    let ds;
    if (f.instituicao) {
        // Institution vs segment average
        const inst0 = getAg(activeTri()).find(i=>i.nome===f.instituicao);
        const seg = inst0?.segmento || 'outro';
        ds = [
            {label:f.instituicao, data:tris.map(t=>{const inst=(ind[t]?.agregado||[]).find(i=>i.nome===f.instituicao);return inst?.roe??null;}), borderColor:'#5eead4', backgroundColor:'transparent', tension:.3, pointRadius:4},
            {label:'Average '+SEG_LABELS[seg], data:tris.map(t=>{const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===seg&&i.roe!=null);return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null;}), borderColor:segC(seg), backgroundColor:'transparent', tension:.3, pointRadius:3, borderDash:[5,3]},
        ];
    } else {
        ds = Object.keys(SEG_LABELS).map(seg=>({label:SEG_LABELS[seg], data:tris.map(t=>{const a=(ind[t]?.agregado||[]).filter(i=>i.segmento===seg&&i.roe!=null);return a.length?+(a.reduce((s,i)=>s+i.roe,0)/a.length).toFixed(2):null;}), borderColor:segC(seg), backgroundColor:'transparent', tension:.3, pointRadius:3}));
    }
    const id='c-comp-roe', c1=document.getElementById(id);
    if(c1) {
        const tLabels=tris.map(t=>t.slice(0,4)+'-'+t.slice(4)+'-01');
        setHAxis(id,{color:css('--text-secondary'),lineColor:css('--border')+'60',levels:[{key:d=>`${d.getFullYear()}-${d.getMonth()}`,label:d=>FMT.tri(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`)},AXIS_YEAR]});
        APP.charts.l=new Chart(c1,{type:'line',data:{labels:tLabels,datasets:ds},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:dlabelLine(v=>v?.toFixed(1)+'%',3)},scales:{x:{display:false},y:{display:false}},layout:{padding:{bottom:50}}}});
    }
    const tx=APP.data.taxas?.modalidades; if(!tx) return;
    const mc=Object.entries(tx).filter(([,v])=>!v.erro&&v.media_geral).slice(0,5);
    const ml=mc.map(([,v])=>v.descricao?.slice(0,18)||'');
    const segs=Object.keys(SEG_LABELS);
    const tds=segs.map(seg=>({label:SEG_LABELS[seg],data:mc.map(([k])=>tx[k]?.media_por_segmento?.[seg]||null),backgroundColor:segC(seg),borderRadius:6}));
    const c2=document.getElementById('c-comp-tx');
    if(c2) APP.charts.m=new Chart(c2,{type:'bar',data:{labels:ml,datasets:tds},options:{...defs(false),plugins:{...defs(false).plugins,datalabels:dlabel(v=>v?v.toFixed(1)+'%':'')},scales:{x:{ticks:{color:css('--text-muted'),font:{size:9}},grid:{display:false},border:{display:false}},y:{display:false}}}});
}

/* ─── Geography ────────────────────────── */
function mGeo() {
    const e=APP.data.estban; if(!e?.por_uf) return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>renderMapaD3(e.por_uf)));
    renderGeoTable();
}

/* ─── D3 Map ──────────────────────────── */
const GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
let _geoCache = null;
const UF_NOMES = {AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',MT:'Mato Grosso',PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'};

function renderMapaD3(porUf) {
    const container = document.getElementById('mapa-container');
    if (!container) return;
    if (typeof d3 === 'undefined') { container.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:60px">D3 unavailable</div>'; return; }
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px"><div class="spinner" style="margin:0 auto 12px"></div>Loading map...</div>';

    // Build data lookup
    const data = {}; porUf.forEach(u => data[u.uf] = u);
    const totalCred = porUf.reduce((s,u)=>s+(u.carteira_credito||0),0);
    const maxV = Math.max(...porUf.map(u=>u.credito_per_capita));
    const logMax = Math.log(maxV + 1);
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const colorLow = isDark ? '#1a2a3a' : '#f0faf8';
    const colorHigh = '#5eead4';
    const colorNone = isDark ? '#1a2233' : '#e8e8e8';
    const strokeColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
    const ufColor = uf => { const v=data[uf]?.credito_per_capita; return v==null?colorNone:d3.interpolateRgb(colorLow, colorHigh)(Math.log(v+1)/logMax); };

    const draw = geo => {
        container.innerHTML = '';
        let w = container.clientWidth || container.parentElement?.clientWidth || 600;
        w = Math.min(w, 800);
        if (w < 100) w = 600;
        const h = Math.round(Math.min(w * 1.05, 540));
        const svg = d3.select(container).append('svg')
            .attr('viewBox', `0 0 ${w} ${h}`)
            .style('width', '100%').style('max-height', '540px').style('display', 'block').style('margin', '0 auto');
        const proj = d3.geoMercator().fitSize([w * 0.95, h * 0.95], geo);
        const path = d3.geoPath().projection(proj);

        // States — no permanent labels
        svg.selectAll('path').data(geo.features).join('path')
            .attr('d', path).attr('fill', d=>ufColor(d.properties.sigla))
            .attr('stroke', strokeColor).attr('stroke-width', .3)
            .style('cursor','pointer').style('transition','all .15s');

        // Rich tooltip
        const ttip = d3.select(container).append('div').attr('class','map-tooltip').style('display','none');
        svg.selectAll('path')
            .on('mouseenter', function(ev,d) {
                d3.select(this).attr('stroke','#5eead4').attr('stroke-width',2).style('filter','brightness(1.2)');
                const uf = d.properties.sigla, u = data[uf];
                if (!u) return;
                const pct = totalCred > 0 ? (u.carteira_credito/totalCred*100) : 0;
                ttip.style('display','block').html(
                    `<div><span class="mtt-uf">${uf}</span><span class="mtt-nome">${UF_NOMES[uf]||uf}</span></div>`+
                    `<div class="mtt-row"><span>Loan book</span><strong>${FMT.brl(u.carteira_credito)}</strong></div>`+
                    `<div class="mtt-row"><span>% of financial system total</span><strong>${pct.toFixed(1)}%</strong></div>`+
                    `<div class="mtt-row"><span>Per capita</span><strong>R$ ${u.credito_per_capita.toLocaleString('en-GB',{maximumFractionDigits:0})} mil</strong></div>`
                );
            })
            .on('mousemove', function(ev) {
                const r=container.getBoundingClientRect();
                const x=ev.clientX-r.left, y=ev.clientY-r.top;
                ttip.style('left', Math.min(x+16, w-220)+'px').style('top', Math.max(y-80, 8)+'px');
            })
            .on('mouseleave', function() {
                d3.select(this).attr('stroke',strokeColor).attr('stroke-width',.6).style('filter','none');
                ttip.style('display','none');
            });

        // Gradient legend
        d3.select(container).append('div').attr('class','map-scale')
            .html('<span>Less credit</span><div class="map-scale-bar"></div><span>More credit</span>');
    };

    if (_geoCache) { draw(_geoCache); return; }
    fetch(GEOJSON_URL).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(geo=>{ _geoCache=geo; draw(geo); })
        .catch(err=>{ console.warn('GeoJSON:',err); container.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:40px">Map unavailable</div>'; });
}

/* ─── Complaints ───────────────────────── */
function mRec() {
    const r=APP.data.reclamacoes; if(!r) return;
    const rk=[...r.ranking].sort((a,b)=>b.indice-a.indice);
    const SEG_NAMES = {S1:'Large Private',S2:'Mid-sized',S1_publico:'Public',digital:'Digital',cooperativa:'Co-ops'};
    const c1=document.getElementById('c-rec');
    if(c1) APP.charts.o=new Chart(c1, hbar(rk.map(r=>r.instituicao), rk.map(r=>r.indice), rk.map((_,i)=>PAL[i%PAL.length]), v=>v.toFixed(1)));
    // Chart by type
    const tipos = r.por_tipo;
    const c3=document.getElementById('c-rec-tipo');
    if(c3&&tipos?.length) APP.charts.q=new Chart(c3,{type:'doughnut',data:{labels:tipos.map(t=>t.tipo),datasets:[{data:tipos.map(t=>t.percentual),backgroundColor:PAL.slice(0,tipos.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:css('--text-secondary'),font:{size:10},boxWidth:10,padding:6}},datalabels:{color:'#fff',font:{size:9,weight:700},formatter:v=>v>5?v.toFixed(1)+'%':''}}}});
    // Average by segment
    const sd=Object.entries(r.media_por_segmento).sort((a,b)=>b[1]-a[1]);
    const c2=document.getElementById('c-rec-seg');
    if(c2) APP.charts.p=new Chart(c2,{type:'bar',data:{labels:sd.map(([s])=>SEG_NAMES[s]||SEG_LABELS[s]||s),datasets:[{data:sd.map(([,v])=>v),backgroundColor:sd.map((_,i)=>PAL[i%PAL.length]),borderRadius:6}]},options:{...defs(),plugins:{...defs().plugins,legend:{display:false},datalabels:dlabel(v=>v.toFixed(1))},scales:{x:{display:true,ticks:{color:css('--text-primary'),font:{size:9}},grid:{display:false},border:{display:false}},y:{display:false}}}});
}

/* ═══════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════ */

function bindEvents() {
    document.getElementById('themeToggle')?.addEventListener('click', ()=>{
        const h=document.documentElement, isDark=h.getAttribute('data-theme')!=='light';
        h.setAttribute('data-theme',isDark?'light':'dark'); localStorage.setItem('theme',isDark?'light':'dark');
        document.getElementById('themeToggle').textContent=isDark?'☾':'☀'; mountCharts();
    });
    document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
    document.querySelectorAll('.view-btn').forEach(b=>b.addEventListener('click',()=>{
        APP.filters.segmento=b.dataset.view;APP.filters.instituicao='';APP.sort={col:null,dir:'desc'};render();
    }));
    document.getElementById('fTri')?.addEventListener('change',e=>{APP.filters.trimestre=e.target.value;APP.sort={col:null,dir:'desc'};render();});
    document.getElementById('fSeg')?.addEventListener('change',e=>{APP.filters.segmento=e.target.value;APP.filters.instituicao='';APP.sort={col:null,dir:'desc'};render();});
    document.getElementById('fInst')?.addEventListener('change',e=>{APP.filters.instituicao=e.target.value;APP.sort={col:null,dir:'desc'};render();});
    // Tooltip overflow fix
    document.querySelectorAll('.info-tip').forEach(tip=>{
        tip.addEventListener('mouseenter',()=>{
            const box=tip.querySelector('.info-box'); if(!box) return;
            box.classList.remove('below');
            requestAnimationFrame(()=>{
                const rect=box.getBoundingClientRect();
                if(rect.top<0) box.classList.add('below');
                // Also fix horizontal overflow
                if(rect.left<8) { box.style.left='0'; box.style.transform='none'; }
                if(rect.right>window.innerWidth-8) { box.style.left='auto'; box.style.right='0'; box.style.transform='none'; }
            });
        });
        tip.addEventListener('mouseleave',()=>{
            const box=tip.querySelector('.info-box'); if(!box) return;
            box.classList.remove('below'); box.style.left=''; box.style.right=''; box.style.transform='';
        });
    });
    // Sortable table headers
    document.querySelectorAll('th.sortable').forEach(th=>{
        th.addEventListener('click',()=>{
            const col=th.dataset.sort;
            if(APP.sort.col===col) APP.sort.dir=APP.sort.dir==='desc'?'asc':'desc';
            else { APP.sort.col=col; APP.sort.dir='desc'; }
            render();
        });
    });
}

function showSection(id) {
    APP.activeSection=id;
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    const sec = document.getElementById(`sec-${id}`);
    if (sec) {
        sec.innerHTML = SECTION_FN[id]?.() ?? ''; // Always re-render with current filters
        sec.classList.add('active');
    }
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===id));
    mountCharts();
}

/* ─── Boot ─────────────────────────────── */
Chart.register(ChartDataLabels);
Chart.register(hierarchicalAxisPlugin);
(function(){ const s=localStorage.getItem('theme'); if(s) document.documentElement.setAttribute('data-theme',s); })();
init();
