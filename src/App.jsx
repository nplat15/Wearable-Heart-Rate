import { useEffect, useMemo, useState } from 'react';
import { drawSample, mean } from './sampling.js';
import Stage4 from './Stage4.jsx';
import Stage5 from './Stage5.jsx';

const INITIAL_SEED = 20261105;
const GROUP_COLUMN = 'activity_state';
const METHOD_NAMES = {
  srs: 'Simple random sampling',
  systematic: 'Systematic sampling',
  stratified: 'Stratified sampling',
};

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.replace(/^\uFEFF/, '').split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [
      header,
      header === 'row_id' || header === 'n_readings' || header === 'heart_rate_bpm'
        ? Number(cells[index])
        : cells[index],
    ]));
  });
}

function formatBpm(value) {
  return `${value.toFixed(5)} bpm`;
}

function formatWeight(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function Timeline({ rows, selectedIds, truth, method, n }) {
  const width = 1100;
  const height = 430;
  const margin = { top: 22, right: 28, bottom: 62, left: 68 };
  const timestamps = rows.map((row) => Date.parse(`${row.timestamp.replace(' ', 'T')}:00Z`));
  const values = rows.map((row) => row.heart_rate_bpm);
  const minValue = Math.floor(Math.min(...values) / 10) * 10;
  const maxValue = Math.ceil(Math.max(...values) / 10) * 10;
  const xScale = (timestamp) => margin.left + ((timestamp - timestamps[0]) / (timestamps.at(-1) - timestamps[0])) * (width - margin.left - margin.right);
  const yScale = (value) => height - margin.bottom - ((value - minValue) / (maxValue - minValue)) * (height - margin.top - margin.bottom);
  const yTicks = Array.from({ length: (maxValue - minValue) / 20 + 1 }, (_, i) => minValue + i * 20);
  const tickIndices = Array.from({ length: 7 }, (_, i) => Math.round((rows.length - 1) * i / 6));
  const segments = [];
  let segment = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (i > 0 && timestamps[i] - timestamps[i - 1] > 60_000) {
      if (segment.length > 1) segments.push(segment);
      segment = [];
    }
    segment.push(rows[i]);
  }
  if (segment.length > 1) segments.push(segment);
  const meanY = yScale(truth);

  return (
    <div className="chart-wrap">
      <svg className="timeline" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-title chart-description">
        <title id="chart-title">Heart rate over the recorded week</title>
        <desc id="chart-description">All {rows.length.toLocaleString()} recorded minute values appear in chronological order. The current {METHOD_NAMES[method]} sample of {n} rows is highlighted. Line segments stop where a minute has no recorded reading.</desc>
        {yTicks.map((tick) => <g key={tick}>
          <line x1={margin.left} x2={width - margin.right} y1={yScale(tick)} y2={yScale(tick)} className="grid-line" />
          <text x={margin.left - 13} y={yScale(tick) + 4} textAnchor="end" className="axis-text">{tick}</text>
        </g>)}
        {segments.map((part, index) => <polyline
          key={index}
          points={part.map((row) => `${xScale(Date.parse(`${row.timestamp.replace(' ', 'T')}:00Z`))},${yScale(row.heart_rate_bpm)}`).join(' ')}
          className="population-line"
        />)}
        {rows.map((row) => <circle
          key={`population-${row.row_id}`}
          cx={xScale(Date.parse(`${row.timestamp.replace(' ', 'T')}:00Z`))}
          cy={yScale(row.heart_rate_bpm)}
          r={1.5}
          className="population-point"
        />)}
        <line x1={margin.left} x2={width - margin.right} y1={meanY} y2={meanY} className="mean-line-halo" />
        <line x1={margin.left} x2={width - margin.right} y1={meanY} y2={meanY} className="mean-line" />
        {rows.filter((row) => selectedIds.has(row.row_id)).map((row) => {
          const cx = xScale(Date.parse(`${row.timestamp.replace(' ', 'T')}:00Z`));
          const cy = yScale(row.heart_rate_bpm);
          return <g key={`sample-${row.row_id}`}>
            <circle cx={cx} cy={cy} r="7" className="sample-halo" />
            <circle cx={cx} cy={cy} r="4.2" className="sample-point">
              <title>{METHOD_NAMES[method]} · row {row.row_id}: {row.timestamp}, {row.heart_rate_bpm} bpm</title>
            </circle>
          </g>;
        })}
        {tickIndices.map((index) => <g key={index}>
          <line x1={xScale(timestamps[index])} x2={xScale(timestamps[index])} y1={height - margin.bottom} y2={height - margin.bottom + 6} className="axis-line" />
          <text x={xScale(timestamps[index])} y={height - margin.bottom + 25} textAnchor="middle" className="axis-text">{rows[index].timestamp.slice(5)}</text>
        </g>)}
        <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} className="axis-line" />
        <text x={(margin.left + width - margin.right) / 2} y={height - 9} textAnchor="middle" className="axis-title">Timestamp · device local time</text>
        <text x={19} y={height / 2} transform={`rotate(-90 19 ${height / 2})`} textAnchor="middle" className="axis-title">Heart rate (bpm)</text>
      </svg>
      <div className="chart-legend" aria-label="Chart legend">
        <span><i className="legend-population" /> All recorded minutes</span>
        <span><i className="legend-sample" /> Current sample · {METHOD_NAMES[method]} · {n} rows</span>
        <span><i className="legend-mean" /> True population mean</span>
      </div>
      <p className="chart-note">Each dot is one recorded minute. Line segments stop across missing readings; horizontal spacing follows timestamps.</p>
    </div>
  );
}

function RuleExplanation({ draw, populationSize }) {
  if (draw.method === 'systematic') {
    const rowOrder = 'File order is row_id order, which follows the timestamps chronologically.';
    if (draw.design === 'whole') {
      return <p><strong>Whole-number interval:</strong> N ÷ n = {draw.interval}. Start at row {draw.start}, then select every {draw.interval}th row in file order (exactly {draw.n} rows). {rowOrder}</p>;
    }
    return <p><strong>Fractional interval:</strong> k = N ÷ n = {draw.interval.toFixed(5)} and random start u = {draw.start.toFixed(5)}. Select row ceil(u + j·k), for j = 0 to n−1, with rounding guarded so all {draw.n} selected rows are valid. {rowOrder}</p>;
  }
  if (draw.method === 'stratified') {
    return <p><strong>Stratified rule:</strong> Divide the {populationSize.toLocaleString()} rows by <code>activity_state</code>, allocate the sample proportionally using largest-remainder rounding, and draw a simple random sample without replacement within each group. The estimate weights each group mean by that group’s share of the population.</p>;
  }
  return <p><strong>Simple random rule:</strong> Choose {draw.n} distinct rows without replacement from all {populationSize.toLocaleString()} rows, so every set of {draw.n} rows is equally likely. Estimate = the mean of the sampled heart rates.</p>;
}

function AllocationTable({ breakdown }) {
  return (
    <div className="table-scroll allocation-scroll">
      <table>
        <caption className="sr-only">Activity-state stratum sizes, sample allocations, sample means, population weights, and weighted contributions</caption>
        <thead><tr><th scope="col">Activity state</th><th scope="col">Population Nₕ</th><th scope="col">Allocation nₕ</th><th scope="col">Sample mean</th><th scope="col">Population weight</th><th scope="col">Weighted contribution</th></tr></thead>
        <tbody>{breakdown.map((stratum) => <tr key={stratum.name}>
          <th scope="row">{stratum.name}</th>
          <td>{stratum.populationSize.toLocaleString()}</td>
          <td>{stratum.sampleSize.toLocaleString()}</td>
          <td>{formatBpm(stratum.sampleMean)}</td>
          <td>{formatWeight(stratum.populationWeight)}</td>
          <td>{formatBpm(stratum.weightedContribution)}</td>
        </tr>)}</tbody>
      </table>
      <p className="formula-note">Stratified estimate = Σ (Nₕ / N) × sample meanₕ</p>
    </div>
  );
}

function SystematicDetails({ draw }) {
  return (
    <details className="systematic-details">
      <summary>View selected row IDs in file order</summary>
      <p>{draw.selectedRowIds.join(', ')}</p>
    </details>
  );
}

export default function App() {
  const [population, setPopulation] = useState(null);
  const [loadError, setLoadError] = useState('');
  const truth = useMemo(() => (population ? mean(population) : 0), [population]);
  const [activeStage, setActiveStage] = useState('sample');
  const [applied, setApplied] = useState({ method: 'srs', n: 100, seed: INITIAL_SEED });
  const [draft, setDraft] = useState({ method: 'srs', n: '100', seed: String(INITIAL_SEED) });
  const [draw, setDraw] = useState(null);
  const [error, setError] = useState('');
  const sampleIds = useMemo(() => new Set(draw?.sample.map((row) => row.row_id) ?? []), [draw]);
  const hasUnappliedChanges = draft.method !== applied.method || Number(draft.n) !== applied.n || Number(draft.seed) !== applied.seed;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}heart_rate_week.csv`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Dataset request failed (${response.status}).`);
        return response.text();
      })
      .then((csv) => {
        const rows = parseCsv(csv);
        setPopulation(rows);
        setDraw(drawSample(rows, { method: 'srs', n: 100, seed: INITIAL_SEED, groupColumn: GROUP_COLUMN }));
      })
      .catch((cause) => {
        if (cause.name !== 'AbortError') setLoadError(cause instanceof Error ? cause.message : 'The dataset could not be loaded.');
      });
    return () => controller.abort();
  }, []);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
  }

  function applySample(event) {
    event.preventDefault();
    const n = Number(draft.n);
    const seed = Number(draft.seed);
    if (!Number.isInteger(n) || n < 1 || n > population.length) {
      setError(`Choose a whole-number sample size from 1 to ${population.length.toLocaleString()}.`);
      return;
    }
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4_294_967_295) {
      setError('Choose a whole-number seed from 0 to 4,294,967,295.');
      return;
    }
    if (draft.method === 'stratified' && n < 3) {
      setError('There are three activity-state strata. Stratified sampling needs at least one row per stratum. Choose n of 3 or more, or select a different method. No settings were changed.');
      return;
    }
    try {
      const next = drawSample(population, { method: draft.method, n, seed, groupColumn: GROUP_COLUMN });
      setDraw(next);
      setApplied({ method: draft.method, n, seed });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The sample could not be drawn.');
    }
  }

  if (loadError) {
    return <main className="page-shell"><section className="panel data-load-state" role="alert"><p className="eyebrow">DATA FILE UNAVAILABLE</p><h1>The heart-rate data could not be loaded.</h1><p>Check that <code>heart_rate_week.csv</code> is available at this site’s base path, then reload the page.</p><p className="load-error-detail">{loadError}</p></section></main>;
  }
  if (!population || !draw) {
    return <main className="page-shell"><section className="panel data-load-state" role="status"><p className="eyebrow">WEARABLE HEART RATE · SAMPLING LAB</p><h1>Loading the recorded week…</h1><p>The app is fetching the CSV population from this site.</p></section></main>;
  }

  const methodName = METHOD_NAMES[applied.method];
  const estimateTitle = applied.method === 'stratified' ? 'POPULATION-WEIGHTED STRATIFIED ESTIMATE' : 'SAMPLE MEAN';

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">JS</div>
        <div><p className="eyebrow">WEARABLE HEART RATE · SAMPLING LAB</p><p className="brand-name">Judge the Sample</p></div>
        <span className="scenario-tag">Wearable heart rate</span>
      </header>

      <nav className="stage-nav" aria-label="Project stages">
        <button type="button" className={activeStage === 'sample' ? 'stage-nav-button active' : 'stage-nav-button'} aria-current={activeStage === 'sample' ? 'page' : undefined} onClick={() => setActiveStage('sample')}>Stage 3 <span>Sample</span></button>
        <button type="button" className={activeStage === 'experiments' ? 'stage-nav-button active' : 'stage-nav-button'} aria-current={activeStage === 'experiments' ? 'page' : undefined} onClick={() => setActiveStage('experiments')}>Stage 4 <span>Experiments</span></button>
        <button type="button" className={activeStage === 'challenge' ? 'stage-nav-button active' : 'stage-nav-button'} aria-current={activeStage === 'challenge' ? 'page' : undefined} onClick={() => setActiveStage('challenge')}>Stage 5 <span>Challenge</span></button>
      </nav>

      <div className="stage-view" hidden={activeStage !== 'sample'}>
      <section className="intro">
        <div>
          <p className="eyebrow">FINITE POPULATION</p>
          <h1>One wearer, one recorded week.</h1>
          <p className="intro-copy">Explore the <strong>{population.length.toLocaleString()} recorded minutes</strong> in this file. The timeline follows device local time; minutes without a reading are absent.</p>
        </div>
        <div className="population-pill"><span className="pill-dot" /> Baseline population <strong>{population.length.toLocaleString()} rows</strong></div>
      </section>

      <section className="panel controls-panel" aria-labelledby="sample-controls-heading">
        <div className="controls-copy"><p className="eyebrow">SHARED TIMELINE WORKSPACE</p><h2 id="sample-controls-heading">Choose a sampling method and settings</h2><p>Change the controls, then apply them together to update the selected rows and estimate.</p></div>
        <form className="sampling-form" onSubmit={applySample}>
          <div className="sampling-fields">
            <div className="field-group method-field"><label htmlFor="method-input">Sampling method</label><select id="method-input" value={draft.method} onChange={(event) => updateDraft('method', event.target.value)}>
              <option value="srs">Simple random</option><option value="systematic">Systematic</option><option value="stratified">Stratified</option>
            </select></div>
            <div className="field-group"><label htmlFor="sample-size-input">Sample size (n)</label><input id="sample-size-input" type="number" min="1" max={population.length} step="1" required value={draft.n} onChange={(event) => updateDraft('n', event.target.value)} /></div>
            <div className="field-group"><label htmlFor="seed-input">Random seed</label><input id="seed-input" type="number" min="0" max="4294967295" step="1" required value={draft.seed} onChange={(event) => updateDraft('seed', event.target.value)} /></div>
          </div>
          <div className="apply-row"><button type="submit" className="apply-button">Apply sample</button><span className="applied-settings">Displayed: {methodName} · n = {applied.n} · seed = {applied.seed}</span></div>
          {hasUnappliedChanges && <p className="pending-note" role="status">Settings changed. Apply sample to update the timeline and results.</p>}
          {error && <p className="validation-message" role="alert">{error}</p>}
        </form>
      </section>

      <section className="metric-grid" aria-label="Population and current sample estimate">
        <article className="metric-card population-metric"><div className="metric-heading"><span className="metric-icon">μ</span><span>TRUE POPULATION MEAN</span></div><strong className="metric-value">{formatBpm(truth)}</strong><p>All {population.length.toLocaleString()} recorded minutes</p></article>
        <article className="metric-card sample-metric"><div className="metric-heading"><span className="metric-icon">x̄</span><span>{estimateTitle}</span></div><strong className="metric-value">{formatBpm(draw.estimate)}</strong><p>{methodName} · all {applied.n.toLocaleString()} selected rows · {applied.seed === undefined ? 'exact' : `seed ${applied.seed}`}</p></article>
      </section>

      <section className="panel chart-panel" aria-labelledby="timeline-heading">
        <div className="section-heading"><div><p className="eyebrow">POPULATION TIMELINE</p><h2 id="timeline-heading">Every recorded minute, in time order</h2></div><div className="chart-meta"><span className="chart-mean-badge">True mean · {formatBpm(truth)}</span><span className="chart-count">{population.length.toLocaleString()} / {population.length.toLocaleString()} rows shown</span></div></div>
        <Timeline rows={population} selectedIds={sampleIds} truth={truth} method={applied.method} n={applied.n} />
      </section>

      <section className="panel rule-panel" aria-labelledby="rule-heading">
        <div className="section-heading"><div><p className="eyebrow">HOW THIS SAMPLE WAS SELECTED</p><h2 id="rule-heading">{methodName}</h2></div><span className="chart-count">{applied.n.toLocaleString()} rows · seed {applied.seed}</span></div>
        <RuleExplanation draw={draw} populationSize={population.length} />
        {applied.method === 'systematic' && <SystematicDetails draw={draw} />}
        {applied.method === 'stratified' && <AllocationTable breakdown={draw.breakdown} />}
      </section>

      <section className="panel sample-rows-panel" aria-labelledby="sample-rows-heading">
        <div className="section-heading"><div><p className="eyebrow">SAMPLE DETAIL</p><h2 id="sample-rows-heading">All selected sample rows</h2></div><span className="chart-count">Showing {draw.sample.length.toLocaleString()} of {population.length.toLocaleString()}</span></div>
        <p className="table-intro">These are the rows highlighted on the timeline. The estimate above uses this full sample.</p>
        <div className="table-scroll sample-table-scroll"><table><caption className="sr-only">All selected rows from the current sample</caption><thead><tr><th scope="col">Row ID</th><th scope="col">Timestamp (device local time)</th><th scope="col">Heart rate</th><th scope="col">Activity state*</th></tr></thead><tbody>{draw.sample.map((row) => <tr key={row.row_id}><td>{row.row_id}</td><td>{row.timestamp}</td><td>{row.heart_rate_bpm.toFixed(1)} bpm</td><td>{row.activity_state}</td></tr>)}</tbody></table></div>
        <p className="footnote">*Activity state is device-derived and included as context. The target column is heart_rate_bpm.</p>
      </section>

      <footer className="footer-note">Stage 3 · Results show the currently applied settings only; applying a new sample replaces the current view.</footer>
      </div>
      <div className="stage-view" hidden={activeStage !== 'experiments'}>
      <Stage4 population={population} truth={truth} />
      </div>
      <div className="stage-view" hidden={activeStage !== 'challenge'}>
      <Stage5 population={population} />
      </div>
    </main>
  );
}
