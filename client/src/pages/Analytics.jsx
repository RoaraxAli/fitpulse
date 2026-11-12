import React, { useEffect, useMemo, useState } from 'react';
import { useApi, useToast } from '../state';
import { downloadReport } from '../api';
import {
  Badge,
  Button,
  Card,
  CardHead,
  Chip,
  Empty,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  Stat,
  Tabs,
} from '../components/ui';
import { BarChart, Donut, Heatmap, LineChart } from '../components/charts';
import { Icon } from '../icons';
import {
  CATEGORY_META,
  MEAL_META,
  MEALS,
  addDays,
  fmtCompact,
  fmtDate,
  fmtDuration,
  fmtNumber,
  percent,
  todayISO,
} from '../utils';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
];

function rangeFrom(days) {
  return addDays(todayISO(), -(days - 1));
}

export function AnalyticsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [rangeDays, setRangeDays] = useState(30);
  const [exercise, setExercise] = useState('');

  const from = rangeFrom(rangeDays);
  const to = todayISO();

  const overview = useApi(`/analytics/overview?range=${rangeDays}`);
  const workouts = useApi(`/analytics/workouts?from=${from}&to=${to}`);
  const nutrition = useApi(`/analytics/nutrition?from=${from}&to=${to}`);
  const heatmap = useApi(`/analytics/heatmap?days=${Math.max(rangeDays, 120)}`);
  const exerciseApi = useApi(exercise ? `/analytics/exercise?name=${encodeURIComponent(exercise)}&from=${from}&to=${to}` : null);

  const topExercises = workouts.data?.topExercises || [];

  useEffect(() => {
    if (!exercise && topExercises.length) setExercise(topExercises[0].exerciseName);
  }, [topExercises, exercise]);

  const exportCsv = (path, label) => {
    downloadReport(path);
    toast(`${label} download started.`, 'info');
  };

  const cards = overview.data?.cards;
  const loading = overview.loading && !overview.data;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        subtitle="Patterns across training, nutrition and body composition."
        actions={
          <div className="quick-actions">
            <Select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))} aria-label="Date range">
              {RANGES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
            <Button
              variant="secondary"
              icon="download"
              onClick={() => exportCsv(`/reports/summary.pdf?from=${from}&to=${to}`, 'PDF report')}
            >
              PDF report
            </Button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'workouts', label: 'Training' },
          { value: 'nutrition', label: 'Nutrition' },
          { value: 'exercise', label: 'Exercise' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="page-stack">
          <div className="stats-grid">
            {[0, 1, 2, 3].map((key) => <Skeleton key={key} height={118} />)}
          </div>
          <Skeleton height={320} />
        </div>
      ) : (
        <>
          {tab === 'overview' && cards && (
            <>
              <div className="stats-grid">
                <Stat
                  label="Workouts"
                  value={fmtNumber(cards.workouts.value)}
                  icon="dumbbell"
                  change={cards.workouts.change}
                  sub={`${cards.workouts.previous} in the previous period`}
                />
                <Stat
                  label="Training time"
                  value={fmtDuration(cards.minutes.value)}
                  icon="clock"
                  change={cards.minutes.change}
                  sub={`${cards.activeDays.value} of ${cards.activeDays.of} days active`}
                />
                <Stat
                  label="Volume lifted"
                  value={`${fmtCompact(cards.volume.value)} kg`}
                  icon="chart"
                  change={cards.volume.change}
                  sub={`${fmtNumber(cards.calories.value)} kcal burned`}
                />
                <Stat
                  label="Avg calories / day"
                  value={fmtNumber(cards.avgCalories.value)}
                  icon="flame"
                  change={cards.avgCalories.change}
                  sub={`${cards.avgProtein.value} g protein average`}
                />
              </div>

              <div className="grid two">
                <Card>
                  <CardHead
                    title="Training volume"
                    subtitle="Volume lifted per day"
                    icon="chart"
                    actions={<Badge tone="accent">{fmtCompact(cards.volume.value)} kg</Badge>}
                  />
                  <LineChart
                    data={overview.data.workoutTrend.map((item) => ({ label: item.label, value: item.volume, date: item.date }))}
                    height={240}
                    color="var(--accent)"
                    unit=" kg"
                    emptyLabel="No training in this period"
                  />
                </Card>

                <Card>
                  <CardHead
                    title="Calories in vs goal"
                    subtitle="Daily intake"
                    icon="flame"
                    actions={<Badge tone="neutral">Goal {fmtNumber(overview.data.goals.calorieGoal)}</Badge>}
                  />
                  <LineChart
                    data={overview.data.nutritionTrend.map((item) => ({ label: item.label, value: item.calories, date: item.date }))}
                    height={240}
                    color="var(--orange)"
                    unit=" kcal"
                    goal={overview.data.goals.calorieGoal}
                    goalLabel="Goal"
                    emptyLabel="No nutrition logged in this period"
                  />
                </Card>
              </div>

              <Card>
                <CardHead title="Consistency heatmap" subtitle="Minutes trained per day" icon="calendar" />
                {heatmap.data ? (
                  <Heatmap items={heatmap.data.items} />
                ) : (
                  <Skeleton height={120} />
                )}
              </Card>
            </>
          )}

          {tab === 'workouts' && workouts.data && (
            <>
              <div className="stats-grid">
                <Stat label="Sessions" value={fmtNumber(workouts.data.totals.workouts)} icon="dumbbell" />
                <Stat label="Minutes" value={fmtNumber(workouts.data.totals.minutes)} icon="clock" sub={`avg ${workouts.data.totals.avgDuration} min/session`} />
                <Stat label="Volume" value={`${fmtCompact(workouts.data.totals.volume)} kg`} icon="chart" />
                <Stat label="Active days" value={workouts.data.totals.activeDays} icon="calendar" sub={`${fmtNumber(workouts.data.totals.calories)} kcal burned`} />
              </div>

              <div className="grid two">
                <Card>
                  <CardHead title="Weekly sessions" subtitle="Workouts per week" icon="chart" />
                  <BarChart
                    data={workouts.data.weeks.map((week) => ({ label: week.label, value: week.workouts, date: week.week }))}
                    height={220}
                    color="var(--accent)"
                    emptyLabel="No sessions in this period"
                  />
                </Card>
                <Card>
                  <CardHead title="Training by weekday" subtitle="When you show up most" icon="calendar" />
                  <BarChart
                    data={workouts.data.weekday.map((day) => ({ label: day.label, value: day.workouts }))}
                    height={220}
                    color="var(--teal)"
                    emptyLabel="Log workouts to see your rhythm"
                  />
                </Card>
              </div>

              <div className="grid two">
                <Card>
                  <CardHead title="Category split" subtitle="Sessions by discipline" icon="filter" />
                  {workouts.data.categories.length ? (
                    <Donut
                      segments={workouts.data.categories.map((category) => ({
                        label: CATEGORY_META[category.category]?.label || category.category,
                        value: category.workouts,
                        color: CATEGORY_META[category.category]?.color || 'var(--muted)',
                      }))}
                      centerLabel={workouts.data.totals.workouts}
                      centerSub="sessions"
                    />
                  ) : (
                    <Empty icon="dumbbell" title="No data" description="Log workouts to see the split." />
                  )}
                </Card>

                <Card>
                  <CardHead title="Top exercises" subtitle="Ranked by total volume" icon="dumbbell" />
                  {topExercises.length ? (
                    <div className="table-wrap">
                      <table className="table table-compact">
                        <thead><tr><th>Exercise</th><th>Sets</th><th>Volume</th><th>Best</th></tr></thead>
                        <tbody>
                          {topExercises.map((item) => (
                            <tr key={item.exerciseName}>
                              <td>{item.exerciseName}</td>
                              <td className="mono">{item.sets}</td>
                              <td className="mono">{fmtCompact(item.volume)} kg</td>
                              <td className="mono">{item.bestWeight ? `${item.bestWeight} kg` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty icon="dumbbell" title="No exercises recorded" description="Log a workout to build this list." />
                  )}
                </Card>
              </div>
            </>
          )}

          {tab === 'nutrition' && nutrition.data && (
            <>
              <div className="stats-grid">
                <Stat label="Avg calories" value={fmtNumber(nutrition.data.averages.avgCalories)} icon="flame" sub={`${nutrition.data.averages.daysLogged} days logged`} />
                <Stat label="Avg protein" value={`${nutrition.data.averages.avgProtein} g`} icon="utensils" />
                <Stat label="Days on target" value={`${nutrition.data.adherence.daysOnTarget}/${nutrition.data.adherence.daysLogged}`} icon="target" sub="within 10% of goal" />
                <Stat label="Total entries" value={fmtNumber(nutrition.data.days.reduce((sum, day) => sum + day.entries, 0))} icon="list" />
              </div>

              <div className="grid two">
                <Card>
                  <CardHead title="Macro split" subtitle="Share of calories from macros" icon="apple" />
                  <Donut
                    segments={[
                      { label: 'Protein', value: nutrition.data.macros.protein.calories, color: 'var(--teal)', unit: ' kcal' },
                      { label: 'Carbs', value: nutrition.data.macros.carbs.calories, color: 'var(--orange)', unit: ' kcal' },
                      { label: 'Fat', value: nutrition.data.macros.fat.calories, color: 'var(--violet)', unit: ' kcal' },
                    ]}
                    centerLabel={fmtCompact(nutrition.data.averages.totalCalories)}
                    centerSub="kcal total"
                  />
                </Card>
                <Card>
                  <CardHead title="Calories trend" subtitle="Daily intake against goal" icon="chart" />
                  <LineChart
                    data={nutrition.data.days.map((day) => ({ label: fmtDate(day.date), value: day.calories, date: day.date }))}
                    height={220}
                    color="var(--orange)"
                    unit=" kcal"
                    goal={nutrition.data.calorieGoal}
                    goalLabel="Goal"
                    emptyLabel="No meals logged in this period"
                  />
                </Card>
              </div>

              <div className="grid two">
                <Card>
                  <CardHead title="Meal breakdown" subtitle="Calories by meal" icon="utensils" />
                  <ul className="meal-breakdown-list">
                    {nutrition.data.meals.map((meal) => (
                      <li key={meal.meal}>
                        <span className="meal-mini-icon"><Icon name={MEAL_META[meal.meal]?.icon || 'utensils'} size={16} /></span>
                        <div className="meal-breakdown-copy">
                          <div className="macro-row-head">
                            <span>{MEAL_META[meal.meal]?.label || meal.meal}</span>
                            <span className="mono">{fmtNumber(meal.calories)} kcal</span>
                          </div>
                          <Progress
                            value={meal.calories}
                            max={Math.max(1, ...nutrition.data.meals.map((item) => item.calories))}
                            color="var(--orange)"
                          />
                          <small>P {meal.protein} · C {meal.carbs} · F {meal.fat}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card>
                  <CardHead title="Most logged foods" subtitle="Ranked by calories" icon="list" />
                  {nutrition.data.topFoods.length ? (
                    <div className="table-wrap">
                      <table className="table table-compact">
                        <thead><tr><th>Food</th><th>Servings</th><th>Calories</th></tr></thead>
                        <tbody>
                          {nutrition.data.topFoods.map((food) => (
                            <tr key={food.name}>
                              <td>{food.name}</td>
                              <td className="mono">{food.servings}</td>
                              <td className="mono">{fmtNumber(food.calories)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty icon="apple" title="No foods logged" description="Log meals to see your staples." />
                  )}
                </Card>
              </div>
            </>
          )}

          {tab === 'exercise' && (
            <Card>
              <CardHead
                title="Exercise progression"
                subtitle="Best set, volume and frequency for a single movement"
                icon="chart"
                actions={
                  <Select value={exercise} onChange={(event) => setExercise(event.target.value)} aria-label="Choose exercise">
                    {topExercises.length === 0 && <option value="">No exercises yet</option>}
                    {topExercises.map((item) => (
                      <option key={item.exerciseName} value={item.exerciseName}>{item.exerciseName}</option>
                    ))}
                  </Select>
                }
              />
              {!exercise ? (
                <Empty icon="dumbbell" title="Choose an exercise" description="Log some weighted work first, then pick an exercise to chart." />
              ) : exerciseApi.loading && !exerciseApi.data ? (
                <Skeleton height={260} />
              ) : (exerciseApi.data?.points || []).length < 2 ? (
                <Empty icon="chart" title="Not enough sessions" description="Log this exercise at least twice to see the trend." />
              ) : (
                <>
                  <div className="stats-grid">
                    <Stat label="Best set" value={`${exerciseApi.data.pr?.bestWeight ?? 0} kg`} icon="medal" sub={exerciseApi.data.pr ? `${exerciseApi.data.pr.bestReps} reps · ${fmtDate(exerciseApi.data.pr.date)}` : ''} />
                    <Stat label="Sessions" value={exerciseApi.data.points.length} icon="calendar" />
                    <Stat label="Total volume" value={`${fmtCompact(exerciseApi.data.points.reduce((sum, point) => sum + point.volume, 0))} kg`} icon="chart" />
                    <Stat label="Best volume" value={`${fmtCompact(Math.max(...exerciseApi.data.points.map((point) => point.volume)))} kg`} icon="flame" />
                  </div>
                  <LineChart
                    data={exerciseApi.data.points.map((point) => ({ label: point.label, value: point.bestWeight, date: point.date }))}
                    height={260}
                    color="var(--teal)"
                    unit=" kg"
                    decimals={1}
                  />
                  <div className="table-wrap scroll-y">
                    <table className="table table-compact">
                      <thead><tr><th>Date</th><th>Best set</th><th>Reps</th><th>Sets</th><th>Volume</th></tr></thead>
                      <tbody>
                        {[...exerciseApi.data.points].reverse().map((point) => (
                          <tr key={`${point.date}-${point.bestWeight}`}>
                            <td>{fmtDate(point.date, { year: 'numeric' })}</td>
                            <td className="mono">{point.bestWeight} kg</td>
                            <td className="mono">{point.bestReps}</td>
                            <td className="mono">{point.sets}</td>
                            <td className="mono">{fmtNumber(point.volume)} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHead title="Export your data" subtitle="Download a report you can keep or share" icon="download" />
        <div className="export-row">
          <Button variant="secondary" icon="download" onClick={() => exportCsv(`/reports/summary.pdf?from=${from}&to=${to}`, 'PDF report')}>
            Progress PDF
          </Button>
          <Button variant="ghost" icon="download" onClick={() => exportCsv(`/reports/workouts.csv?from=${from}&to=${to}`, 'Workouts CSV')}>
            Workouts CSV
          </Button>
          <Button variant="ghost" icon="download" onClick={() => exportCsv(`/reports/nutrition.csv?from=${from}&to=${to}`, 'Nutrition CSV')}>
            Nutrition CSV
          </Button>
          <Button variant="ghost" icon="download" onClick={() => exportCsv(`/reports/measurements.csv?from=${from}&to=${to}`, 'Measurements CSV')}>
            Measurements CSV
          </Button>
          <Button variant="ghost" icon="download" onClick={() => exportCsv('/reports/goals.csv', 'Goals CSV')}>
            Goals CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
