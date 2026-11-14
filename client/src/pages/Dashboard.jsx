import React from 'react';
import { useApi, useAuth } from '../state';
import { navigate } from '../router';
import { Avatar, Badge, Button, Card, CardHead, Empty, PageHeader, Progress, Skeleton, Stat } from '../components/ui';
import { Donut, BarChart, Sparkline } from '../components/charts';
import { Icon } from '../icons';
import {
  CATEGORY_META,
  MEAL_META,
  MEALS,
  fmtDate,
  fmtDuration,
  fmtNumber,
  kgToDisplay,
  percent,
  todayISO,
  weightUnit,
} from '../utils';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { user, unitSystem } = useAuth();
  const date = todayISO();
  const { data, loading, error, reload } = useApi(`/dashboard?date=${date}`);

  if (loading && !data) {
    return (
      <div className="page-stack">
        <Skeleton height={44} width="40%" />
        <div className="stats-grid">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} height={118} />
          ))}
        </div>
        <div className="grid two">
          <Skeleton height={280} />
          <Skeleton height={280} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Empty
        icon="info"
        title="Dashboard unavailable"
        description={error.message}
        action={<Button onClick={() => reload()}>Try again</Button>}
      />
    );
  }

  if (!data) return null;

  const { today, weekStats, streak, weight, goals, recentWorkouts, meals, activity, calorieWeek, goals: goalList } = data;
  const displayWeight = kgToDisplay(weight.latestKg, unitSystem);
  const displayChange = weight.changeKg === null ? null : kgToDisplay(weight.changeKg, unitSystem);
  const unit = weightUnit(unitSystem);

  const macroSegments = [
    { label: 'Protein', value: Math.round(today.totals.protein), color: 'var(--teal)', unit: 'g' },
    { label: 'Carbs', value: Math.round(today.totals.carbs), color: 'var(--orange)', unit: 'g' },
    { label: 'Fat', value: Math.round(today.totals.fat), color: 'var(--violet)', unit: 'g' },
  ];

  const activityData = activity.map((item) => ({
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }),
    value: item.minutes,
    date: item.date,
  }));

  const calorieData = calorieWeek.map((item) => ({
    label: fmtDate(item.date),
    value: item.calories,
    date: item.date,
  }));

  return (
    <div className="page-stack dashboard-view">
      <PageHeader
        eyebrow={`${greeting()}, ${data.greetingName}`}
        title="Your day at a glance"
        subtitle={`${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })} · ${streak.current} day streak`}
        actions={
          <div className="quick-actions">
            <Button icon="plus" onClick={() => navigate('/workouts?action=log')}>Log workout</Button>
            <Button variant="secondary" icon="utensils" onClick={() => navigate(`/nutrition?date=${date}&action=add`)}>Add meal</Button>
            <Button variant="ghost" icon="ruler" onClick={() => navigate('/progress?action=measure')}>Measure</Button>
          </div>
        }
      />

      <div className="stats-grid">
        <Stat
          label="Calories today"
          value={fmtNumber(today.totals.calories)}
          sub={`of ${fmtNumber(today.goals.calories)} kcal goal`}
          icon="flame"
          tone="accent"
        >
          <Progress value={today.totals.calories} max={today.goals.calories} className="stat-progress" color="var(--accent)" />
        </Stat>
        <Stat
          label="Workouts this week"
          value={weekStats.workouts}
          sub={`${fmtDuration(weekStats.minutes)} · ${weekStats.activeDays} active days`}
          icon="dumbbell"
        >
          <Progress value={weekStats.workouts} max={4} className="stat-progress" color="var(--teal)" />
        </Stat>
        <Stat
          label="Current streak"
          value={`${streak.current}d`}
          sub={`Personal best ${streak.best} days`}
          icon="flame"
          tone="warm"
        >
          <div className="streak-flames" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={index} className={index < streak.current ? 'is-on' : ''} />
            ))}
          </div>
        </Stat>
        <Stat
          label="Body weight"
          value={displayWeight !== null ? `${displayWeight} ${unit}` : '—'}
          sub={weight.measuredOn ? `Updated ${fmtDate(weight.measuredOn)}` : 'Log your first measurement'}
          icon="scale"
        >
          {displayChange !== null && (
            <span className={`stat-change ${displayChange <= 0 ? 'is-good' : 'is-neutral'}`}>
              <Icon name={displayChange <= 0 ? 'arrowDown' : 'arrowUp'} size={12} />
              {Math.abs(displayChange)} {unit} in 30 days
            </span>
          )}
        </Stat>
      </div>

      <div className="grid two">
        <Card>
          <CardHead
            title="Training activity"
            subtitle="Minutes trained over the last 7 days"
            icon="chart"
            actions={<Badge tone="accent">{fmtDuration(weekStats.minutes)}</Badge>}
          />
          <BarChart data={activityData} height={150} unit=" min" color="var(--accent)" emptyLabel="Log a workout to see your week" />
          <div className="card-foot-split">
            <div>
              <span className="mini-label">Volume lifted</span>
              <strong>{fmtNumber(weekStats.volume)} kg</strong>
            </div>
            <div>
              <span className="mini-label">Calories burned</span>
              <strong>{fmtNumber(weekStats.caloriesBurned)} kcal</strong>
            </div>
            <Button variant="ghost" size="sm" iconRight="chevronRight" onClick={() => navigate('/analytics')}>
              Analytics
            </Button>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Today’s fuel"
            subtitle={`${today.entries} ${today.entries === 1 ? 'entry' : 'entries'} logged`}
            icon="apple"
            actions={
              <Button variant="ghost" size="sm" icon="plus" onClick={() => navigate(`/nutrition?date=${date}&action=add`)}>
                Add
              </Button>
            }
          />
          <div className="fuel-body">
            <Donut
              segments={macroSegments}
              size={120}
              stroke={14}
              centerLabel={fmtNumber(today.totals.calories)}
              centerSub="kcal"
            />
            <div className="macro-bars">
              {[
                { key: 'protein', label: 'Protein', color: 'var(--teal)' },
                { key: 'carbs', label: 'Carbs', color: 'var(--orange)' },
                { key: 'fat', label: 'Fat', color: 'var(--violet)' },
              ].map((macro) => (
                <div key={macro.key} className="macro-row">
                  <div className="macro-row-head">
                    <span>
                      <span className="legend-dot" style={{ background: macro.color }} /> {macro.label}
                    </span>
                    <span className="mono">
                      {Math.round(today.totals[macro.key])} / {today.goals[macro.key]}g
                    </span>
                  </div>
                  <Progress value={today.totals[macro.key]} max={today.goals[macro.key]} color={macro.color} />
                </div>
              ))}
              <div className="macro-row">
                <div className="macro-row-head">
                  <span>
                    <span className="legend-dot" style={{ background: 'var(--blue)' }} /> Calories
                  </span>
                  <span className="mono">
                    {percent(today.totals.calories, today.goals.calories)}%
                  </span>
                </div>
                <Progress value={today.totals.calories} max={today.goals.calories} color="var(--blue)" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid three">
        <Card className="span-two">
          <CardHead
            title="Recent workouts"
            subtitle="Your latest sessions"
            icon="dumbbell"
            actions={
              <Button variant="ghost" size="sm" iconRight="chevronRight" onClick={() => navigate('/workouts')}>
                View all
              </Button>
            }
          />
          {recentWorkouts.length === 0 ? (
            <Empty
              icon="dumbbell"
              title="No workouts yet"
              description="Log your first session to start building momentum."
              action={<Button size="sm" onClick={() => navigate('/workouts?action=log')}>Log workout</Button>}
            />
          ) : (
            <ul className="workout-list">
              {recentWorkouts.map((log) => (
                <li key={log.id}>
                  <span className="workout-list-icon" style={{ color: CATEGORY_META[log.category]?.color || 'var(--accent)' }}>
                    <Icon name={log.category === 'cardio' ? 'activity' : 'dumbbell'} size={18} />
                  </span>
                  <div className="workout-list-copy">
                    <strong>{log.name}</strong>
                    <span>
                      {fmtDate(log.performedAt)} · {fmtDuration(log.durationMin)} · {log.totalSets} sets
                    </span>
                  </div>
                  <div className="workout-list-meta">
                    <span className="mono">{fmtNumber(log.volume)} kg</span>
                    <small>{log.caloriesBurned} kcal</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead
            title="Goals"
            subtitle={`${goalList.length} active`}
            icon="target"
            actions={
              <Button variant="ghost" size="sm" icon="plus" onClick={() => navigate('/progress?action=goal')}>
                New
              </Button>
            }
          />
          {goalList.length === 0 ? (
            <Empty icon="target" title="No active goals" description="Set a target to keep yourself accountable." />
          ) : (
            <ul className="goal-mini-list">
              {goalList.slice(0, 4).map((goal) => (
                <li key={goal.id}>
                  <div className="goal-mini-head">
                    <span>{goal.title}</span>
                    <span className="mono">{Math.round(goal.progress)}%</span>
                  </div>
                  <Progress value={goal.progress} max={100} />
                  <span className="goal-mini-sub">
                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                    {goal.deadline ? ` · by ${fmtDate(goal.deadline)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid three">
        <Card>
          <CardHead title="Today’s meals" icon="utensils" actions={<Badge tone="neutral">{today.entries}</Badge>} />
          <ul className="meal-mini-list">
            {MEALS.map((meal) => {
              const entries = meals[meal] || [];
              const calories = entries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
              return (
                <li key={meal}>
                  <span className="meal-mini-icon">
                    <Icon name={MEAL_META[meal].icon} size={16} />
                  </span>
                  <div className="meal-mini-copy">
                    <strong>{MEAL_META[meal].label}</strong>
                    <span>{entries.length ? entries.map((entry) => entry.foodName).slice(0, 2).join(', ') : 'Nothing logged'}</span>
                  </div>
                  <span className="mono">{Math.round(calories)} kcal</span>
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" size="sm" className="btn-block" onClick={() => navigate(`/nutrition?date=${date}`)}>
            Open nutrition log
          </Button>
        </Card>

        <Card>
          <CardHead title="Calories this week" icon="flame" actions={<Badge tone="neutral">7 days</Badge>} />
          <div className="calorie-spark">
            <Sparkline values={calorieData.map((item) => item.value)} height={40} />
          </div>
          <BarChart data={calorieData} height={110} color="var(--orange)" unit=" kcal" valueLabels={false} />
        </Card>

        <Card className="achievement-card">
          <CardHead title="Achievements" icon="trophy" />
          <div className="achievement-hero">
            <span className="achievement-badge">
              <Icon name="award" size={30} />
            </span>
            <div>
              <strong>{data.unlockedAchievements} unlocked</strong>
              <p>Consistency is showing up in your history.</p>
            </div>
          </div>
          <div className="achievement-progress">
            <Progress value={data.unlockedAchievements} max={9} color="var(--orange)" label="Badge collection" showValue />
          </div>
          <Button variant="ghost" size="sm" iconRight="chevronRight" onClick={() => navigate('/progress')}>
            See achievements
          </Button>
        </Card>
      </div>
    </div>
  );
}
