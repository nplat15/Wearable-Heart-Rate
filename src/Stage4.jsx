import { useState } from 'react';
import { runExperiment } from './sampling.js';

const INITIAL_SEED = 20261105;
const GROUP_COLUMN = 'activity_state';
const METHOD_NAMES = {
  srs: 'Simple random',
  systematic: 'Systematic',
  stratified: 'Stratified',
};
const METHOD_COLORS = {
  srs: '#d6a34f',
  systematic: '#536eaa',
  stratified: '#b86e4d',
};

function formatBpm(value) {
  return `${value.toFixed(5)} bpm`;
}

export function getDomain(results, truth) {
  const estimates = results.flatMap((result) => result.estimates);
  const lower = Math.min(truth, ...estimates);
  const upper = Math.max(truth, ...estimates);
  const padding = Math.max((upper - lower) * 0.035, 0.5);
  return { min: lower - padding, max: upper + padding };
}

function Histogram({ result, truth, domain }) {
  const width = 360;
  const height = 222;
  const margin = { top: 26, right: 15, bottom: 48, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const binCount = 18;
  const bins = Array.from({ length: binCount }, (_, index) => ({ index, count: 0 }));
  const range = domain.max - domain.min || 1;
  for (const value of result.estimates) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(((value - domain.min) / range) * binCount)));
    bins[index].count += 1;
  }
  const shares = bins.map((bin) => (bin.count / result.estimates.length) * 100);
  const maxShare = Math.max(...shares, 1);
  const x = (value) => margin.left + ((value - domain.min) / range) * plotWidth;
  const y = (share) => margin.top + plotHeight - (share / maxShare) * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) => domain.min + (range * index) / 4);
  const yTicks = [0, maxShare / 2, maxShare];
  const trueMeanX = x(truth);

  return (
    <svg className="estimate-histogram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${METHOD_NAMES[result.method]} estimate distribution, ${result.estimates.length} estimates. True population mean ${formatBpm(truth)}.`}>
      {yTicks.map((tick, index) => <g key={index}>
        <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="hist-grid" />
        <text x={margin.left - 7} y={y(tick) + 4} textAnchor="end" className="hist-axis-text">{tick.toFixed(0)}%</text>
      </g>)}
      {bins.map((bin) => {
        const barWidth = plotWidth / binCount;
        const left = margin.left + bin.index * barWidth;
        return <rect
          key={bin.index}
          x={left + 1}
          y={y(shares[bin.index])}
          width={Math.max(0, barWidth - 2)}
          height={Math.max(0, margin.top + plotHeight - y(shares[bin.index]))}
          className="hist-bar"
          style={{ fill: METHOD_COLORS[result.method] }}
        ><title>{shares[bin.index].toFixed(1)}% of estimates in this bpm interval</title></rect>;
      })}
      <line x1={trueMeanX} x2={trueMeanX} y1={margin.top} y2={margin.top + plotHeight} className="hist-mean-halo" />
      <line x1={trueMeanX} x2={trueMeanX} y1={margin.top} y2={margin.top + plotHeight} className="hist-mean-line" />
      <text x={Math.min(width - margin.right, Math.max(margin.left, trueMeanX))} y={margin.top - 8} textAnchor="middle" className="hist-mean-label">TRUE MEAN</text>
      {ticks.map((tick, index) => <g key={index}>
        <line x1={x(tick)} x2={x(tick)} y1={margin.top + plotHeight} y2={margin.top + plotHeight + 5} className="hist-axis-line" />
        <text x={x(tick)} y={height - 24} textAnchor="middle" className="hist-axis-text">{tick.toFixed(0)}</text>
      </g>)}
      <line x1={margin.left} x2={width - margin.right} y1={margin.top + plotHeight} y2={margin.top + plotHeight} className="hist-axis-line" />
      <text x={width / 2} y={height - 5} textAnchor="middle" className="hist-axis-title">Estimate (bpm)</text>
      <text x={14} y={height / 2} transform={`rotate(-90 14 ${height / 2})`} textAnchor="middle" className="hist-axis-title">Share of estimates</text>
    </svg>
  );
}

function resultSettings(result, conditionLabel) {
  if (result.method === 'systematic') {
    const orderDescription = conditionLabel === 'MODIFIED'
      ? 'activity_state-grouped row order'
      : 'chronological row_id order';
    return result.design === 'whole'
      ? `Whole-number interval k = ${result.interval}; all ${result.starts.toLocaleString()} starts enumerated; ${orderDescription}.`
      : `Fractional interval k = ${result.interval.toFixed(5)}; ${orderDescription}.`;
  }
  if (result.method === 'stratified') {
    const allocation = result.allocation.map((stratum) => `${stratum.name}: ${stratum.sampleSize}`).join(' · ');
    return `Group: ${result.groupColumn}; proportional largest-remainder allocation · ${allocation}.`;
  }
  return 'Simple random sampling without replacement; estimate is the sample mean.';
}

export function HistogramCard({ result, truth, domain, conditionLabel = 'BASELINE' }) {
  const resultType = result.type === 'exact' ? 'Exact' : 'Monte Carlo';
  const countLabel = result.type === 'exact'
    ? `${result.starts.toLocaleString()} starts`
    : `${result.repetitions.toLocaleString()} repetitions · seed ${result.seed}`;

  return (
    <article className="experiment-result-card">
      <div className="experiment-card-heading">
        <div><p className="eyebrow">{conditionLabel} · n = {result.n}</p><h4>{METHOD_NAMES[result.method]}</h4></div>
        <span className={`result-type ${result.type === 'exact' ? 'exact-type' : 'mc-type'}`}>{resultType}</span>
      </div>
      <p className="experiment-settings">{countLabel}</p>
      <p className="experiment-settings">{resultSettings(result, conditionLabel)}</p>
      <Histogram result={result} truth={truth} domain={domain} />
      <div className="histogram-legend"><span><i className="histogram-fill" style={{ backgroundColor: METHOD_COLORS[result.method] }} /> Estimate distribution</span><span><i className="histogram-mean-key" /> True mean · {formatBpm(truth)}</span></div>
      <dl className="metric-list">
        <div><dt>Bias</dt><dd>{formatBpm(result.bias)}</dd></div>
        <div><dt>SD</dt><dd>{formatBpm(result.sd)}</dd></div>
        <div><dt>RMSE</dt><dd>{formatBpm(result.rmse)}</dd></div>
      </dl>
      <p className="metric-explanation">SD describes spread; RMSE combines bias and variability.</p>
    </article>
  );
}

function ExperimentResults({ experiment, truth, title }) {
  if (!experiment) {
    return <div className="experiment-empty"><p>Run this experiment to create its estimate distributions and summaries. It will use the settings shown above.</p></div>;
  }
  const domain = getDomain(experiment.results, truth);
  return (
    <>
      <div className="experiment-run-meta" role="status">
        <strong>{title} · Baseline population</strong>
        <span>{experiment.repetitions.toLocaleString()} repetitions per Monte Carlo result · seed {experiment.seed}</span>
      </div>
      <div className="experiment-grid">
        {experiment.results.map((result) => <HistogramCard key={`${result.method}-${result.n}`} result={result} truth={truth} domain={domain} />)}
      </div>
      {experiment.reusedSrs100 && <p className="reuse-note">The matching SRS result at n = 100 was reused from Experiment A.</p>}
    </>
  );
}

function readExperimentSettings(repetitionsText, seedText) {
  const repetitions = Number(repetitionsText);
  const seed = Number(seedText);
  if (!Number.isInteger(repetitions) || repetitions < 100 || repetitions > 1000) {
    throw new Error('Choose a whole-number repetition count from 100 to 1,000.');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4_294_967_295) {
    throw new Error('Choose a whole-number seed from 0 to 4,294,967,295.');
  }
  return { repetitions, seed };
}

export default function Stage4({ population, truth }) {
  const [repetitionsText, setRepetitionsText] = useState('100');
  const [seedText, setSeedText] = useState(String(INITIAL_SEED));
  const [experimentA, setExperimentA] = useState(null);
  const [experimentB, setExperimentB] = useState(null);
  const [error, setError] = useState('');

  function runA(event) {
    event.preventDefault();
    try {
      const { repetitions, seed } = readExperimentSettings(repetitionsText, seedText);
      const results = ['srs', 'systematic', 'stratified'].map((method) => runExperiment(population, {
        method,
        n: 100,
        repetitions,
        seed,
        groupColumn: GROUP_COLUMN,
      }));
      setExperimentA({ results, repetitions, seed });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Experiment A could not be run.');
    }
  }

  function runB(event) {
    event.preventDefault();
    try {
      const { repetitions, seed } = readExperimentSettings(repetitionsText, seedText);
      const matchingSrs100 = experimentA?.seed === seed && experimentA?.repetitions === repetitions
        ? experimentA.results.find((result) => result.method === 'srs' && result.n === 100)
        : undefined;
      const results = [1, 10].map((n) => runExperiment(population, {
        method: 'srs', n, repetitions, seed,
      }));
      const srs100 = matchingSrs100 ?? runExperiment(population, {
        method: 'srs', n: 100, repetitions, seed,
      });
      results.push(srs100);
      setExperimentB({ results, repetitions, seed, reusedSrs100: Boolean(matchingSrs100) });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Experiment B could not be run.');
    }
  }

  return (
    <section className="stage4-section" aria-labelledby="stage4-heading">
      <div className="stage4-heading">
        <p className="eyebrow">STAGE 4 · BASELINE INVESTIGATIONS</p>
        <h2 id="stage4-heading">Compare methods and sample sizes</h2>
        <p>Each histogram shows the distribution of estimates across repetitions. The dashed reference marks the true population mean; the cards report bias, SD, and RMSE in bpm.</p>
      </div>

      <section className="panel experiment-controls" aria-labelledby="experiment-controls-heading">
        <div className="section-heading"><div><p className="eyebrow">SHARED SIMULATION SETTINGS</p><h3 id="experiment-controls-heading">Set repetitions and seed</h3></div><span className="chart-count">Sample size n is set by each experiment</span></div>
        <div className="experiment-settings-fields">
          <div className="field-group"><label htmlFor="repetitions-input">Repetitions per Monte Carlo result</label><input id="repetitions-input" type="number" min="100" max="1000" step="1" value={repetitionsText} onChange={(event) => setRepetitionsText(event.target.value)} /></div>
          <div className="field-group"><label htmlFor="experiment-seed-input">Random seed</label><input id="experiment-seed-input" type="number" min="0" max="4294967295" step="1" value={seedText} onChange={(event) => setSeedText(event.target.value)} /></div>
        </div>
        <p className="repetition-guidance">One repetition draws one separate sample of n rows. One hundred repetitions often reveal the main pattern; 1,000 usually give smoother distributions and more stable summaries. Neither guarantees stability, and 100 may not separate small differences. Rerun with other seeds to see how stable your conclusions are.</p>
        {error && <p className="validation-message" role="alert">{error}</p>}
      </section>

      <section className="panel experiment-section" aria-labelledby="experiment-a-heading">
        <div className="section-heading experiment-section-heading"><div><p className="eyebrow">EXPERIMENT A</p><h3 id="experiment-a-heading">Methods at n = 100</h3><p>Compare the three methods on the same baseline population and total sample size.</p></div><button className="apply-button" type="button" onClick={runA}>Run Experiment A</button></div>
        <ExperimentResults experiment={experimentA} truth={truth} title="Experiment A" />
      </section>

      <section className="panel experiment-section" aria-labelledby="experiment-b-heading">
        <div className="section-heading experiment-section-heading"><div><p className="eyebrow">EXPERIMENT B</p><h3 id="experiment-b-heading">Simple random sample sizes</h3><p>Compare SRS estimates at n = 1, 10, and 100 while keeping the population and method fixed.</p></div><button className="apply-button" type="button" onClick={runB}>Run Experiment B</button></div>
        <ExperimentResults experiment={experimentB} truth={truth} title="Experiment B" />
      </section>

      <p className="stage4-footer">Both experiments use the baseline population only. Rerunning an experiment replaces its current results; results with different settings are never pooled.</p>
    </section>
  );
}
