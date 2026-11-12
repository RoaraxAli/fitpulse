import React, { useEffect, useMemo, useState } from 'react';
import { useApi, useAuth, useToast } from '../state';
import { navigate } from '../router';
import {
  Badge,
  Button,
  Card,
  CardHead,
  Chip,
  Empty,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui';
import { LineChart } from '../components/charts';
import { Icon } from '../icons';
import { api } from '../api';
import {
  GOAL_TYPES,
  cmToDisplay,
  fmtDate,
  fmtNumber,
  kgToDisplay,
  lengthUnit,
  todayISO,
  weightUnit,
} from '../utils';

const MEASUREMENT_FIELDS = [
  { key: 'weightKg', label: 'Weight', kind: 'weight' },
  { key: 'bodyFatPct', label: 'Body fat %', unit: '%' },
  { key: 'waistCm', label: 'Waist', kind: 'length' },
  { key: 'chestCm', label: 'Chest', kind: 'length' },
  { key: 'hipsCm', label: 'Hips', kind: 'length' },
  { key: 'armsCm', label: 'Arms', kind: 'length' },
  { key: 'thighsCm', label: 'Thighs', kind: 'length' },
];

const CHART_METRICS = [
  { key: 'weightKg', label: 'Weight', kind: 'weight' },
  { key: 'bodyFatPct', label: 'Body fat', unit: '%' },
  { key: 'waistCm', label: 'Waist', kind: 'length' },
  { key: 'chestCm', label: 'Chest', kind: 'length' },
  { key: 'armsCm', label: 'Arms', kind: 'length' },
  { key: 'thighsCm', label: 'Thighs', kind: 'length' },
];

function MeasureModal({ open, onClose, onSaved }) {
  const { toast } = useToast();
  const { unitSystem } = useAuth();
  const [form, setForm] = useState({ measuredOn: todayISO(), weightKg: '', bodyFatPct: '', waistCm: '', chestCm: '', hipsCm: '', armsCm: '', thighsCm: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ measuredOn: todayISO(), weightKg: '', bodyFatPct: '', waistCm: '', chestCm: '', hipsCm: '', armsCm: '', thighsCm: '', notes: '' });
    }
  }, [open]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { measuredOn: form.measuredOn, notes: form.notes };
      if (form.weightKg !== '') payload.weightKg = unitSystem === 'imperial' ? Number(form.weightKg) / 2.20462 : Number(form.weightKg);
      ['bodyFatPct', 'waistCm', 'chestCm', 'hipsCm', 'armsCm', 'thighsCm'].forEach((key) => {
        if (form[key] === '') return;
        payload[key] = ['waistCm', 'chestCm', 'hipsCm', 'armsCm', 'thighsCm'].includes(key) && unitSystem === 'imperial'
          ? Number(form[key]) * 2.54
          : Number(form[key]);
      });
      await api.post('/measurements', payload);
      toast('Measurement saved.');
      onSaved();
      onClose();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add measurement"
      subtitle={`Saved per date — logging again updates that day. Units: ${unitSystem === 'imperial' ? 'lb / in' : 'kg / cm'}.`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="measure-form" loading={saving}>Save measurement</Button>
        </>
      }
    >
      <form id="measure-form" onSubmit={submit} className="form-stack">
        <div className="form-grid two">
          <Field label="Date" htmlFor="measure-date">
            <Input id="measure-date" type="date" value={form.measuredOn} onChange={set('measuredOn')} />
          </Field>
          <Field label={`Weight (${weightUnit(unitSystem)})`} htmlFor="measure-weight">
            <Input id="measure-weight" type="number" step="0.1" value={form.weightKg} onChange={set('weightKg')} placeholder={unitSystem === 'imperial' ? '180' : '80'} />
          </Field>
        </div>
        <div className="form-grid three">
          <Field label="Body fat (%)" htmlFor="measure-fat">
            <Input id="measure-fat" type="number" step="0.1" value={form.bodyFatPct} onChange={set('bodyFatPct')} />
          </Field>
          {['waistCm', 'chestCm', 'hipsCm', 'armsCm', 'thighsCm'].map((key) => {
            const label = MEASUREMENT_FIELDS.find((field) => field.key === key)?.label;
            return (
              <Field key={key} label={`${label} (${lengthUnit(unitSystem)})`} htmlFor={`measure-${key}`}>
                <Input id={`measure-${key}`} type="number" step="0.1" value={form[key]} onChange={set(key)} />
              </Field>
            );
          })}
        </div>
        <Field label="Notes" htmlFor="measure-notes" optional>
          <Textarea id="measure-notes" rows={2} value={form.notes} onChange={set('notes')} placeholder="Morning, fasted…" />
        </Field>
      </form>
    </Modal>
  );
}

function GoalModal({ open, initial, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', type: 'custom', targetValue: '', currentValue: '', unit: '', deadline: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title,
        type: initial.type,
        targetValue: initial.targetValue,
        currentValue: initial.currentValue,
        unit: initial.unit || '',
        deadline: initial.deadline || '',
      });
    } else {
      setForm({ title: '', type: 'custom', targetValue: '', currentValue: '', unit: '', deadline: '' });
    }
  }, [open, initial]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        type: form.type,
        targetValue: Number(form.targetValue),
        currentValue: Number(form.currentValue) || 0,
        unit: form.unit,
        deadline: form.deadline || undefined,
      };
      if (initial) await api.patch(`/goals/${initial.id}`, payload);
      else await api.post('/goals', payload);
      toast(initial ? 'Goal updated.' : 'Goal created.');
      onSaved();
      onClose();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit goal' : 'New goal'}
      subtitle="Make it measurable. Progress is easier to keep when you can see it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="goal-form" loading={saving}>{initial ? 'Save' : 'Create goal'}</Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="form-stack">
        <Field label="Goal title" htmlFor="goal-title">
          <Input id="goal-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Bench press 100 kg" required />
        </Field>
        <div className="form-grid two">
          <Field label="Type" htmlFor="goal-type">
            <Select id="goal-type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              {GOAL_TYPES.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Unit" htmlFor="goal-unit" optional>
            <Input id="goal-unit" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="kg, sessions, min" />
          </Field>
        </div>
        <div className="form-grid three">
          <Field label="Current" htmlFor="goal-current">
            <Input id="goal-current" type="number" step="0.1" value={form.currentValue} onChange={(event) => setForm((current) => ({ ...current, currentValue: event.target.value }))} placeholder="0" />
          </Field>
          <Field label="Target" htmlFor="goal-target">
            <Input id="goal-target" type="number" step="0.1" min="0.1" value={form.targetValue} onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))} placeholder="100" required />
          </Field>
          <Field label="Deadline" htmlFor="goal-deadline" optional>
            <Input id="goal-deadline" type="date" value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} />
          </Field>
        </div>
        <p className="muted small">
          Workout goals advance automatically when you log sessions. Weight goals track against your latest measurement.
        </p>
      </form>
    </Modal>
  );
}

function MetricModal({ open, suggestions, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ metric: '', value: '', unit: '', recordedOn: todayISO(), notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ metric: '', value: '', unit: '', recordedOn: todayISO(), notes: '' });
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/metrics', { ...form, value: Number(form.value) });
      toast('Metric recorded.');
      onSaved();
      onClose();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record performance metric"
      subtitle="Run times, jumps, 1RM estimates — anything you want to trend."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="metric-form" loading={saving}>Save metric</Button>
        </>
      }
    >
      <form id="metric-form" onSubmit={submit} className="form-stack">
        <div className="form-grid two">
          <Field label="Metric name" htmlFor="metric-name">
            <Input id="metric-name" list="metric-suggestions" value={form.metric} onChange={(event) => setForm((current) => ({ ...current, metric: event.target.value }))} placeholder="5K Run" required />
            <datalist id="metric-suggestions">
              {suggestions.map((item) => <option key={item.name} value={item.name} />)}
            </datalist>
          </Field>
          <Field label="Unit" htmlFor="metric-unit" optional>
            <Input id="metric-unit" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="min, kg, cm" />
          </Field>
        </div>
        <div className="form-grid two">
          <Field label="Value" htmlFor="metric-value">
            <Input id="metric-value" type="number" step="0.01" value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} required />
          </Field>
          <Field label="Date" htmlFor="metric-date">
            <Input id="metric-date" type="date" value={form.recordedOn} onChange={(event) => setForm((current) => ({ ...current, recordedOn: event.target.value }))} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="metric-notes" optional>
          <Input id="metric-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
      </form>
    </Modal>
  );
}

export function ProgressPage({ route }) {
  const { unitSystem } = useAuth();
  const { toast } = useToast();
  const [range, setRange] = useState(180);
  const [chartMetric, setChartMetric] = useState('weightKg');
  const [measureOpen, setMeasureOpen] = useState(false);
  const [goalModal, setGoalModal] = useState({ open: false, initial: null });
  const [metricOpen, setMetricOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('');

  const from = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - range);
    return date.toISOString().slice(0, 10);
  }, [range]);

  const progress = useApi(`/progress?from=${from}&to=${todayISO()}`);
  const metricTypes = useApi('/metrics/types');
  const metricsApi = useApi(selectedMetric ? `/metrics?metric=${encodeURIComponent(selectedMetric)}` : null);

  useEffect(() => {
    const action = route.query.get('action');
    if (action === 'measure') setMeasureOpen(true);
    if (action === 'goal') setGoalModal({ open: true, initial: null });
  }, [route.hash]);

  useEffect(() => {
    const first = metricTypes.data?.items?.[0]?.name;
    if (!selectedMetric && first) setSelectedMetric(first);
  }, [metricTypes.data, selectedMetric]);

  const refresh = () => {
    progress.reload(true);
    metricTypes.reload(true);
    metricsApi.reload(true);
  };

  const data = progress.data;
  const measurements = data?.measurements || [];
  const goals = data?.goals || [];
  const achievements = data?.achievements || [];
  const prs = data?.prs || [];
  const latest = data?.latest;
  const weightUnitLabel = weightUnit(unitSystem);
  const lengthUnitLabel = lengthUnit(unitSystem);

  const metricDef = CHART_METRICS.find((item) => item.key === chartMetric);
  const chartData = measurements
    .filter((item) => item[chartMetric] !== null && item[chartMetric] !== undefined)
    .map((item) => {
      let value = item[chartMetric];
      if (metricDef?.kind === 'weight') value = kgToDisplay(value, unitSystem);
      else if (metricDef?.kind === 'length') value = cmToDisplay(value, unitSystem);
      return { label: fmtDate(item.measuredOn), date: item.measuredOn, value };
    });
  const chartUnit = metricDef?.unit || (metricDef?.kind === 'weight' ? weightUnitLabel : metricDef?.kind === 'length' ? lengthUnitLabel : '');

  const latestWeight = kgToDisplay(latest?.weightKg ?? null, unitSystem);
  const latestFat = latest?.bodyFatPct ?? null;
  const latestWaist = cmToDisplay(latest?.waistCm ?? null, unitSystem);
  const change = data?.weightChange === null || data?.weightChange === undefined ? null : kgToDisplay(data.weightChange, unitSystem);

  const deleteMeasurement = async (measurement) => {
    if (!window.confirm(`Delete the measurement from ${fmtDate(measurement.measuredOn)}?`)) return;
    try {
      await api.del(`/measurements/${measurement.id}`);
      toast('Measurement deleted.');
      refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const updateGoal = async (goal, status) => {
    try {
      await api.patch(`/goals/${goal.id}`, { status });
      toast(status === 'completed' ? 'Goal marked complete.' : 'Goal updated.');
      refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const deleteGoal = async (goal) => {
    if (!window.confirm(`Delete “${goal.title}”?`)) return;
    try {
      await api.del(`/goals/${goal.id}`);
      toast('Goal deleted.');
      refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const deleteMetric = async (metric) => {
    if (!window.confirm(`Delete ${metric.metric} entry from ${fmtDate(metric.recordedOn)}?`)) return;
    try {
      await api.del(`/metrics/${metric.id}`);
      toast('Metric entry deleted.');
      refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Body & performance"
        title="Progress"
        subtitle="Measure what matters and let the trend line do the talking."
        actions={
          <div className="quick-actions">
            <Button variant="secondary" icon="ruler" onClick={() => setMeasureOpen(true)}>Add measurement</Button>
            <Button icon="plus" onClick={() => setGoalModal({ open: true, initial: null })}>New goal</Button>
          </div>
        }
      />

      {progress.loading && !data ? (
        <><Skeleton height={120} /><Skeleton height={320} /></>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-top"><span className="stat-label">Weight</span><span className="stat-icon"><Icon name="scale" size={17} /></span></div>
              <div className="stat-value-row">
                <span className="stat-value">{latestWeight !== null ? `${latestWeight} ${weightUnitLabel}` : '—'}</span>
                {change !== null && (
                  <span className={`stat-change ${change <= 0 ? 'is-good' : 'is-neutral'}`}>
                    <Icon name={change <= 0 ? 'arrowDown' : 'arrowUp'} size={12} /> {Math.abs(change)} {weightUnitLabel}
                  </span>
                )}
              </div>
              <span className="stat-sub">{latest ? `Measured ${fmtDate(latest.measuredOn)}` : 'No measurements yet'}</span>
            </div>
            <div className="stat">
              <div className="stat-top"><span className="stat-label">Body fat</span><span className="stat-icon"><Icon name="chart" size={17} /></span></div>
              <div className="stat-value-row"><span className="stat-value">{latestFat !== null ? `${latestFat}%` : '—'}</span></div>
              <span className="stat-sub">{latestFat !== null ? 'Latest estimate' : 'Add a measurement'}</span>
            </div>
            <div className="stat">
              <div className="stat-top"><span className="stat-label">Waist</span><span className="stat-icon"><Icon name="ruler" size={17} /></span></div>
              <div className="stat-value-row"><span className="stat-value">{latestWaist !== null ? `${latestWaist} ${lengthUnitLabel}` : '—'}</span></div>
              <span className="stat-sub">Tracking the trend, not the day</span>
            </div>
            <div className="stat">
              <div className="stat-top"><span className="stat-label">Achievements</span><span className="stat-icon"><Icon name="trophy" size={17} /></span></div>
              <div className="stat-value-row"><span className="stat-value">{achievements.filter((item) => item.unlocked).length}<small> / {achievements.length}</small></span></div>
              <span className="stat-sub">Badges unlocked</span>
            </div>
          </div>

          <Card>
            <CardHead
              title="Body trend"
              subtitle="Change over time"
              icon="chart"
              actions={
                <div className="segmented segmented-sm">
                  {[90, 180, 365].map((days) => (
                    <button key={days} type="button" className={range === days ? 'is-active' : ''} onClick={() => setRange(days)}>
                      {days}d
                    </button>
                  ))}
                </div>
              }
            />
            <div className="filter-row">
              {CHART_METRICS.map((metric) => (
                <Chip key={metric.key} active={chartMetric === metric.key} onClick={() => setChartMetric(metric.key)}>
                  {metric.label}
                </Chip>
              ))}
            </div>
            <LineChart data={chartData} height={260} color="var(--accent)" unit={` ${chartUnit}`} decimals={1} emptyLabel="Add at least two measurements to see the trend" />
          </Card>

          <div className="grid two">
            <Card>
              <CardHead
                title="Measurement history"
                subtitle={`${measurements.length} entries in this range`}
                icon="ruler"
                actions={<Button variant="ghost" size="sm" icon="plus" onClick={() => setMeasureOpen(true)}>Add</Button>}
              />
              {measurements.length === 0 ? (
                <Empty icon="ruler" title="No measurements yet" description="Capture a baseline, then track weekly." />
              ) : (
                <div className="table-wrap scroll-y">
                  <table className="table table-compact">
                    <thead>
                      <tr><th>Date</th><th>Weight</th><th>Fat</th><th>Waist</th><th /></tr>
                    </thead>
                    <tbody>
                      {[...measurements].reverse().map((measurement) => (
                        <tr key={measurement.id}>
                          <td>{fmtDate(measurement.measuredOn)}</td>
                          <td className="mono">{measurement.weightKg !== null ? `${kgToDisplay(measurement.weightKg, unitSystem)} ${weightUnitLabel}` : '—'}</td>
                          <td className="mono">{measurement.bodyFatPct !== null ? `${measurement.bodyFatPct}%` : '—'}</td>
                          <td className="mono">{measurement.waistCm !== null ? `${cmToDisplay(measurement.waistCm, unitSystem)} ${lengthUnitLabel}` : '—'}</td>
                          <td className="cell-actions">
                            <IconButton icon="trash" label="Delete measurement" size="sm" onClick={() => deleteMeasurement(measurement)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHead
                title="Personal records"
                subtitle="Heaviest set per exercise"
                icon="trophy"
                actions={<Button variant="ghost" size="sm" iconRight="chevronRight" onClick={() => navigate('/workouts?tab=records')}>All</Button>}
              />
              {prs.length === 0 ? (
                <Empty icon="trophy" title="No records yet" description="Log weighted sets to start tracking PRs." />
              ) : (
                <ul className="pr-list">
                  {prs.slice(0, 6).map((record) => (
                    <li key={record.exerciseName}>
                      <span className="pr-icon"><Icon name="medal" size={16} /></span>
                      <div>
                        <strong>{record.exerciseName}</strong>
                        <span>{record.weight} kg × {record.reps} reps · {fmtDate(record.date)}</span>
                      </div>
                      <span className="mono">{record.estimated1RM} kg</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHead
              title="Goals"
              subtitle={`${goals.filter((goal) => goal.status === 'active').length} active · ${goals.filter((goal) => goal.status === 'completed').length} completed`}
              icon="target"
              actions={<Button variant="ghost" size="sm" icon="plus" onClick={() => setGoalModal({ open: true, initial: null })}>New goal</Button>}
            />
            {goals.length === 0 ? (
              <Empty icon="target" title="No goals yet" description="A concrete target turns intention into a plan." action={<Button onClick={() => setGoalModal({ open: true, initial: null })}>Create a goal</Button>} />
            ) : (
              <div className="goal-grid">
                {goals.map((goal) => (
                  <div key={goal.id} className={`goal-card ${goal.status === 'completed' ? 'is-complete' : ''}`}>
                    <div className="goal-card-head">
                      <Badge tone={goal.status === 'completed' ? 'accent' : 'neutral'}>{goal.status}</Badge>
                      <div className="goal-card-actions">
                        <IconButton icon="edit" label="Edit goal" size="sm" onClick={() => setGoalModal({ open: true, initial: goal })} />
                        <IconButton icon="trash" label="Delete goal" size="sm" onClick={() => deleteGoal(goal)} />
                      </div>
                    </div>
                    <h4>{goal.title}</h4>
                    <div className="goal-progress-row">
                      <Progress value={goal.progress} max={100} />
                      <span className="mono">{Math.round(goal.progress)}%</span>
                    </div>
                    <div className="goal-card-foot">
                      <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                      <span>{goal.deadline ? `by ${fmtDate(goal.deadline)}` : 'No deadline'}</span>
                    </div>
                    {goal.status === 'active' ? (
                      <Button variant="secondary" size="sm" icon="check" onClick={() => updateGoal(goal, 'completed')}>Mark complete</Button>
                    ) : (
                      <Button variant="ghost" size="sm" icon="refresh" onClick={() => updateGoal(goal, 'active')}>Reactivate</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHead
              title="Performance metrics"
              subtitle="Run times, lifts, jumps and anything else you track"
              icon="activity"
              actions={<Button variant="ghost" size="sm" icon="plus" onClick={() => setMetricOpen(true)}>Add metric</Button>}
            />
            {(metricTypes.data?.items || []).length === 0 ? (
              <Empty icon="activity" title="No metrics yet" description="Record a 5K time or a 1RM to start the trend." />
            ) : (
              <>
                <div className="filter-row">
                  {(metricTypes.data?.items || []).map((metric) => (
                    <Chip key={metric.name} active={selectedMetric === metric.name} onClick={() => setSelectedMetric(metric.name)}>
                      {metric.name}
                      <span className="chip-sub">{metric.latest} {metric.unit}</span>
                    </Chip>
                  ))}
                </div>
                <LineChart
                  data={(metricsApi.data?.items || []).map((item) => ({ label: fmtDate(item.recordedOn), date: item.recordedOn, value: item.value }))}
                  height={220}
                  color="var(--teal)"
                  unit={metricsApi.data?.items?.[0]?.unit ? ` ${metricsApi.data.items[0].unit}` : ''}
                  decimals={2}
                  emptyLabel="Add another entry to see a trend"
                />
                <div className="table-wrap scroll-y">
                  <table className="table table-compact">
                    <thead><tr><th>Date</th><th>Value</th><th>Notes</th><th /></tr></thead>
                    <tbody>
                      {[...(metricsApi.data?.items || [])].reverse().map((metric) => (
                        <tr key={metric.id}>
                          <td>{fmtDate(metric.recordedOn)}</td>
                          <td className="mono">{metric.value} {metric.unit}</td>
                          <td className="muted">{metric.notes || '—'}</td>
                          <td className="cell-actions"><IconButton icon="trash" label="Delete metric" size="sm" onClick={() => deleteMetric(metric)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHead title="Achievements" subtitle="Earned by showing up" icon="award" />
            <div className="achievement-grid">
              {achievements.map((achievement) => (
                <div key={achievement.key} className={`achievement ${achievement.unlocked ? 'is-unlocked' : ''}`}>
                  <span className="achievement-icon"><Icon name={achievement.icon} size={22} /></span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.unlocked ? achievement.body : 'Locked — keep training.'}</p>
                    {achievement.unlockedAt && <span className="achievement-date">{fmtDate(achievement.unlockedAt, { year: 'numeric' })}</span>}
                  </div>
                  {achievement.unlocked && <Icon name="check" size={16} className="achievement-check" />}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <MeasureModal open={measureOpen} onClose={() => setMeasureOpen(false)} onSaved={refresh} />
      <GoalModal open={goalModal.open} initial={goalModal.initial} onClose={() => setGoalModal({ open: false, initial: null })} onSaved={refresh} />
      <MetricModal open={metricOpen} suggestions={metricTypes.data?.items || []} onClose={() => setMetricOpen(false)} onSaved={refresh} />
    </div>
  );
}
