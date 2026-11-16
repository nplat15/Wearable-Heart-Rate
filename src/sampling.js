export function mean(rows, targetColumn = 'heart_rate_bpm') {
  if (!rows.length) throw new Error('A mean needs at least one row.');
  return rows.reduce((total, row) => total + Number(row[targetColumn]), 0) / rows.length;
}

export function groupPopulationByColumn(population, groupColumn) {
  if (!groupColumn) throw new Error('A group column is required to reorder the population.');
  const groupOrder = [...new Set(population.map((row) => String(row[groupColumn])))];
  const rank = new Map(groupOrder.map((name, index) => [name, index]));
  return population
    .map((row, originalPosition) => ({ row, originalPosition }))
    .sort((a, b) => rank.get(String(a.row[groupColumn])) - rank.get(String(b.row[groupColumn]))
      || a.originalPosition - b.originalPosition)
    .map(({ row }) => row);
}

export function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function validateSize(population, n) {
  if (!Number.isInteger(n) || n < 1 || n > population.length) {
    throw new RangeError(`Sample size must be an integer from 1 to ${population.length}.`);
  }
}

export function simpleRandomSample(population, n, random) {
  validateSize(population, n);
  const indices = population.map((_, index) => index);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(random() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).map((index) => population[index]);
}

export function systematicSampleDetails(population, n, random) {
  validateSize(population, n);
  const size = population.length;
  const interval = size / n;
  const indices = [];

  if (Number.isInteger(interval)) {
    const startIndex = Math.floor(random() * interval);
    for (let j = 0; j < n; j += 1) indices.push(startIndex + j * interval);
    return {
      sample: indices.map((index) => population[index]),
      design: 'whole',
      interval,
      start: startIndex + 1,
      selectedRowIds: indices.map((index) => population[index].row_id),
    };
  }

  // N/n is at least one; this transform gives a uniform start in (0, interval].
  const start = interval - random() * interval;
  for (let j = 0; j < n; j += 1) {
    const rowIndex = Math.max(0, Math.min(size - 1, Math.ceil(start + j * interval) - 1));
    indices.push(rowIndex);
  }
  if (new Set(indices).size !== n) throw new Error('Systematic sampling did not produce n distinct rows.');
  return {
    sample: indices.map((index) => population[index]),
    design: 'fractional',
    interval,
    start,
    selectedRowIds: indices.map((index) => population[index].row_id),
  };
}

export function systematicSample(population, n, random) {
  return systematicSampleDetails(population, n, random).sample;
}

function proportionalAllocation(strata, n, total) {
  if (n < strata.length) {
    throw new RangeError(`Sample size ${n} is smaller than the ${strata.length} strata.`);
  }
  const allocations = strata.map((stratum) => {
    const quota = (n * stratum.rows.length) / total;
    return {
      ...stratum,
      quota,
      allocation: Math.min(stratum.rows.length, Math.max(1, Math.floor(quota))),
    };
  });
  const remainderOrder = [...allocations].sort((a, b) => {
    const remainderA = a.quota - Math.floor(a.quota);
    const remainderB = b.quota - Math.floor(b.quota);
    return remainderB - remainderA || String(a.name).localeCompare(String(b.name));
  });
  let remaining = n - allocations.reduce((sum, stratum) => sum + stratum.allocation, 0);

  while (remaining > 0) {
    let moved = false;
    for (const stratum of remainderOrder) {
      if (stratum.allocation < stratum.rows.length) {
        stratum.allocation += 1;
        remaining -= 1;
        moved = true;
        if (remaining === 0) break;
      }
    }
    if (!moved) throw new Error('Could not allocate the requested sample size.');
  }

  while (remaining < 0) {
    const removable = allocations
      .filter((stratum) => stratum.allocation > 1)
      .sort((a, b) => (b.allocation - b.quota) - (a.allocation - a.quota));
    if (!removable.length) throw new Error('Could not adjust the stratum allocation.');
    removable[0].allocation -= 1;
    remaining += 1;
  }
  return allocations;
}

export function stratifiedSample(population, n, groupColumn, random) {
  validateSize(population, n);
  const groups = new Map();
  for (const row of population) {
    const name = String(row[groupColumn]);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  }
  const strata = [...groups].map(([name, rows]) => ({ name, rows }));
  const allocations = proportionalAllocation(strata, n, population.length);
  const sample = [];
  for (const stratum of allocations) {
    sample.push(...simpleRandomSample(stratum.rows, stratum.allocation, random));
  }
  return {
    sample,
    allocation: allocations.map(({ name, rows, allocation }) => ({
      name,
      populationSize: rows.length,
      sampleSize: allocation,
    })),
  };
}

export function proportionalAllocationForPopulation(population, n, groupColumn) {
  validateSize(population, n);
  if (!groupColumn) throw new Error('A group column is required for a stratified allocation.');
  const groups = new Map();
  for (const row of population) {
    const name = String(row[groupColumn]);
    groups.set(name, (groups.get(name) ?? 0) + 1);
  }
  const strata = [...groups].map(([name, count]) => ({ name, rows: Array(count) }));
  return proportionalAllocation(strata, n, population.length).map(({ name, rows, allocation }) => ({
    name,
    populationSize: rows.length,
    sampleSize: allocation,
  }));
}

export function stratifiedBreakdown(population, sample, groupColumn) {
  const populationCounts = new Map();
  const sampledGroups = new Map();
  for (const row of population) {
    const name = String(row[groupColumn]);
    populationCounts.set(name, (populationCounts.get(name) ?? 0) + 1);
  }
  for (const row of sample) {
    const name = String(row[groupColumn]);
    if (!sampledGroups.has(name)) sampledGroups.set(name, []);
    sampledGroups.get(name).push(row);
  }
  return [...populationCounts].map(([name, populationSize]) => {
    const sampledRows = sampledGroups.get(name);
    if (!sampledRows?.length) throw new Error(`Stratum "${name}" has no sampled rows.`);
    const populationWeight = populationSize / population.length;
    const sampleMean = mean(sampledRows);
    return {
      name,
      populationSize,
      sampleSize: sampledRows.length,
      populationWeight,
      sampleMean,
      weightedContribution: populationWeight * sampleMean,
    };
  });
}

export function estimate(population, sample, method = 'srs', groupColumn) {
  if (method !== 'stratified') return mean(sample);
  if (!groupColumn) throw new Error('A group column is required for a stratified estimate.');
  return stratifiedBreakdown(population, sample, groupColumn)
    .reduce((sum, stratum) => sum + stratum.weightedContribution, 0);
}

export function drawSample(population, { method = 'srs', n, seed = 1, groupColumn }) {
  const random = seededRandom(seed);
  let sample;
  let details = {};
  if (method === 'systematic') {
    const systematic = systematicSampleDetails(population, n, random);
    sample = systematic.sample;
    details = {
      design: systematic.design,
      interval: systematic.interval,
      start: systematic.start,
      selectedRowIds: systematic.selectedRowIds,
    };
  } else if (method === 'stratified') {
    if (!groupColumn) throw new Error('A group column is required for stratified sampling.');
    const stratified = stratifiedSample(population, n, groupColumn, random);
    sample = stratified.sample;
    details = { allocation: stratified.allocation };
  } else {
    sample = simpleRandomSample(population, n, random);
  }
  const breakdown = method === 'stratified'
    ? stratifiedBreakdown(population, sample, groupColumn)
    : [];
  return {
    sample,
    method,
    n,
    seed,
    groupColumn: method === 'stratified' ? groupColumn : undefined,
    estimate: estimate(population, sample, method, groupColumn),
    ...details,
    breakdown,
  };
}

export function repeatedSamplingSummary(population, {
  method = 'srs', n, repetitions = 100, seed = 1, groupColumn,
}) {
  const random = seededRandom(seed);
  const truth = mean(population);
  const estimates = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const result = method === 'systematic'
      ? systematicSample(population, n, random)
      : method === 'stratified'
        ? stratifiedSample(population, n, groupColumn, random).sample
        : simpleRandomSample(population, n, random);
    estimates.push(estimate(population, result, method, groupColumn));
  }
  const bias = mean(estimates.map((value) => ({ value })), 'value') - truth;
  const variance = estimates.reduce((sum, value) => sum + (value - truth - bias) ** 2, 0) / estimates.length;
  const rmse = Math.sqrt(estimates.reduce((sum, value) => sum + (value - truth) ** 2, 0) / estimates.length);
  return { truth, estimates, bias, sd: Math.sqrt(variance), rmse, type: 'Monte Carlo', repetitions, seed };
}

export function exactSystematicSummary(population, n) {
  validateSize(population, n);
  const interval = population.length / n;
  if (!Number.isInteger(interval)) throw new Error('Exact enumeration requires a whole-number interval.');
  const estimates = Array.from({ length: interval }, (_, start) =>
    mean(Array.from({ length: n }, (_, j) => population[start + j * interval])));
  const truth = mean(population);
  const bias = mean(estimates.map((value) => ({ value })), 'value') - truth;
  const variance = estimates.reduce((sum, value) => sum + (value - truth - bias) ** 2, 0) / estimates.length;
  const rmse = Math.sqrt(estimates.reduce((sum, value) => sum + (value - truth) ** 2, 0) / estimates.length);
  return { truth, estimates, bias, sd: Math.sqrt(variance), rmse, type: 'exact', starts: interval };
}

export function runExperiment(population, {
  method, n, repetitions = 100, seed = 1, groupColumn,
}) {
  if (!['srs', 'systematic', 'stratified'].includes(method)) {
    throw new Error(`Unknown sampling method: ${method}`);
  }
  validateSize(population, n);
  const interval = population.length / n;
  const isExactSystematic = method === 'systematic' && Number.isInteger(interval);
  const summary = isExactSystematic
    ? exactSystematicSummary(population, n)
    : repeatedSamplingSummary(population, { method, n, repetitions, seed, groupColumn });
  return {
    ...summary,
    method,
    n,
    ...(method === 'systematic' ? {
      design: isExactSystematic ? 'whole' : 'fractional',
      interval,
    } : {}),
    ...(method === 'stratified' ? {
      groupColumn,
      allocation: proportionalAllocationForPopulation(population, n, groupColumn),
    } : {}),
  };
}
