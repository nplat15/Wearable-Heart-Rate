# My decisions and evidence notes

Written by me, not by my AI agent. Write my challenge hypothesis (section 5) **before** consulting
my agent about it, and do not edit it afterwards; add a dated revision below instead.

| Stage | What I record here |
|---|---|
| 1 | Section 1 |
| 2–5 | Section 2: my design choice, written before I switch my agent to build |
| 4 | Section 3: method and sample-size rows; section 4: findings (a) and (b) |
| 5 | Section 5: hypothesis first; then section 3: challenge rows; section 5: finding (c) |
| All | Section 6: AI use |

## 1. Population and target

- Scenario and file: Wearable Heart Rate, data/heart_rate_week.csv
- One row means: Each row represents one minute with a recorded heart-rate reading for the error.
- Number of rows (N): 9864
- Row order, and what it means in this file: Rows are in chronoligcal timestamp order as each rows follows the previous recorded minute. Some minutes are missing readings so consecutive rows aren't always exactly one minute apart.
- Target column and units: heart_rate_bpm mesured in beats per minute (bpm)
- My finite population is (and what it is not): My finite population is the 9864 recorded minutes for one wearer from April 25 to May 1 2016. It doesn't include minutes with no recorded values or data from other people.
- True mean I calculated (and how): True mean I calculated was 66.41105 bpm using an excel sheet to find the average of all the bpm.

## 2. Design choices

For each stage: the option I chose, why, and what it is meant to help a user learn.

- Stage 2, visualization (include one visual feature meant to reveal a sampling problem): A visual feature that will be used to reveal is a timeline. I want it to show heart rate by timesamp, highlight the sampple, and show missing time gaps raer than connecting across them
- Stage 3, sampling interactions and stratification column: I chose the shared timeline workspace because I can keep the population's time order in view while changing the sampling method, sample size, or seed. Applying the settings together allows me to inspect which rows were selected and how the estimate updates. A scrollable list makes the selected rows easier to examine alongside the timeline. I chose activity_state because it's a recorded group column with understandable categories being sleep, rest, exercise. Showing the allocation and population-weighted estimate can help me understand how many rows are sampled from each group and how each group's share of the full population affects its contribution to the overall estimate.
- Stage 4, presentation of the method comparison and sample-size experiments: I chose small-multiple histograms because each method or sample size gets its own view of the estimates, so the distributions don't overlap. Using the shared bpm scale and marking the true mean makes the spreads easier to compare. Showing bias, SD, and RMSE beside each histogram will help connect the distribution to the estimation error.
- Stage 5, challenge controls and my alternative method or correction: I chose a preview that shows activity-state order before and after grouping the same recorded minutes. I'll use sahred controls for sample size, repetitions, and seed, then run systemaic sampling and SRS on both the baseline and reordered populations wih the same setings. The sample size starts at 100 and the repetition will also be at 100 counts with an option to increase to 1000. I chose it because the preview makes the row order change visible, and using the same settings makes the four results easier to compare. The histograms and their true mean, bias, SD, and RMSE will help with the examination. 

## 3. Results table

One row per result I read from my app. Add rows as needed. Rerun and update a row whenever I
like: my app does not need to keep a history of runs. Seed is "exact" for exact enumeration;
type is Monte Carlo or exact. In Settings I record the settings that matter for the result, such
as the stratification column and allocation, or my challenge-control values. True mean is the
true mean of the population that result was drawn from (the modified copy's own recalculated
value for modified rows). Keep each result in its own row: never pool estimates.

| Experiment | Population or condition | Method | Settings | Seed (or exact) | n | Repetitions or starts | Type | True mean | Bias | SD | RMSE |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Methods at n = 100 | baseline | Simple random |Simple random sampling without replacement; estimate is the sample mean. |20261105 | 100 |100 |Monte Carlo | 66.41105 bpm|0.17057 bpm |1.99156 bpm |1.99885 bpm |
| Methods at n = 100 | baseline | Systematic |Fractional interval k = 98.64000; chronological row_id order. |20261105 | 100 |100 |Monte Carlo | 66.41105 bpm |-0.03939 bpm |1.67290 bpm |1.67337 bpm |
| Methods at n = 100 | baseline | Stratified |Group: activity_state; proportional largest-remainder allocation · sleep: 30 · rest: 60 · exercise: 10. |20261105 | 100 |100 |Monte Carlo | 66.41105 bpm |-0.11538 bpm |0.89620 bpm |0.90360 bpm |
| Sample size | baseline | Simple random |Simple random sampling without replacement; estimate is the sample mean. |20261105 | 1 |100 |Monte Carlo |66.41105 bpm |-1.29105 bpm |18.35244 bpm|18.39779 bpm|
| Sample size | baseline | Simple random |Simple random sampling without replacement; estimate is the sample mean. |20261105 | 10 |100 | Monte Carlo |66.41105 bpm|0.21775 bpm|5.90311 bpm |5.90712 bpm |
| Challenge | baseline | Systematic |Fractional interval k = 98.64000; chronological row_id order. |20261105 |100 |100 |Monte Carlo |66.41105 bpm |-0.03939 bpm |1.67290 bpm |1.67337 bpm |
| Challenge | modified | Systematic |Fractional interval k = 98.64000; activity_state-grouped row order. |20261105 |100 |100 |Monte Carlo |66.41105 bpm |-0.11602 bpm |0.90560 bpm |0.91301 bpm |
| Challenge | baseline | Simple Random |Simple random sampling without replacement; estimate is the sample mean.|20261105 |100 |100 |Monte Carlo |66.41105 bpm |0.17057 bpm |1.99156 bpm |1.99885 bpm |
| Challenge | modified | Simple Random |Simple random sampling without replacement; estimate is the sample mean. |20261105 |100 |100 |Monte Carlo |66.41105 bpm |0.24049 bpm|1.72681 bpm |1.74348 bpm|

The simple random n = 100 row is also the n = 100 sample-size result when the population and
settings match. If I reran it with different settings, I add a separate row. All four challenge
rows use the same n; a challenge baseline row may repeat a matching stage 4 result.

## 4. Findings (in my own words, using my own numbers)

- (a) Method comparison: the three sampling methods compared at n = 100 (bias versus variability, and for which population): For the baseline population of recorded heart-rate minutes, systematic sampling had the smallest absolute bias at n = 100 being -0.03939 bpm. Stratified sampling had the lowest SD and RMSE (0.89620 bpm and 0.90360 bpm), Its estimates varied less and had the lowest overall error in the comparison. Simple random sampling had the largest SD and RMSE.
- (b) Sample-size finding: how sample size affects the spread of estimates and the estimation error, and what a larger sample cannot fix: In the SRS results, increasing n from 1 to 10 to 100 went with lowered SD. From 18.35244 to 5.90311 to 1.99156 bpm. It also lowered RMSE from 18.39779, 5.90712, and 1.99885 bpm. Larger samples reduce sampling variation in this run but it can't correct missing or innacurate heart-rate records or even make conclusions to minutes that weren't recorded.

## 5. Challenge (hypothesis written independently, before consulting my agent)

Hypothesis, written before I consult my agent: I will challenge systematic sampling by changing the order of the same recorded minutes so rows with the same activity_state are together. Population values and true mean values remain the same, but cahgnes the row order. Since systematic sampling selects rows at regular intervals and doesn't balance activity states, I predict its estimates may have a wider spread than SRS estimates no the reordered population while both methods remain centered near the true mean. The prediction will be contradicted if systematic sampling has a similar or smaller spread than the SRS.

- Date written: November 15, 2026
- Method I chose to challenge: Systematic Sampling 
- The change to the population or its ordering: Reordering the same recorded minutes so rows with the same activity_state are together. 
- Why the selection rule would interact with that change: Systematic sampling follows regualr intervals in row order; it doesn't specifically balance the activity states. 
- Evidence I expect across repeated samples: Comparing the spread of systematic and SRS estimates on the reordered population. Systematic estimates may have a wider spread, while both remain centered near the true mean.
- Alternative method or correction I will compare, and why: SRS on the reordered popuation because SRS doesn't select rows by folowing the file order. I will keep the sample size the same in both methods.
- Evidence that would contradict my hypothesis: Systematic estimates have a similar or smaller spread than SRS estimates. 

After I test it:

- Test settings (conditions, methods, alternative method or correction, n, seeds); results are in the table above: Baseline original time order and modified activity_state-grouped order; systematic and SRS; n = 100 for all results. Initial run: 100 repetitions, seed 20261105. Stability runs: 1,000 repetitions each, seeds 20261138, 20261166, and 2025632.
- (c) Challenge interpretation: did the evidence support my hypothesis? Bias versus variability, other explanations, what the alternative or correction showed, and any dated revision (keep the original above): The wider-spread part of my hypothesis was not supported in this run: systematic sampling’s SD on the modified population (0.90560 bpm) was lower than the modified SRS SD (1.72681 bpm). The prediction that both methods’ estimates would be near their true mean was supported; their biases were -0.11602 bpm and 0.24049 bpm. Compared with baseline systematic sampling, the modified result had a lower SD and RMSE but a larger absolute bias. Overall, my hypothesis was partly supported: the estimates remained near the true mean, but systematic sampling did not have the wider spread I predicted. These results came from 100 repetitions with seed 20261105, so they describe this run. The stability checks gave the same comparison across all three 1,000-repetition runs (seeds 20261138, 20261166, and 2025632): systematic sampling on the modified population had a smaller SD than SRS, so the wider-spread prediction remained unsupported across these runs.

## 6. AI use

- Tools used: Codex
- What I asked my agent to do, and what I checked myself: Asked the agent to help design the websie and the expirements. I checked he results.
- Automated checks my agent reported (I did not let it interpret my results): The agent reported that the production build completed successfully. This confirms the app compiled; it does not verify or interpret my sampling results.
