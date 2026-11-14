import React, { useEffect, useRef, useState } from 'react';
import { useAuth, useApi, useDebounced, useToast } from '../state';
import { navigate, useRoute } from '../router';
import { Avatar, Badge, Button, IconButton, Modal } from '../components/ui';
import { Icon, Logo } from '../icons';
import { api } from '../api';
import { classNames, fmtDateLong, todayISO } from '../utils';

const PRIMARY_NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: 'home' },
  { path: '/coach', label: 'Coach', icon: 'sparkles' },
  { path: '/workouts', label: 'Workouts', icon: 'dumbbell' },
  { path: '/nutrition', label: 'Nutrition', icon: 'apple' },
  { path: '/progress', label: 'Progress', icon: 'target' },
  { path: '/analytics', label: 'Analytics', icon: 'chart' },
  { path: '/community', label: 'Community', icon: 'users' },
];

const SECONDARY_NAV = [
  { path: '/notifications', label: 'Notifications', icon: 'bell' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

const TITLES = {
  '/dashboard': 'Dashboard',
  '/admin': 'Admin',
  '/coach': 'Coach',
  '/workouts': 'Workouts',
  '/nutrition': 'Nutrition',
  '/progress': 'Progress',
  '/analytics': 'Analytics',
  '/community': 'Community',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

function NavItem({ item, active, badge, onClick }) {
  return (
    <a
      href={`#${item.path}`}
      className={classNames('nav-item', active && 'is-active')}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-icon">
        <Icon name={item.icon} size={19} />
      </span>
      <span className="nav-label">{item.label}</span>
      {badge ? <span className="nav-badge">{badge > 9 ? '9+' : badge}</span> : null}
    </a>
  );
}

function SearchOverlay({ open, onClose }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim(), 220);
  const { data, loading } = useApi(debounced.length >= 2 ? `/search?q=${encodeURIComponent(debounced)}` : null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const groups = data
    ? [
        { key: 'workouts', label: 'Workouts', icon: 'dumbbell', items: data.results.workouts, to: (item) => `/workouts?q=${encodeURIComponent(item.name)}` },
        { key: 'nutrition', label: 'Nutrition', icon: 'apple', items: data.results.nutrition, to: () => '/nutrition' },
        { key: 'users', label: 'People', icon: 'users', items: data.results.users, to: (item) => `/profile/${item.username}` },
        { key: 'foods', label: 'Foods', icon: 'utensils', items: data.results.foods, to: () => '/nutrition' },
        { key: 'posts', label: 'Community', icon: 'message', items: data.results.posts, to: () => '/community' },
      ].filter((group) => group.items?.length)
    : [];

  return (
    <Modal open={open} onClose={onClose} title="Search FitPulse" subtitle="Find workouts, foods, people and posts." size="lg">
      <div className="search-field">
        <Icon name="search" size={19} />
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type at least two characters…"
          autoComplete="off"
          aria-label="Search"
        />
        {loading && <span className="spinner spinner-sm" aria-label="Searching" />}
      </div>

      {query.trim().length < 2 && (
        <p className="muted center pad-md">Try “bench”, “chicken”, “Maya” or “protein”.</p>
      )}
      {query.trim().length >= 2 && !loading && data && data.total === 0 && (
        <p className="muted center pad-md">No results for “{query.trim()}”.</p>
      )}

      <div className="search-results">
        {groups.map((group) => (
          <div key={group.key} className="search-group">
            <div className="search-group-title">
              <Icon name={group.icon} size={15} /> {group.label}
            </div>
            {group.items.map((item) => (
              <button
                key={`${group.key}-${item.id}`}
                type="button"
                className="search-result"
                onClick={() => {
                  onClose();
                  navigate(group.to(item));
                }}
              >
                <span className="search-result-icon">
                  <Icon name={group.icon} size={16} />
                </span>
                <span className="search-result-body">
                  <strong>
                    {group.key === 'users'
                      ? item.name
                      : group.key === 'posts'
                        ? item.title
                        : group.key === 'foods'
                          ? item.name
                          : group.key === 'nutrition'
                            ? item.foodName
                            : item.name}
                  </strong>
                  <small>
                    {group.key === 'users'
                      ? `@${item.username}`
                      : group.key === 'foods'
                        ? `${Math.round(item.calories)} kcal per ${item.servingSize}${item.servingUnit}`
                        : group.key === 'nutrition'
                          ? `${Math.round(item.calories)} kcal · ${item.date}`
                          : group.key === 'workouts'
                            ? `${item.exercises.length} exercises · ${item.category}`
                            : `${item.category} · ${item.replies} replies`}
                  </small>
                </span>
                <Icon name="chevronRight" size={16} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function MoreSheet({ open, onClose, unread }) {
  const { user, logout } = useAuth();
  const items = [
    { path: '/analytics', label: 'Analytics', icon: 'chart' },
    { path: '/community', label: 'Community', icon: 'users' },
    { path: '/notifications', label: 'Notifications', icon: 'bell', badge: unread },
    { path: '/settings', label: 'Settings', icon: 'settings' },
    { path: `/profile/${user.username}`, label: 'My profile', icon: 'user' },
  ];
  return (
    <Modal open={open} onClose={onClose} title="More" size="sm">
      <div className="sheet-list">
        {items.map((item) => (
          <a key={item.path} href={`#${item.path}`} className="sheet-item" onClick={onClose}>
            <span className="sheet-icon">
              <Icon name={item.icon} size={19} />
            </span>
            <span>{item.label}</span>
            {item.badge ? <Badge tone="accent">{item.badge}</Badge> : <Icon name="chevronRight" size={16} />}
          </a>
        ))}
        <button
          type="button"
          className="sheet-item is-danger"
          onClick={async () => {
            onClose();
            await logout();
            navigate('/dashboard');
          }}
        >
          <span className="sheet-icon">
            <Icon name="logout" size={19} />
          </span>
          <span>Sign out</span>
        </button>
      </div>
    </Modal>
  );
}

export function AppShell({ children, route }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [unread, setUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const base = `/${route.segments[0] || 'dashboard'}`;

  const loadUnread = () => {
    api
      .get('/notifications/count')
      .then((data) => setUnread(data.unread))
      .catch(() => {});
  };

  useEffect(() => {
    loadUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.hash]);

  useEffect(() => {
    const key = 'fp-reminders-checked';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    api
      .get('/reminders/due')
      .then((data) => {
        if (data.firedCount > 0) {
          data.fired.forEach((item) => toast(item.title, 'info'));
          loadUnread();
        }
      })
      .catch(() => {});
  }, [toast]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const interval = setInterval(loadUnread, 90_000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path) => base === path || (path === '/dashboard' && base === '/');
  const today = new Date();

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Main navigation">
        <a href="#/dashboard" className="sidebar-brand">
          <Logo size={38} />
          <span className="brand-tag">Train. Fuel. Evolve.</span>
        </a>

        <nav className="nav">
          <span className="nav-section">Track</span>
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.path} item={item} active={isActive(item.path)} />
          ))}
          {user.role === 'admin' && (
            <>
              <span className="nav-section">Admin</span>
              <NavItem item={{ path: '/admin', label: 'Admin panel', icon: 'shield' }} active={isActive('/admin')} />
            </>
          )}
          <span className="nav-section">Account</span>
          {SECONDARY_NAV.map((item) => (
            <NavItem key={item.path} item={item} active={isActive(item.path)} badge={item.path === '/notifications' ? unread : 0} />
          ))}
        </nav>

      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <a href="#/dashboard" className="topbar-logo" aria-label="FitPulse home">
              <Logo size={30} withText={false} />
            </a>
            <div>
              <h1 className="topbar-title">{TITLES[base] || 'FitPulse'}</h1>
              <span className="topbar-date">{fmtDateLong(todayISO())}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Icon name="search" size={18} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <a href="#/notifications" className="btn btn-icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} title="Notifications">
              <Icon name="bell" size={19} />
              {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
            </a>
            <a href={`#/profile/${user.username}`} className="topbar-avatar" aria-label="Your profile">
              <Avatar name={user.name} src={user.avatar} size={36} />
            </a>
            <button
              type="button"
              className="btn btn-icon"
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                await logout();
                navigate('/dashboard');
              }}
            >
              <Icon name="logout" size={19} />
            </button>
          </div>
        </header>

        <main id="main-content" className="page" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[
          { path: '/dashboard', label: 'Home', icon: 'home' },
          { path: '/workouts', label: 'Train', icon: 'dumbbell' },
          { path: '/nutrition', label: 'Fuel', icon: 'apple' },
          { path: '/progress', label: 'Progress', icon: 'target' },
        ].map((item) => (
          <a key={item.path} href={`#${item.path}`} className={classNames('bottom-nav-item', isActive(item.path) && 'is-active')}>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </a>
        ))}
        <button type="button" className="bottom-nav-item" onClick={() => setMoreOpen(true)} aria-label="More navigation">
          <span className="bottom-more">
            <Icon name="more" size={20} />
            {unread > 0 && <span className="bottom-more-dot" />}
          </span>
          <span>More</span>
        </button>
      </nav>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} unread={unread} />
    </div>
  );
}
