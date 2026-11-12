import React, { useEffect, useState } from 'react';
import { useAuth, useToast } from '../state';
import { navigate } from '../router';
import { Avatar, Badge, Button, Card, CardHead, Empty, PageHeader, Skeleton, Tabs, Input, IconButton } from '../components/ui';
import { Icon } from '../icons';
import { api } from '../api';
import { fmtDate, fmtNumber } from '../utils';
import { classNames } from '../utils';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'users', label: 'Users' },
  { value: 'workouts', label: 'Workouts' },
  { value: 'logs', label: 'Workout logs' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'posts', label: 'Posts' },
  { value: 'replies', label: 'Replies' },
  { value: 'goals', label: 'Goals' },
  { value: 'measurements', label: 'Measurements' },
  { value: 'foods', label: 'Foods' },
  { value: 'exercises', label: 'Exercises' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'broadcast', label: 'Broadcast' },
];

export function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="page-stack">
        <Empty icon="shield" title="Admin access required" description="You don't have permission to view this page." action={<Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administration"
        title="Admin panel"
        subtitle="Manage users, content and activity across FitPulse."
        actions={<Badge tone="accent">Admin</Badge>}
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' && <OverviewTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'users' && <UsersTab query={query} setQuery={setQuery} toast={toast} />}
      {tab === 'workouts' && <WorkoutsTab toast={toast} />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'nutrition' && <NutritionTab toast={toast} />}
      {tab === 'posts' && <PostsTab toast={toast} />}
      {tab === 'replies' && <RepliesTab toast={toast} />}
      {tab === 'goals' && <GoalsTab toast={toast} />}
      {tab === 'measurements' && <MeasurementsTab />}
      {tab === 'foods' && <FoodsTab toast={toast} />}
      {tab === 'exercises' && <ExercisesTab toast={toast} />}
      {tab === 'tickets' && <TicketsTab toast={toast} />}
      {tab === 'broadcast' && <BroadcastTab toast={toast} />}
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    api.get('/admin/stats').then((d) => { if (!cancelled) setData(d.stats); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  if (loading) return <Skeleton height={200} />;
  if (!data) return <Empty icon="info" title="Stats unavailable" />;
  const entries = [
    { label: 'Users', value: data.users, icon: 'users', tone: 'accent' },
    { label: 'Admins', value: data.admins, icon: 'shield', tone: 'violet' },
    { label: 'Workouts', value: data.workouts, icon: 'dumbbell', tone: 'teal' },
    { label: 'Logs', value: data.logs, icon: 'list', tone: 'blue' },
    { label: 'Posts', value: data.posts, icon: 'message', tone: 'orange' },
    { label: 'Nutrition entries', value: data.nutrition, icon: 'apple', tone: 'teal' },
    { label: 'Measurements', value: data.measurements, icon: 'ruler', tone: 'blue' },
    { label: 'Goals', value: data.goals, icon: 'target', tone: 'orange' },
    { label: 'Tickets', value: data.tickets, icon: 'info', tone: 'neutral' },
  ];
  return (
    <div className="stats-grid">
      {entries.map((e) => (
        <div key={e.label} className="stat">
          <div className="stat-top">
            <span className="stat-label">{e.label}</span>
            <span className="stat-icon"><Icon name={e.icon} size={17} /></span>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">{fmtNumber(e.value)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab({ query, setQuery, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const load = () => {
    setLoading(true);
    api.get(`/admin/users?page=${page}&limit=20&q=${encodeURIComponent(query)}`)
      .then(setData)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [page, query]);
  const toggleRole = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Make ${u.username} an ${newRole}?`)) return;
    try {
      await api.patch(`/admin/users/${u.id}`, { role: newRole });
      toast('Role updated.');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.username} and all their data?`)) return;
    try {
      await api.del(`/admin/users/${u.id}`);
      toast('User deleted.');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Users" subtitle={`${data?.total || 0} registered`} icon="users" actions={
        <div className="search-inline search-inline-sm">
          <Icon name="search" size={15} />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search users" />
        </div>
      } />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {(data?.items || []).map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong><small className="cell-sub">@{u.username}</small></td>
                <td className="muted">{u.email}</td>
                <td><Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Badge></td>
                <td className="muted">{u.createdAt ? fmtDate(u.createdAt) : '—'}</td>
                <td>
                  <div className="row-gap">
                    <Button size="sm" variant="ghost" onClick={() => toggleRole(u)}>{u.role === 'admin' ? 'Demote' : 'Make admin'}</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(u)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-gap" style={{ marginTop: 12 }}>
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <span className="muted small">Page {page}</span>
        <Button size="sm" variant="ghost" disabled={!data || page * 20 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </Card>
  );
}

function WorkoutsTab({ toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const load = () => {
    setLoading(true);
    api.get(`/admin/workouts?page=${page}&limit=20`).then(setData).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [page]);
  const remove = async (w) => {
    if (!window.confirm(`Delete routine "${w.name}"?`)) return;
    try { await api.del(`/admin/workouts/${w.id}`); toast('Deleted.'); load(); } catch (e) { toast(e.message, 'error'); }
  };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="All routines" subtitle={`${data?.total || 0} total`} icon="dumbbell" />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Exercises</th><th>Public</th><th>Template</th><th>Actions</th></tr></thead>
          <tbody>
            {(data?.items || []).map((w) => (
              <tr key={w.id}>
                <td><strong>{w.name}</strong></td>
                <td>{w.category}</td>
                <td className="mono">{w.exercises?.length || 0}</td>
                <td>{w.isPublic ? 'Yes' : 'No'}</td>
                <td>{w.isTemplate ? 'Yes' : 'No'}</td>
                <td><Button size="sm" variant="danger" onClick={() => remove(w)}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-gap" style={{ marginTop: 12 }}>
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <span className="muted small">Page {page}</span>
        <Button size="sm" variant="ghost" disabled={!data || page * 20 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </Card>
  );
}

function PostsTab({ toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const load = () => {
    setLoading(true);
    api.get(`/admin/posts?page=${page}&limit=20`).then(setData).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [page]);
  const remove = async (p) => {
    if (!window.confirm(`Delete post "${p.title}"?`)) return;
    try { await api.del(`/admin/posts/${p.id}`); toast('Deleted.'); load(); } catch (e) { toast(e.message, 'error'); }
  };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="All posts" subtitle={`${data?.total || 0} total`} icon="message" />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Title</th><th>Category</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {(data?.items || []).map((p) => (
              <tr key={p.id}>
                <td><strong>{p.title}</strong></td>
                <td>{p.category}</td>
                <td className="muted">{p.createdAt ? fmtDate(p.createdAt) : '—'}</td>
                <td><Button size="sm" variant="danger" onClick={() => remove(p)}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-gap" style={{ marginTop: 12 }}>
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <span className="muted small">Page {page}</span>
        <Button size="sm" variant="ghost" disabled={!data || page * 20 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </Card>
  );
}

function LogsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setLoading(true);
    api.get(`/admin/logs?page=${page}&limit=30`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [page]);
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Recent workout logs" subtitle={`${data?.total || 0} total`} icon="list" />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>User</th><th>Routine</th><th>Category</th><th>Date</th><th>Volume</th></tr></thead>
          <tbody>
            {(data?.items || []).map((l) => (
              <tr key={l.id}>
                <td className="mono small">{l.userId}</td>
                <td>{l.name}</td>
                <td>{l.category}</td>
                <td className="muted">{l.performedAt ? fmtDate(l.performedAt) : '—'}</td>
                <td className="mono">{fmtNumber(l.volume)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-gap" style={{ marginTop: 12 }}>
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <span className="muted small">Page {page}</span>
        <Button size="sm" variant="ghost" disabled={!data || page * 30 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get(`/admin/analytics?days=${days}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [days]);
  if (loading && !data) return <Skeleton height={300} />;
  const renderSeries = (series, color) => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
      {(series || []).map((p) => (
        <div key={p._id} title={`${p._id}: ${p.count}`} style={{ flex: 1, height: `${Math.max(4, (p.count / Math.max(1, ...series.map((x) => x.count))) * 76)}px`, background: color, borderRadius: 3, opacity: 0.85 }} />
      ))}
    </div>
  );
  return (
    <Card>
      <CardHead title="Activity over time" subtitle="Daily counts" icon="chart" actions={
        <div className="segmented">
          {[7, 14, 30, 90].map((d) => <button key={d} type="button" className={days === d ? 'is-active' : ''} onClick={() => setDays(d)}>{d}d</button>)}
        </div>
      } />
      <div className="page-stack">
        <div><p className="mini-label">Signups</p>{renderSeries(data?.signups, 'var(--accent)')}</div>
        <div><p className="mini-label">Workout logs</p>{renderSeries(data?.logs, 'var(--teal)')}</div>
        <div><p className="mini-label">Posts</p>{renderSeries(data?.posts, 'var(--violet)')}</div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Generic paginated admin table helper
// ---------------------------------------------------------------------------
function useAdminList(endpoint, page, extra = '') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get(`${endpoint}?page=${page}&limit=20${extra}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [endpoint, page, extra]);
  return { data, loading };
}

function NutritionTab({ toast }) {
  const [page, setPage] = useState(1);
  const { data, loading } = useAdminList('/admin/nutrition', page);
  const remove = async (n) => { if (!window.confirm('Delete this entry?')) return; try { await api.del(`/admin/nutrition/${n.id}`); toast('Deleted.'); } catch (e) { toast(e.message, 'error'); } };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Nutrition entries" subtitle={`${data?.total || 0} total`} icon="apple" />
      <div className="table-wrap"><table className="table"><thead><tr><th>Food</th><th>Meal</th><th>Kcal</th><th>Protein</th><th>Date</th><th></th></tr></thead><tbody>
        {(data?.items || []).map((n) => (<tr key={n.id}><td>{n.foodName}</td><td>{n.meal}</td><td className="mono">{Math.round(n.calories)}</td><td className="mono">{Math.round(n.protein)}g</td><td className="muted">{n.date}</td><td><Button size="sm" variant="danger" onClick={() => remove(n)}>Delete</Button></td></tr>))}
      </tbody></table></div>
      <Pager page={page} setPage={setPage} total={data?.total || 0} size={20} />
    </Card>
  );
}

function RepliesTab({ toast }) {
  const [page, setPage] = useState(1);
  const { data, loading } = useAdminList('/admin/replies', page);
  const remove = async (r) => { if (!window.confirm('Delete this reply?')) return; try { await api.del(`/admin/replies/${r.id}`); toast('Deleted.'); } catch (e) { toast(e.message, 'error'); } };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Replies" subtitle={`${data?.total || 0} total`} icon="message" />
      <div className="table-wrap"><table className="table"><thead><tr><th>Body</th><th>User</th><th>Created</th><th></th></tr></thead><tbody>
        {(data?.items || []).map((r) => (<tr key={r.id}><td>{(r.body || '').slice(0, 80)}</td><td className="mono small">{r.userId}</td><td className="muted">{r.createdAt ? fmtDate(r.createdAt) : '—'}</td><td><Button size="sm" variant="danger" onClick={() => remove(r)}>Delete</Button></td></tr>))}
      </tbody></table></div>
      <Pager page={page} setPage={setPage} total={data?.total || 0} size={20} />
    </Card>
  );
}

function GoalsTab({ toast }) {
  const [page, setPage] = useState(1);
  const { data, loading } = useAdminList('/admin/goals', page);
  const remove = async (g) => { if (!window.confirm('Delete this goal?')) return; try { await api.del(`/admin/goals/${g.id}`); toast('Deleted.'); } catch (e) { toast(e.message, 'error'); } };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Goals" subtitle={`${data?.total || 0} total`} icon="target" />
      <div className="table-wrap"><table className="table"><thead><tr><th>Title</th><th>Type</th><th>Progress</th><th>User</th><th></th></tr></thead><tbody>
        {(data?.items || []).map((g) => (<tr key={g.id}><td>{g.title}</td><td>{g.type}</td><td className="mono">{Math.round(g.progress || 0)}%</td><td className="mono small">{g.userId}</td><td><Button size="sm" variant="danger" onClick={() => remove(g)}>Delete</Button></td></tr>))}
      </tbody></table></div>
      <Pager page={page} setPage={setPage} total={data?.total || 0} size={20} />
    </Card>
  );
}

function MeasurementsTab() {
  const [page, setPage] = useState(1);
  const { data, loading } = useAdminList('/admin/measurements', page);
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Measurements" subtitle={`${data?.total || 0} total`} icon="ruler" />
      <div className="table-wrap"><table className="table"><thead><tr><th>User</th><th>Weight</th><th>Body fat</th><th>Date</th></tr></thead><tbody>
        {(data?.items || []).map((m) => (<tr key={m.id}><td className="mono small">{m.userId}</td><td className="mono">{m.weightKg ? m.weightKg + ' kg' : '—'}</td><td className="mono">{m.bodyFatPct ? m.bodyFatPct + '%' : '—'}</td><td className="muted">{m.measuredOn ? fmtDate(m.measuredOn) : '—'}</td></tr>))}
      </tbody></table></div>
      <Pager page={page} setPage={setPage} total={data?.total || 0} size={20} />
    </Card>
  );
}

function FoodsTab({ toast }) {
  const [page, setPage] = useState(1);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const { data, loading } = useAdminList('/admin/foods', page);
  const reload = () => { window.location.reload(); };
  const add = async (e) => {
    e.preventDefault();
    if (!name) return;
    try {
      await api.post('/admin/foods', { name, calories: Number(calories) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 });
      toast('Food added.'); setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); reload();
    } catch (err) { toast(err.message, 'error'); }
  };
  const remove = async (f) => { if (!window.confirm(`Delete ${f.name}?`)) return; try { await api.del(`/admin/foods/${f.id}`); toast('Deleted.'); reload(); } catch (e) { toast(e.message, 'error'); } };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Food catalog" subtitle={`${data?.total || 0} total`} icon="apple" />
      <form onSubmit={add} className="form-grid four" style={{ marginBottom: 14 }}>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Kcal" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
        <Input placeholder="Protein" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
        <Input placeholder="Carbs" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        <Input placeholder="Fat" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
        <Button type="submit" icon="plus">Add food</Button>
      </form>
      <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Kcal</th><th>P/C/F</th><th></th></tr></thead><tbody>
        {(data?.items || []).map((f) => (<tr key={f.id}><td>{f.name}</td><td className="mono">{Math.round(f.calories)}</td><td className="mono small">{Math.round(f.protein)}/{Math.round(f.carbs)}/{Math.round(f.fat)}</td><td><Button size="sm" variant="danger" onClick={() => remove(f)}>Delete</Button></td></tr>))}
      </tbody></table></div>
      <Pager page={page} setPage={setPage} total={data?.total || 0} size={20} />
    </Card>
  );
}

function ExercisesTab({ toast }) {
  const [page, setPage] = useState(1);
  const { data, loading } = useAdminList('/admin/exercises', page);
  const remove = async (e) => { if (!window.confirm(`Delete ${e.name}?`)) return; try { await api.del(`/admin/exercises/${e.id}`); toast('Deleted.'); } catch (err) { toast(err.message, 'error'); } };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Exercise catalog" subtitle={`${data?.total || 0} total`} icon="dumbbell" />
      <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Category</th><th>Muscle group</th><th></th></tr></thead><tbody>
        {(data?.items || []).map((e) => (<tr key={e.id}><td>{e.name}</td><td>{e.category}</td><td className="muted">{e.muscleGroup}</td><td><Button size="sm" variant="danger" onClick={() => remove(e)}>Delete</Button></td></tr>))}
      </tbody></table></div>
      <Pager page={page} setPage={setPage} total={data?.total || 0} size={20} />
    </Card>
  );
}

function TicketsTab({ toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); api.get('/admin/tickets?limit=50').then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  const setStatus = async (t, status) => { try { await api.patch(`/admin/tickets/${t._id || t.id}`, { status }); toast('Updated.'); } catch (e) { toast(e.message, 'error'); } };
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Support tickets" subtitle={`${data?.total || 0} total`} icon="info" />
      <div className="table-wrap"><table className="table"><thead><tr><th>Subject</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>
        {(data?.items || []).map((t) => (
          <tr key={t._id || t.id}>
            <td><strong>{t.subject}</strong><small className="cell-sub">{t.message?.slice(0, 60)}</small></td>
            <td>{t.type}</td>
            <td><Badge tone={t.status === 'open' ? 'orange' : 'neutral'}>{t.status}</Badge></td>
            <td className="muted">{t.createdAt ? fmtDate(t.createdAt) : '—'}</td>
            <td>
              <div className="row-gap">
                <Button size="sm" variant="ghost" onClick={() => setStatus(t, 'in_progress')}>In progress</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(t, 'resolved')}>Resolve</Button>
                <Button size="sm" variant="danger" onClick={() => setStatus(t, 'closed')}>Close</Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody></table></div>
    </Card>
  );
}

function BroadcastTab({ toast }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (!title || !message) return;
    setSending(true);
    try {
      const res = await api.post('/admin/notify', { title, message });
      toast(`Sent to ${res.sent} users.`);
      setTitle(''); setMessage('');
    } catch (err) { toast(err.message, 'error'); }
    finally { setSending(false); }
  };
  return (
    <Card>
      <CardHead title="Broadcast announcement" subtitle="Send a notification to every user" icon="bell" />
      <form onSubmit={send} className="form-stack">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input textarea" placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
        <Button type="submit" loading={sending} icon="send">Send to all users</Button>
      </form>
    </Card>
  );
}

function Pager({ page, setPage, total, size }) {
  return (
    <div className="row-gap" style={{ marginTop: 12 }}>
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
      <span className="muted small">Page {page} of {Math.max(1, Math.ceil(total / size))}</span>
      <Button size="sm" variant="ghost" disabled={page * size >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
    </div>
  );
}
