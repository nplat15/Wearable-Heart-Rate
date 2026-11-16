import { useEffect, useMemo, useRef, useState } from 'react';
import { groupPopulationByColumn, mean, runExperiment } from './sampling.js';
import { getDomain, HistogramCard } from './Stage4.jsx';

const GROUP_COLUMN = 'activity_state';
const INITIAL_SEED = 20261105;
const ACTIVITY_COLORS = {
  sleep: '#7187b5',
  rest: '#4a9e8e',
  exercise: '#c77c54',
};

function activityColor(name) {
  return ACTIVITY_COLORS[name] ?? '#8b8f86';
}

function OrderStrip({ rows, label }) {
  const canvasRef = useRef(null);
  const states = useMemo(() => [...new Set(rows.map((row) => String(row[GROUP_COLUMN])))], [rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rows.length === 0) return;
    canvas.width = rows.length;
    canvas.height = 20;
    const context = canvas.getContext('2d');
    rows.forEach((row, index) => {
      context.fillStyle = activityColor(String(row[GROUP_COLUMN]));
      context.fillRect(index, 0, 1, canvas.height);
    });
  }, [rows]);

  const stateSummary = states.join(', ');
  return (
    <div className="order-strip-block">
      <div className="order-strip-heading"><strong>{label}</strong><span>{rows.length.toLocaleString()} row positions</span></div>
      <canvas
        ref={canvasRef}
        className="order-strip-canvas"
        role="img"
        aria-label={`${label}: all ${rows.length.toLocaleString()} row positions, colored by activity state. States present: ${stateSummary}.`}
      />
      <div className="order-strip-axis"><span>Sampling position 1</span><span>{rows.length.toLocaleString()}</span></div>
    </div>
  );
}

function readSettings(nText, repetitionsText, seedText, populationSize) {
  const n = Number(nText);
  const repetitions = Number(repetitionsText);
  const seed = Number(seedText);
  if (!Number.isInteger(n) || n < 1 || n > populationSize) {
    throw new Error(`Choose a whole-number sample size from 1 to ${populationSize.toLocaleString()}.`);
  }
  if (!Number.isInteger(repetitions) || repetitions < 100 || repetitions > 1000) {
    throw new Error('Choose a whole-number repetition count from 100 to 1,000.');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4_294_967_295) {
    throw new Error('Choose a whole-number seed from 0 to 4,294,967,295.');
  }
  return { n, repetitions, seed };
}

export default function Stage5({ population }) {
  const modifiedPopulation = useMemo(
    () => groupPopulationByColumn(population, GROUP_COLUMN),
    [population],
  );
  const groupOrder = useMemo(
    () => [...new Set(population.map((row) => String(row[GROUP_COLUMN])))],
    [population],
  );
  const [nText, setNText] = useState('100');
  const [repetitionsText, setRepetitionsText] = useState('100');
  const [seedText, setSeedText] = useState(String(INITIAL_SEED));
  const [challengeRun, setChallengeRun] = useState(null);
  const [error, setError] = useState('');

  function runChallenge() {
    try {
      const settings = readSettings(nText, repetitionsText, seedText, population.length);
      const resultRows = [
        { condition: 'Baseline', summary: runExperiment(population, { method: 'systematic', ...settings }) },
        { condition: 'Baseline', summary: runExperiment(population, { method: 'srs', ...settings }) },
        { condition: 'Modified', summary: runExperiment(modifiedPopulation, { method: 'systematic', ...settings }) },
        { condition: 'Modified', summary: runExperiment(modifiedPopulation, { method: 'srs', ...settings }) },
      ];
      setChallengeRun({ ...settings, results: resultRows });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The challenge comparison could not be run.');
    }
  }

  const baselineTruth = challengeRun?.results[0].summary.truth;
  const domain = challengeRun
    ? getDomain(challengeRun.results.map((item) => item.summary), baselineTruth)
    : null;
  const states = groupOrder.map((name) => ({
    name,
    count: population.reduce((total, row) => total + (String(row[GROUP_COLUMN]) === name ? 1 : 0), 0),
  }));

  return (
    <section className="stage4-section stage5-section" aria-labelledby="stage5-heading">
      <div className="stage4-heading">
        <p className="eyebrow">STAGE 5 · CHALLENGE INVESTIGATION</p>
        <h2 id="stage5-heading">Does systematic sampling respond to row order?</h2>
        <p>Compare systematic sampling with SRS on the original population and a copy grouped by activity state. The copy contains the same records and heart-rate values; only their order changes.</p>
      </div>

      <section className="panel challenge-preview" aria-labelledby="challenge-preview-heading">
        <div className="section-heading"><div><p className="eyebrow">ORDER PREVIEW</p><h3 id="challenge-preview-heading">The full row order, before and after grouping</h3></div><span className="chart-count">{population.length.toLocaleString()} records in each order</span></div>
        <div className="activity-legend" aria-label="Activity-state legend">
          {groupOrder.map((name) => <span key={name}><i style={{ backgroundColor: activityColor(name) }} />{name}</span>)}
        </div>
        <div className="order-strips">
          <OrderStrip rows={population} label="Baseline: original time order" />
          <OrderStrip rows={modifiedPopulation} label={`Modified: grouped by ${groupOrder.join(' → ')}`} />
        </div>
        <p className="challenge-note">Each colored position represents one row in sampling order. In the modified copy, timestamps remain attached to their original row IDs, and chronological order is preserved within each activity-state group. Only the population copy is reordered.</p>
        <p className="challenge-note">Systematic sampling follows the displayed row order. SRS selects rows without using that order. The population’s true mean is recalculated for each condition.</p>
        <div className="challenge-group-counts" aria-label="Activity-state row counts">
          {states.map(({ name, count }) => <span key={name}>{name}: {count.toLocaleString()} rows</span>)}
        </div>
      </section>

      <section className="panel challenge-controls" aria-labelledby="challenge-controls-heading">
        <div className="section-heading"><div><p className="eyebrow">SHARED CHALLENGE SETTINGS</p><h3 id="challenge-controls-heading">Use the same settings for all four results</h3></div><span className="chart-count">Baseline and modified populations</span></div>
        <div className="challenge-settings-fields">
          <div className="field-group"><label htmlFor="challenge-n-input">Sample size (n)</label><input id="challenge-n-input" type="number" min="1" max={population.length} step="1" value={nText} onChange={(event) => setNText(event.target.value)} /></div>
          <div className="field-group"><label htmlFor="challenge-repetitions-input">Repetitions per Monte Carlo result</label><input id="challenge-repetitions-input" type="number" min="100" max="1000" step="1" value={repetitionsText} onChange={(event) => setRepetitionsText(event.target.value)} /></div>
          <div className="field-group"><label htmlFor="challenge-seed-input">Random seed</label><input id="challenge-seed-input" type="number" min="0" max="4294967295" step="1" value={seedText} onChange={(event) => setSeedText(event.target.value)} /></div>
        </div>
        <p className="repetition-guidance">Each Monte Carlo repetition draws a new sample. One hundred repetitions usually reveal the main pattern; 1,000 usually give smoother distributions and more stable summaries. Neither guarantees stability.</p>
        <div className="challenge-run-row"><button className="apply-button" type="button" onClick={runChallenge}>Run all four comparisons</button><span>Systematic and SRS · baseline and modified · same n</span></div>
        {error && <p className="validation-message" role="alert">{error}</p>}
      </section>

      <section className="panel experiment-section challenge-results" aria-labelledby="challenge-results-heading">
        <div className="section-heading"><div><p className="eyebrow">CHALLENGE RESULTS</p><h3 id="challenge-results-heading">Compare estimate distributions</h3><p>Each result is measured against the true mean of its own population.</p></div></div>
        {!challengeRun
          ? <div className="experiment-empty"><p>Review the order preview and settings, then run the comparisons. No results are generated until you click the button.</p></div>
          : <>
            <div className="experiment-run-meta" role="status">
              <strong>{population.length.toLocaleString()} row positions · n = {challengeRun.n}</strong>
              <span>{challengeRun.repetitions.toLocaleString()} repetitions for Monte Carlo results · seed {challengeRun.seed}</span>
            </div>
            <div className="experiment-grid challenge-result-grid">
              {challengeRun.results.map(({ condition, summary }) => <HistogramCard
                key={`${condition}-${summary.method}`}
                result={summary}
                truth={summary.truth}
                domain={domain}
                conditionLabel={condition.toUpperCase()}
              />)}
            </div>
          </>}
      </section>
      <p className="stage4-footer">Running the challenge replaces the previous challenge results. The four conditions are kept separate and are never pooled.</p>
    </section>
  );
}
