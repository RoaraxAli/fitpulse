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
  { value: 'users', label: 'Users' },
  { value: 'workouts', label: 'Workouts' },
  { value: 'posts', label: 'Posts' },
  { value: 'logs', label: 'Logs' },
  { value: 'tickets', label: 'Tickets' },
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
      {tab === 'users' && <UsersTab query={query} setQuery={setQuery} toast={toast} />}
      {tab === 'workouts' && <WorkoutsTab toast={toast} />}
      {tab === 'posts' && <PostsTab toast={toast} />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'tickets' && <TicketsTab />}
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

function TicketsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get('/admin/tickets?limit=50').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading && !data) return <Skeleton height={300} />;
  return (
    <Card>
      <CardHead title="Support tickets" subtitle={`${data?.total || 0} total`} icon="info" />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Subject</th><th>Type</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {(data?.items || []).map((t) => (
              <tr key={t._id || t.id}>
                <td><strong>{t.subject}</strong><small className="cell-sub">{t.message?.slice(0, 60)}</small></td>
                <td>{t.type}</td>
                <td><Badge tone={t.status === 'open' ? 'orange' : 'neutral'}>{t.status}</Badge></td>
                <td className="muted">{t.createdAt ? fmtDate(t.createdAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
