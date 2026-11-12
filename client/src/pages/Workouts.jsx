import React, { useEffect, useMemo, useState } from 'react';
import { useApi, useAuth, useDebounced, useToast } from '../state';
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
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from '../components/ui';
import { Icon } from '../icons';
import { api } from '../api';
import { CATEGORIES, CATEGORY_META, fmtDate, fmtDuration, fmtNumber, todayISO } from '../utils';

const blankExercise = () => ({ name: '', sets: 3, reps: 10, weight: 0, restSeconds: 60, notes: '' });
const blankRoutine = () => ({
  name: '',
  category: 'strength',
  description: '',
  tags: '',
  isPublic: false,
  exercises: [blankExercise()],
});

function setsFromRoutine(routine) {
  const sets = [];
  routine.exercises.forEach((exercise) => {
    for (let index = 1; index <= exercise.sets; index += 1) {
      sets.push({
        exerciseName: exercise.name,
        setNumber: index,
        reps: exercise.reps,
        weight: exercise.weight,
        notes: '',
      });
    }
  });
  return sets;
}

function RoutineModal({ open, initial, catalog, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(blankRoutine);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        category: initial.category,
        description: initial.description || '',
        tags: (initial.tags || []).join(', '),
        isPublic: Boolean(initial.isPublic),
        exercises: initial.exercises.length ? initial.exercises.map((exercise) => ({ ...exercise })) : [blankExercise()],
      });
    } else {
      setForm(blankRoutine());
    }
    setError(null);
  }, [open, initial]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const updateExercise = (index, key, value) => {
    setForm((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, position) =>
        position === index ? { ...exercise, [key]: key === 'name' || key === 'notes' ? value : Number(value) } : exercise
      ),
    }));
  };

  const addExercise = () => setForm((current) => ({ ...current, exercises: [...current.exercises, blankExercise()] }));
  const removeExercise = (index) =>
    setForm((current) => ({ ...current, exercises: current.exercises.filter((_, position) => position !== index) }));

  const submit = async (event) => {
    event.preventDefault();
    const exercises = form.exercises.filter((exercise) => exercise.name.trim());
    if (!form.name.trim()) {
      setError('Give your routine a name.');
      return;
    }
    if (!exercises.length) {
      setError('Add at least one exercise.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        isPublic: form.isPublic,
        exercises,
      };
      if (initial) await api.put(`/workouts/${initial.id}`, payload);
      else await api.post('/workouts', payload);
      toast(initial ? 'Routine updated.' : 'Routine created.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit routine' : 'New routine'}
      subtitle="Structure the session so future you can repeat it."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="routine-form" loading={saving}>{initial ? 'Save changes' : 'Create routine'}</Button>
        </>
      }
    >
      <form id="routine-form" onSubmit={submit} className="form-stack">
        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="form-grid two">
          <Field label="Routine name" htmlFor="routine-name">
            <Input id="routine-name" value={form.name} onChange={update('name')} placeholder="Push Day — Chest & Shoulders" required />
          </Field>
          <Field label="Category" htmlFor="routine-category">
            <Select id="routine-category" value={form.category} onChange={update('category')}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_META[category].label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description" htmlFor="routine-description" optional>
          <Textarea id="routine-description" value={form.description} onChange={update('description')} placeholder="Focus, tempo, cues…" />
        </Field>
        <div className="form-grid two">
          <Field label="Tags" htmlFor="routine-tags" hint="Comma separated (e.g. push, upper)">
            <Input id="routine-tags" value={form.tags} onChange={update('tags')} placeholder="push, upper" />
          </Field>
          <div className="field">
            <span className="field-label">Visibility</span>
            <label className="checkbox checkbox-card">
              <input type="checkbox" checked={form.isPublic} onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))} />
              <span className="checkbox-box" aria-hidden="true"><Icon name="check" size={12} strokeWidth={3} /></span>
              <span>
                Share publicly
                <small>Others can view and duplicate this routine.</small>
              </span>
            </label>
          </div>
        </div>

        <div className="exercise-editor">
          <div className="exercise-editor-head">
            <h4>Exercises</h4>
            <Button variant="secondary" size="sm" icon="plus" onClick={addExercise} type="button">Add exercise</Button>
          </div>
          {form.exercises.map((exercise, index) => (
            <div className="exercise-row" key={index}>
              <div className="exercise-row-main">
                <Field label={index === 0 ? 'Exercise' : undefined}>
                  <Input
                    list="exercise-options"
                    value={exercise.name}
                    onChange={(event) => updateExercise(index, 'name', event.target.value)}
                    placeholder="Bench press"
                    aria-label="Exercise name"
                  />
                </Field>
              </div>
              <div className="exercise-row-numbers">
                <Field label={index === 0 ? 'Sets' : undefined}>
                  <Input type="number" min="1" max="50" value={exercise.sets} onChange={(event) => updateExercise(index, 'sets', event.target.value)} aria-label="Sets" />
                </Field>
                <Field label={index === 0 ? 'Reps' : undefined}>
                  <Input type="number" min="0" max="1000" value={exercise.reps} onChange={(event) => updateExercise(index, 'reps', event.target.value)} aria-label="Reps" />
                </Field>
                <Field label={index === 0 ? 'Weight' : undefined}>
                  <Input type="number" min="0" step="0.5" value={exercise.weight} onChange={(event) => updateExercise(index, 'weight', event.target.value)} aria-label="Weight" />
                </Field>
                <Field label={index === 0 ? 'Rest (s)' : undefined}>
                  <Input type="number" min="0" max="3600" value={exercise.restSeconds} onChange={(event) => updateExercise(index, 'restSeconds', event.target.value)} aria-label="Rest seconds" />
                </Field>
                <IconButton icon="trash" label={`Remove ${exercise.name || 'exercise'}`} size="sm" onClick={() => removeExercise(index)} className="exercise-remove" />
              </div>
            </div>
          ))}
          <datalist id="exercise-options">
            {catalog.map((item) => (
              <option key={item.name} value={item.name} />
            ))}
          </datalist>
        </div>
      </form>
    </Modal>
  );
}

function LogModal({ open, initialRoutine, onClose, onSaved }) {
  const { toast } = useToast();
  const { data: routinesData } = useApi('/workouts?limit=60');
  const routines = routinesData?.items || [];
  const [routineId, setRoutineId] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'strength',
    performedAt: todayISO(),
    durationMin: 60,
    caloriesBurned: 400,
    rating: 4,
    notes: '',
  });
  const [sets, setSets] = useState([{ exerciseName: '', setNumber: 1, reps: 10, weight: 0, notes: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const applyRoutine = (routine) => {
    setRoutineId(routine.id);
    setForm((current) => ({
      ...current,
      name: routine.name,
      category: routine.category,
    }));
    setSets(setsFromRoutine(routine));
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialRoutine) {
      applyRoutine(initialRoutine);
    } else {
      setRoutineId('');
      setForm({
        name: '',
        category: 'strength',
        performedAt: todayISO(),
        durationMin: 60,
        caloriesBurned: 400,
        rating: 4,
        notes: '',
      });
      setSets([{ exerciseName: '', setNumber: 1, reps: 10, weight: 0, notes: '' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRoutine]);

  const totalVolume = useMemo(
    () => sets.reduce((sum, set) => sum + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0),
    [sets]
  );

  const updateSet = (index, key, value) => {
    setSets((current) =>
      current.map((set, position) => (position === index ? { ...set, [key]: key === 'exerciseName' ? value : Number(value) } : set))
    );
  };

  const addSet = () => {
    const last = sets[sets.length - 1];
    setSets((current) => [
      ...current,
      {
        exerciseName: last?.exerciseName || '',
        setNumber: (last?.setNumber || 0) + 1,
        reps: last?.reps ?? 10,
        weight: last?.weight ?? 0,
        notes: '',
      },
    ]);
  };

  const removeSet = (index) => setSets((current) => current.filter((_, position) => position !== index));

  const submit = async (event) => {
    event.preventDefault();
    const validSets = sets.filter((set) => set.exerciseName.trim());
    if (!form.name.trim()) {
      setError('Give this workout a name.');
      return;
    }
    if (!validSets.length) {
      setError('Add at least one set with an exercise name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/workout-logs', {
        ...form,
        workoutId: routineId || undefined,
        sets: validSets.map((set, index) => ({ ...set, setNumber: index + 1 })),
      });
      toast('Workout logged. Nice work!');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a workout"
      subtitle="Capture what you actually did — details drive progress."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="log-workout-form" loading={saving}>Save workout</Button>
        </>
      }
    >
      <form id="log-workout-form" onSubmit={submit} className="form-stack">
        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="form-grid two">
          <Field label="Start from routine" htmlFor="log-routine" optional>
            <Select
              id="log-routine"
              value={routineId}
              onChange={(event) => {
                const routine = routines.find((item) => item.id === event.target.value);
                if (routine) applyRoutine(routine);
                else {
                  setRoutineId('');
                  setForm((current) => ({ ...current, name: '', category: 'strength' }));
                  setSets([{ exerciseName: '', setNumber: 1, reps: 10, weight: 0, notes: '' }]);
                }
              }}
            >
              <option value="">Custom workout</option>
              {routines.map((routine) => (
                <option key={routine.id} value={routine.id}>{routine.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Workout name" htmlFor="log-name">
            <Input id="log-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Evening strength" required />
          </Field>
        </div>
        <div className="form-grid four">
          <Field label="Date" htmlFor="log-date">
            <Input id="log-date" type="date" value={form.performedAt} max={todayISO()} onChange={(event) => setForm((current) => ({ ...current, performedAt: event.target.value }))} />
          </Field>
          <Field label="Category" htmlFor="log-category">
            <Select id="log-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_META[category].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Duration (min)" htmlFor="log-duration">
            <Input id="log-duration" type="number" min="0" max="600" value={form.durationMin} onChange={(event) => setForm((current) => ({ ...current, durationMin: Number(event.target.value) }))} />
          </Field>
          <Field label="Calories burned" htmlFor="log-calories">
            <Input id="log-calories" type="number" min="0" max="5000" value={form.caloriesBurned} onChange={(event) => setForm((current) => ({ ...current, caloriesBurned: Number(event.target.value) }))} />
          </Field>
        </div>

        <div className="set-editor">
          <div className="exercise-editor-head">
            <h4>Sets <span className="muted">· {fmtNumber(totalVolume)} kg volume</span></h4>
            <Button variant="secondary" size="sm" icon="plus" onClick={addSet} type="button">Add set</Button>
          </div>
          <div className="set-table">
            {sets.map((set, index) => (
              <div className="set-row" key={index}>
                <span className="set-index">{index + 1}</span>
                <Input
                  value={set.exerciseName}
                  onChange={(event) => updateSet(index, 'exerciseName', event.target.value)}
                  placeholder="Exercise"
                  list="log-exercise-options"
                  aria-label="Exercise name"
                />
                <Input type="number" min="0" max="1000" value={set.reps} onChange={(event) => updateSet(index, 'reps', event.target.value)} aria-label="Reps" placeholder="Reps" />
                <Input type="number" min="0" step="0.5" value={set.weight} onChange={(event) => updateSet(index, 'weight', event.target.value)} aria-label="Weight" placeholder="kg" />
                <IconButton icon="close" label="Remove set" size="sm" onClick={() => removeSet(index)} />
              </div>
            ))}
            <datalist id="log-exercise-options">
              {[...new Set(sets.map((set) => set.exerciseName).filter(Boolean))].map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="form-grid two">
          <Field label="Session rating" htmlFor="log-rating">
            <Select id="log-rating" value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: Number(event.target.value) }))}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>{rating} / 5</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="log-notes" optional>
            <Input id="log-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="How did it feel?" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function RoutineDetail({ routine, onClose, onEdit, onLog, onDelete, onDuplicate }) {
  if (!routine) return null;
  return (
    <Modal
      open={Boolean(routine)}
      onClose={onClose}
      title={routine.name}
      subtitle={`${CATEGORY_META[routine.category]?.label || routine.category} · ${routine.exercises.length} exercises`}
      size="md"
      footer={
        <>
          {!routine.isTemplate && (
            <Button variant="danger" icon="trash" onClick={() => onDelete(routine)}>Delete</Button>
          )}
          <span className="spacer" />
          {routine.isTemplate && (
            <Button variant="secondary" icon="copy" onClick={() => onDuplicate(routine)}>Duplicate</Button>
          )}
          {!routine.isTemplate && (
            <Button variant="secondary" icon="edit" onClick={() => onEdit(routine)}>Edit</Button>
          )}
          <Button icon="play" onClick={() => onLog(routine)}>Log this</Button>
        </>
      }
    >
      {routine.description && <p className="detail-description">{routine.description}</p>}
      <div className="tag-row">
        {routine.tags.map((tag) => <Badge key={tag} tone="neutral">#{tag}</Badge>)}
        {routine.isTemplate && <Badge tone="accent">Template</Badge>}
        {routine.isPublic && !routine.isTemplate && <Badge tone="teal">Public</Badge>}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th><th>Rest</th></tr>
          </thead>
          <tbody>
            {routine.exercises.map((exercise, index) => (
              <tr key={`${exercise.name}-${index}`}>
                <td>{exercise.name}{exercise.notes && <small className="cell-sub">{exercise.notes}</small>}</td>
                <td className="mono">{exercise.sets}</td>
                <td className="mono">{exercise.reps}</td>
                <td className="mono">{exercise.weight ? `${exercise.weight} kg` : '—'}</td>
                <td className="mono">{exercise.restSeconds}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export function WorkoutsPage({ route }) {
  const { toast } = useToast();
  const initialTab = route.query.get('tab') || 'routines';
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState(route.query.get('q') || '');
  const debounced = useDebounced(query, 250);
  const [category, setCategory] = useState('all');
  const [scope, setScope] = useState('all');
  const [historyCategory, setHistoryCategory] = useState('all');
  const [routineModal, setRoutineModal] = useState({ open: false, initial: null });
  const [logModal, setLogModal] = useState({ open: false, routine: null });
  const [detail, setDetail] = useState(null);

  const routines = useApi(`/workouts?limit=60&q=${encodeURIComponent(debounced)}&category=${category === 'all' ? '' : category}&scope=${scope}`);
  const logs = useApi(`/workout-logs?limit=50&q=${encodeURIComponent(debounced)}&category=${historyCategory === 'all' ? '' : historyCategory}`);
  const prs = useApi('/workout-logs/prs');
  const catalog = useApi('/workouts/meta/exercises');

  useEffect(() => {
    if (route.query.get('action') === 'log') setLogModal({ open: true, routine: null });
  }, [route.hash]);

  useEffect(() => {
    const value = route.query.get('tab');
    if (value) setTab(value);
  }, [route.hash]);

  const routineItems = routines.data?.items || [];
  const logItems = logs.data?.items || [];
  const catalogItems = catalog.data?.items || [];

  const refreshAll = () => {
    routines.reload(true);
    logs.reload(true);
    prs.reload(true);
  };

  const deleteRoutine = async (routine) => {
    if (!window.confirm(`Delete “${routine.name}”? Logged sessions will be kept.`)) return;
    try {
      await api.del(`/workouts/${routine.id}`);
      toast('Routine deleted.');
      setDetail(null);
      refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const duplicateRoutine = async (routine) => {
    try {
      await api.post(`/workouts/${routine.id}/duplicate`);
      toast('Routine duplicated.');
      refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const deleteLog = async (log) => {
    if (!window.confirm(`Delete the log for “${log.name}”?`)) return;
    try {
      await api.del(`/workout-logs/${log.id}`);
      toast('Workout log deleted.');
      refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Training"
        title="Workouts"
        subtitle="Build routines, log sessions and watch your volume grow."
        actions={
          <div className="quick-actions">
            <Button variant="secondary" icon="dumbbell" onClick={() => setLogModal({ open: true, routine: null })}>Log workout</Button>
            <Button icon="plus" onClick={() => setRoutineModal({ open: true, initial: null })}>New routine</Button>
          </div>
        }
      />

      <div className="toolbar">
        <div className="search-inline">
          <Icon name="search" size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search routines or sessions" aria-label="Search workouts" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={15} /></button>}
        </div>
        <Tabs
          tabs={[
            { value: 'routines', label: 'Routines', count: routines.data?.total },
            { value: 'history', label: 'History', count: logs.data?.total },
            { value: 'records', label: 'Records', count: prs.data?.items?.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'routines' && (
        <>
          <div className="filter-row">
            {[
              { value: 'all', label: 'All' },
              { value: 'mine', label: 'My routines' },
              { value: 'templates', label: 'Templates' },
            ].map((item) => (
              <Chip key={item.value} active={scope === item.value} onClick={() => setScope(item.value)}>
                {item.label}
              </Chip>
            ))}
          </div>
          <div className="filter-row">
            {['all', ...CATEGORIES].map((item) => (
              <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
                {item === 'all' ? 'All' : CATEGORY_META[item].label}
              </Chip>
            ))}
          </div>

          {routines.loading && !routines.data ? (
            <div className="card-grid">
              {[0, 1, 2].map((key) => <Skeleton key={key} height={210} />)}
            </div>
          ) : routineItems.length === 0 ? (
            <Empty
              icon="dumbbell"
              title={query ? 'No routines match that search' : 'No routines yet'}
              description={query ? 'Try a different term or clear the filters.' : 'Create a routine once, then reuse and progress it every week.'}
              action={<Button icon="plus" onClick={() => setRoutineModal({ open: true, initial: null })}>Create your first routine</Button>}
            />
          ) : (
            <div className="card-grid">
              {routineItems.map((routine) => (
                <Card key={routine.id} className="routine-card">
                  <div className="routine-card-top">
                    <Badge tone={routine.category}>{CATEGORY_META[routine.category]?.label || routine.category}</Badge>
                    {routine.isTemplate && <Badge tone="accent">Template</Badge>}
                    <div className="routine-menu">
                      {!routine.isTemplate && (
                        <IconButton icon="edit" label="Edit routine" size="sm" onClick={() => setRoutineModal({ open: true, initial: routine })} />
                      )}
                      <IconButton icon="more" label="More options" size="sm" onClick={() => setDetail(routine)} />
                    </div>
                  </div>
                  <button type="button" className="routine-title-button" onClick={() => setDetail(routine)}>
                    <h3>{routine.name}</h3>
                    {routine.description && <p>{routine.description}</p>}
                  </button>
                  <div className="routine-meta">
                    <span><Icon name="dumbbell" size={14} /> {routine.exerciseCount} exercises</span>
                    <span><Icon name="list" size={14} /> {routine.totalSets} sets</span>
                    {routine.isTemplate && <span><Icon name="sparkles" size={14} /> Template</span>}
                    {routine.isPublic && !routine.isTemplate && <span><Icon name="users" size={14} /> Public</span>}
                  </div>
                  <div className="tag-row">
                    {routine.tags.slice(0, 3).map((tag) => <span key={tag} className="tag">#{tag}</span>)}
                  </div>
                  <div className="routine-card-foot">
                    <Button variant="ghost" size="sm" icon="more" onClick={() => setDetail(routine)}>Details</Button>
                    <Button size="sm" icon="play" onClick={() => setLogModal({ open: true, routine })}>Log</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="filter-row">
            {['all', ...CATEGORIES].map((item) => (
              <Chip key={item} active={historyCategory === item} onClick={() => setHistoryCategory(item)}>
                {item === 'all' ? 'All' : CATEGORY_META[item].label}
              </Chip>
            ))}
          </div>
          {logs.loading && !logs.data ? (
            <Skeleton height={320} />
          ) : logItems.length === 0 ? (
            <Empty
              icon="history"
              title="No sessions logged yet"
              description="Your history will appear here once you log a workout."
              action={<Button icon="plus" onClick={() => setLogModal({ open: true, routine: null })}>Log a workout</Button>}
            />
          ) : (
            <div className="session-list">
              {logItems.map((log) => (
                <details key={log.id} className="session-card">
                  <summary>
                    <span className="session-icon" style={{ color: CATEGORY_META[log.category]?.color }}>
                      <Icon name={log.category === 'cardio' ? 'activity' : 'dumbbell'} size={18} />
                    </span>
                    <span className="session-main">
                      <strong>{log.name}</strong>
                      <span>{fmtDate(log.performedAt, { weekday: 'short' })} · {log.totalSets} sets · {log.totalReps} reps</span>
                    </span>
                    <span className="session-stats">
                      <span>{fmtDuration(log.durationMin)}</span>
                      <span className="mono">{fmtNumber(log.volume)} kg</span>
                      <span>{log.caloriesBurned} kcal</span>
                    </span>
                    <Icon name="chevronDown" size={17} className="session-chevron" />
                  </summary>
                  <div className="session-body">
                    <div className="session-notes">{log.notes || 'No notes for this session.'}</div>
                    <div className="table-wrap">
                      <table className="table table-compact">
                        <thead>
                          <tr><th>Exercise</th><th>Set</th><th>Reps</th><th>Weight</th><th>Volume</th></tr>
                        </thead>
                        <tbody>
                          {log.sets.map((set, index) => (
                            <tr key={`${set.exerciseName}-${set.setNumber}-${index}`}>
                              <td>{set.exerciseName}</td>
                              <td className="mono">{set.setNumber}</td>
                              <td className="mono">{set.reps}</td>
                              <td className="mono">{set.weight ? `${set.weight} kg` : '—'}</td>
                              <td className="mono">{fmtNumber(set.reps * set.weight)} kg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="session-actions">
                      <span className="muted">
                        {log.rating ? `Rated ${log.rating}/5` : 'No rating'} · {fmtDate(log.performedAt, { year: 'numeric' })}
                      </span>
                      <Button variant="danger" size="sm" icon="trash" onClick={() => deleteLog(log)}>Delete log</Button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'records' && (
        <Card>
          <CardHead title="Personal records" subtitle="Heaviest completed set for each exercise" icon="trophy" />
          {prs.loading && !prs.data ? (
            <Skeleton height={240} />
          ) : (prs.data?.items || []).length === 0 ? (
            <Empty icon="trophy" title="No records yet" description="Log weighted sets to start setting personal bests." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Exercise</th><th>Best set</th><th>Est. 1RM</th><th>Achieved</th></tr>
                </thead>
                <tbody>
                  {(prs.data?.items || []).map((record) => (
                    <tr key={record.exerciseName}>
                      <td>{record.exerciseName}</td>
                      <td className="mono">{record.weight} kg × {record.reps}</td>
                      <td className="mono">{record.estimated1RM} kg</td>
                      <td className="muted">{fmtDate(record.date, { year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <RoutineModal
        open={routineModal.open}
        initial={routineModal.initial}
        catalog={catalogItems}
        onClose={() => setRoutineModal({ open: false, initial: null })}
        onSaved={refreshAll}
      />
      <LogModal
        open={logModal.open}
        initialRoutine={logModal.routine}
        onClose={() => setLogModal({ open: false, routine: null })}
        onSaved={refreshAll}
      />
      <RoutineDetail
        routine={detail}
        onClose={() => setDetail(null)}
        onEdit={(routine) => {
          setDetail(null);
          setRoutineModal({ open: true, initial: routine });
        }}
        onLog={(routine) => {
          setDetail(null);
          setLogModal({ open: true, routine });
        }}
        onDuplicate={async (routine) => {
          await duplicateRoutine(routine);
          setDetail(null);
        }}
        onDelete={deleteRoutine}
      />
    </div>
  );
}
