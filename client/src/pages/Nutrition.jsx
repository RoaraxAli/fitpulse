import React, { useEffect, useMemo, useState } from 'react';
import { useApi, useAuth, useDebounced, useToast } from '../state';
import { navigate } from '../router';
import {
  Badge,
  Button,
  Card,
  CardHead,
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
  MEALS,
  MEAL_META,
  addDays,
  fmtDate,
  fmtNumber,
  percent,
  todayISO,
} from '../utils';

const emptyFoodForm = () => ({
  name: '',
  brand: '',
  servingSize: 100,
  servingUnit: 'g',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
});

function AddFoodModal({ open, initialMeal = 'breakfast', date, onClose, onSaved }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const foodsApi = useApi(open ? `/foods?q=${encodeURIComponent(debounced)}&limit=30` : null);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [meal, setMeal] = useState(initialMeal);
  const [entryDate, setEntryDate] = useState(date);
  const [custom, setCustom] = useState(emptyFoodForm());
  const [quick, setQuick] = useState({ foodName: '', calories: '', protein: '', carbs: '', fat: '', quantity: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setMode('search');
    setQuery('');
    setSelected(null);
    setQuantity(1);
    setMeal(initialMeal);
    setEntryDate(date);
    setCustom(emptyFoodForm());
    setQuick({ foodName: '', calories: '', protein: '', carbs: '', fat: '', quantity: 1 });
    setError(null);
  }, [open, initialMeal, date]);

  const totals = useMemo(() => {
    if (!selected) return null;
    return {
      calories: Math.round(selected.calories * quantity),
      protein: Math.round(selected.protein * quantity * 10) / 10,
      carbs: Math.round(selected.carbs * quantity * 10) / 10,
      fat: Math.round(selected.fat * quantity * 10) / 10,
    };
  }, [selected, quantity]);

  const submitSearch = async () => {
    if (!selected) {
      setError('Choose a food from the list.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/nutrition', { date: entryDate, meal, foodId: selected.id, quantity });
      toast(`${selected.name} added.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitCustom = async (event) => {
    event.preventDefault();
    if (!custom.name.trim()) {
      setError('Name your food.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/foods', {
        name: custom.name,
        brand: custom.brand,
        servingSize: Number(custom.servingSize) || 100,
        servingUnit: custom.servingUnit,
        calories: Number(custom.calories) || 0,
        protein: Number(custom.protein) || 0,
        carbs: Number(custom.carbs) || 0,
        fat: Number(custom.fat) || 0,
      });
      await api.post('/nutrition', {
        date: entryDate,
        meal,
        foodName: custom.name,
        quantity: 1,
        servingSize: Number(custom.servingSize) || 100,
        servingUnit: custom.servingUnit,
        calories: Number(custom.calories) || 0,
        protein: Number(custom.protein) || 0,
        carbs: Number(custom.carbs) || 0,
        fat: Number(custom.fat) || 0,
      });
      toast(`${custom.name} added.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitQuick = async () => {
    if (!quick.foodName.trim()) {
      setError('What did you eat?');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/nutrition', {
        date: entryDate,
        meal,
        foodName: quick.foodName,
        quantity: Number(quick.quantity) || 1,
        servingSize: 1,
        servingUnit: 'serving',
        calories: Number(quick.calories) || 0,
        protein: Number(quick.protein) || 0,
        carbs: Number(quick.carbs) || 0,
        fat: Number(quick.fat) || 0,
      });
      toast('Entry added.');
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
      title="Add food"
      subtitle="Search the food library, create a custom food, or enter macros manually."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {mode === 'search' && <Button loading={saving} onClick={submitSearch} disabled={!selected}>Add to {MEAL_META[meal].label.toLowerCase()}</Button>}
          {mode === 'custom' && <Button type="submit" form="custom-food-form" loading={saving}>Create & add</Button>}
          {mode === 'quick' && <Button loading={saving} onClick={submitQuick}>Add entry</Button>}
        </>
      }
    >
      <div className="segmented" role="tablist">
        {[
          { value: 'search', label: 'Food library' },
          { value: 'custom', label: 'New food' },
          { value: 'quick', label: 'Quick entry' },
        ].map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={mode === item.value} className={mode === item.value ? 'is-active' : ''} onClick={() => { setMode(item.value); setError(null); }}>
            {item.label}
          </button>
        ))}
      </div>

      {error && <div className="form-alert" role="alert">{error}</div>}

      <div className="form-grid three modal-context-row">
        <Field label="Meal" htmlFor="food-meal">
          <Select id="food-meal" value={meal} onChange={(event) => setMeal(event.target.value)}>
            {MEALS.map((item) => <option key={item} value={item}>{MEAL_META[item].label}</option>)}
          </Select>
        </Field>
        <Field label="Date" htmlFor="food-date">
          <Input id="food-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        </Field>
      </div>

      {mode === 'search' && (
        <div className="food-search">
          <div className="search-inline">
            <Icon name="search" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chicken, oats, salmon…" aria-label="Search foods" autoFocus />
            {foodsApi.loading && <span className="spinner spinner-sm" />}
          </div>
          <div className="food-list">
            {(foodsApi.data?.items || []).map((food) => (
              <button
                type="button"
                key={food.id}
                className={`food-option ${selected?.id === food.id ? 'is-selected' : ''}`}
                onClick={() => setSelected(food)}
              >
                <span className="food-option-main">
                  <strong>{food.name}</strong>
                  <span>{food.brand ? `${food.brand} · ` : ''}{food.servingSize}{food.servingUnit} serving</span>
                </span>
                <span className="food-option-macros">
                  <strong>{Math.round(food.calories)} kcal</strong>
                  <span>P {Math.round(food.protein)} · C {Math.round(food.carbs)} · F {Math.round(food.fat)}</span>
                </span>
                {selected?.id === food.id && <Icon name="check" size={18} />}
              </button>
            ))}
            {!foodsApi.loading && (foodsApi.data?.items || []).length === 0 && (
              <p className="muted center pad-md">No foods found. Try “New food” to add your own.</p>
            )}
          </div>
          {selected && (
            <div className="food-selected-card">
              <div>
                <strong>{selected.name}</strong>
                <span>{Math.round(selected.calories)} kcal per {selected.servingSize}{selected.servingUnit}</span>
              </div>
              <Field label="Servings" htmlFor="food-quantity">
                <Input id="food-quantity" type="number" min="0.25" step="0.25" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
              </Field>
              {totals && (
                <div className="food-totals">
                  <strong>{totals.calories} kcal</strong>
                  <span>P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'custom' && (
        <form id="custom-food-form" onSubmit={submitCustom} className="form-stack">
          <div className="form-grid two">
            <Field label="Food name" htmlFor="custom-name">
              <Input id="custom-name" value={custom.name} onChange={(event) => setCustom((current) => ({ ...current, name: event.target.value }))} placeholder="Chicken wrap" required />
            </Field>
            <Field label="Brand" htmlFor="custom-brand" optional>
              <Input id="custom-brand" value={custom.brand} onChange={(event) => setCustom((current) => ({ ...current, brand: event.target.value }))} placeholder="Homemade" />
            </Field>
          </div>
          <div className="form-grid three">
            <Field label="Serving size" htmlFor="custom-serving">
              <Input id="custom-serving" type="number" min="0.1" step="0.1" value={custom.servingSize} onChange={(event) => setCustom((current) => ({ ...current, servingSize: event.target.value }))} />
            </Field>
            <Field label="Unit" htmlFor="custom-unit">
              <Select id="custom-unit" value={custom.servingUnit} onChange={(event) => setCustom((current) => ({ ...current, servingUnit: event.target.value }))}>
                {['g', 'ml', 'oz', 'serving', 'piece'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </Select>
            </Field>
            <Field label="Calories" htmlFor="custom-calories">
              <Input id="custom-calories" type="number" min="0" value={custom.calories} onChange={(event) => setCustom((current) => ({ ...current, calories: event.target.value }))} placeholder="250" />
            </Field>
          </div>
          <div className="form-grid three">
            <Field label="Protein (g)" htmlFor="custom-protein">
              <Input id="custom-protein" type="number" min="0" step="0.1" value={custom.protein} onChange={(event) => setCustom((current) => ({ ...current, protein: event.target.value }))} />
            </Field>
            <Field label="Carbs (g)" htmlFor="custom-carbs">
              <Input id="custom-carbs" type="number" min="0" step="0.1" value={custom.carbs} onChange={(event) => setCustom((current) => ({ ...current, carbs: event.target.value }))} />
            </Field>
            <Field label="Fat (g)" htmlFor="custom-fat">
              <Input id="custom-fat" type="number" min="0" step="0.1" value={custom.fat} onChange={(event) => setCustom((current) => ({ ...current, fat: event.target.value }))} />
            </Field>
          </div>
          <p className="muted small">Values are per serving. The food is saved to your personal library for next time.</p>
        </form>
      )}

      {mode === 'quick' && (
        <div className="form-stack">
          <Field label="What did you eat?" htmlFor="quick-name">
            <Input id="quick-name" value={quick.foodName} onChange={(event) => setQuick((current) => ({ ...current, foodName: event.target.value }))} placeholder="Restaurant burrito bowl" />
          </Field>
          <div className="form-grid four">
            <Field label="Calories" htmlFor="quick-calories">
              <Input id="quick-calories" type="number" min="0" value={quick.calories} onChange={(event) => setQuick((current) => ({ ...current, calories: event.target.value }))} />
            </Field>
            <Field label="Protein (g)" htmlFor="quick-protein">
              <Input id="quick-protein" type="number" min="0" value={quick.protein} onChange={(event) => setQuick((current) => ({ ...current, protein: event.target.value }))} />
            </Field>
            <Field label="Carbs (g)" htmlFor="quick-carbs">
              <Input id="quick-carbs" type="number" min="0" value={quick.carbs} onChange={(event) => setQuick((current) => ({ ...current, carbs: event.target.value }))} />
            </Field>
            <Field label="Fat (g)" htmlFor="quick-fat">
              <Input id="quick-fat" type="number" min="0" value={quick.fat} onChange={(event) => setQuick((current) => ({ ...current, fat: event.target.value }))} />
            </Field>
          </div>
          <p className="muted small">Quick entries do not create a reusable food — perfect for one-off meals.</p>
        </div>
      )}
    </Modal>
  );
}

function EditEntryModal({ entry, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ quantity: 1, meal: 'breakfast', date: todayISO(), notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) setForm({ quantity: entry.quantity, meal: entry.meal, date: entry.date, notes: entry.notes || '' });
  }, [entry]);

  if (!entry) return null;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put(`/nutrition/${entry.id}`, form);
      toast('Entry updated.');
      onSaved();
      onClose();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${entry.foodName} from this day?`)) return;
    try {
      await api.del(`/nutrition/${entry.id}`);
      toast('Entry removed.');
      onSaved();
      onClose();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <Modal
      open={Boolean(entry)}
      onClose={onClose}
      title={entry.foodName}
      subtitle={`${Math.round(entry.calories)} kcal · P ${entry.protein}g · C ${entry.carbs}g · F ${entry.fat}g`}
      footer={
        <>
          <Button variant="danger" icon="trash" onClick={remove}>Remove</Button>
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-entry-form" loading={saving}>Save</Button>
        </>
      }
    >
      <form id="edit-entry-form" onSubmit={submit} className="form-stack">
        <div className="form-grid three">
          <Field label="Servings" htmlFor="entry-quantity">
            <Input id="entry-quantity" type="number" min="0.25" step="0.25" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))} />
          </Field>
          <Field label="Meal" htmlFor="entry-meal">
            <Select id="entry-meal" value={form.meal} onChange={(event) => setForm((current) => ({ ...current, meal: event.target.value }))}>
              {MEALS.map((meal) => <option key={meal} value={meal}>{MEAL_META[meal].label}</option>)}
            </Select>
          </Field>
          <Field label="Date" htmlFor="entry-date">
            <Input id="entry-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="entry-notes" optional>
          <Textarea id="entry-notes" rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
      </form>
    </Modal>
  );
}

export function NutritionPage({ route }) {
  const { user } = useAuth();
  const [date, setDate] = useState(route.query.get('date') || todayISO());
  const [addMeal, setAddMeal] = useState(null);
  const [editing, setEditing] = useState(null);
  const day = useApi(`/nutrition?date=${date}`);
  const week = useApi(`/nutrition/week?date=${date}`);
  const goals = day.data?.goals || { calories: 2400, protein: 160, carbs: 260, fat: 75 };

  useEffect(() => {
    const action = route.query.get('action');
    if (action === 'add') setAddMeal('snack');
    const queryDate = route.query.get('date');
    if (queryDate && queryDate !== date) setDate(queryDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.hash]);

  const changeDate = (next) => {
    setDate(next);
    navigate(`/nutrition?date=${next}`, { replace: true });
  };

  const entries = day.data?.entries || [];
  const totals = day.data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const weekDays = week.data?.days || [];
  const loggedDays = weekDays.filter((item) => item.entries > 0);
  const averageCalories = loggedDays.length
    ? Math.round(loggedDays.reduce((sum, item) => sum + item.calories, 0) / loggedDays.length)
    : 0;

  const refresh = () => {
    day.reload(true);
    week.reload(true);
  };

  const macroRows = [
    { key: 'protein', label: 'Protein', color: 'var(--teal)' },
    { key: 'carbs', label: 'Carbs', color: 'var(--orange)' },
    { key: 'fat', label: 'Fat', color: 'var(--violet)' },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Nutrition"
        title="Daily food log"
        subtitle="Log meals, track macros and stay close to your targets."
        actions={<Button icon="plus" onClick={() => setAddMeal('breakfast')}>Add food</Button>}
      />

      <div className="date-navigator">
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => changeDate(addDays(date, -1))}>Previous</Button>
        <div className="date-navigator-center">
          <Icon name="calendar" size={18} />
          <input type="date" value={date} max={todayISO()} onChange={(event) => changeDate(event.target.value)} aria-label="Select date" />
          <span>{date === todayISO() ? 'Today' : fmtDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
        <Button variant="ghost" size="sm" iconRight="chevronRight" onClick={() => changeDate(addDays(date, 1))} disabled={date >= todayISO()}>Next</Button>
      </div>

      <div className="grid nutrition-grid">
        <div className="page-stack">
          {day.loading && !day.data ? (
            <Skeleton height={420} />
          ) : (
            MEALS.map((meal) => {
              const mealEntries = entries.filter((entry) => entry.meal === meal);
              const mealCalories = mealEntries.reduce((sum, entry) => sum + entry.calories, 0);
              return (
                <Card key={meal} className="meal-card">
                  <div className="meal-head">
                    <div className="meal-head-title">
                      <span className={`meal-icon meal-icon-${meal}`}>
                        <Icon name={MEAL_META[meal].icon} size={18} />
                      </span>
                      <div>
                        <h3>{MEAL_META[meal].label}</h3>
                        <span>{mealEntries.length} {mealEntries.length === 1 ? 'item' : 'items'} · {Math.round(mealCalories)} kcal</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" icon="plus" onClick={() => setAddMeal(meal)}>Add</Button>
                  </div>
                  {mealEntries.length === 0 ? (
                    <p className="meal-empty">Nothing logged for {MEAL_META[meal].label.toLowerCase()} yet.</p>
                  ) : (
                    <ul className="food-entry-list">
                      {mealEntries.map((entry) => (
                        <li key={entry.id}>
                          <div className="food-entry-main">
                            <strong>{entry.foodName}</strong>
                            <span>
                              {entry.quantity} × {entry.servingSize}{entry.servingUnit}
                              {entry.notes ? ` · ${entry.notes}` : ''}
                            </span>
                          </div>
                          <div className="food-entry-macros">
                            <span className="mono">{Math.round(entry.calories)} kcal</span>
                            <small>P {Math.round(entry.protein)} · C {Math.round(entry.carbs)} · F {Math.round(entry.fat)}</small>
                          </div>
                          <IconButton icon="edit" label={`Edit ${entry.foodName}`} size="sm" onClick={() => setEditing(entry)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })
          )}
        </div>

        <div className="page-stack">
          <Card className="nutrition-summary">
            <CardHead title="Daily totals" subtitle={fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })} icon="apple" />
            <div className="nutrition-total">
              <div>
                <span className="nutrition-total-value">{fmtNumber(totals.calories)}</span>
                <span className="nutrition-total-label">of {fmtNumber(goals.calories)} kcal</span>
              </div>
              <span className="nutrition-total-percent">{percent(totals.calories, goals.calories)}%</span>
            </div>
            <Progress value={totals.calories} max={goals.calories} color="var(--accent)" />
            <div className="macro-bars pad-top">
              {macroRows.map((macro) => {
                const goal = goals[macro.key] || 0;
                return (
                  <div key={macro.key} className="macro-row">
                    <div className="macro-row-head">
                      <span><span className="legend-dot" style={{ background: macro.color }} /> {macro.label}</span>
                      <span className="mono">{Math.round(totals[macro.key])} / {goal}g</span>
                    </div>
                    <Progress value={totals[macro.key]} max={goal} color={macro.color} />
                  </div>
                );
              })}
            </div>
            <div className="summary-split">
              <div>
                <span className="mini-label">Remaining</span>
                <strong>{Math.max(0, goals.calories - Math.round(totals.calories))} kcal</strong>
              </div>
              <div>
                <span className="mini-label">Entries</span>
                <strong>{entries.length}</strong>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Calories this week" subtitle={`Average ${averageCalories} kcal on logged days`} icon="chart" />
            <LineChart
              data={weekDays.map((item) => ({ label: fmtDate(item.date, { weekday: 'short' }), value: item.calories, date: item.date }))}
              height={190}
              color="var(--orange)"
              unit=" kcal"
              goal={goals.calories}
              goalLabel="Goal"
              emptyLabel="Log meals to see your weekly trend"
            />
            <p className="muted small center">{loggedDays.length} of 7 days logged · target {goals.calories} kcal</p>
          </Card>

          <Card className="tip-card">
            <div className="tip-card-icon"><Icon name="sparkles" size={20} /></div>
            <div>
              <strong>Protein first</strong>
              <p>
                You are at {percent(totals.protein, goals.protein)}% of your protein goal. Spread servings across meals for
                steadier appetite control.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <AddFoodModal
        open={Boolean(addMeal)}
        initialMeal={addMeal || 'breakfast'}
        date={date}
        onClose={() => setAddMeal(null)}
        onSaved={refresh}
      />
      <EditEntryModal entry={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </div>
  );
}
