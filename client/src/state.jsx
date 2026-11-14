import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
const ToastContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AppProviders');
  return ctx;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside AppProviders');
  return ctx;
}

let toastId = 0;

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message, type = 'success') => {
      toastId += 1;
      const id = toastId;
      setToasts((current) => [...current.slice(-3), { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), 4200);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  useEffect(() => () => timers.current.forEach((timer) => clearTimeout(timer)), []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.type}`} role="status">
            <span className="toast-dot" aria-hidden="true" />
            <span className="toast-message">{item.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(item.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function applyTheme(theme) {
  const resolved = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const brandColors = { primary: '#faf7f0', secondary: '#2457d6', text: '#222a38', ...(window.__FITPULSE_BRAND_COLORS__ || {}) };
  document.documentElement.style.setProperty('--primary', brandColors.primary);
  document.documentElement.style.setProperty('--secondary', brandColors.secondary);
  document.documentElement.style.setProperty('--text-color', brandColors.text);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', brandColors.primary);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setStats(data.stats);
      return data.user;
    } catch (error) {
      if (error.status !== 401) console.error(error);
      setUser(null);
      setStats(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    applyTheme(user?.theme || localStorage.getItem('fp-theme') || 'light');
    localStorage.setItem('fp-theme', user?.theme || localStorage.getItem('fp-theme') || 'dark');
  }, [user?.theme]);

  const login = useCallback(async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password });
    setUser(data.user);
    const me = await api.get('/auth/me').catch(() => null);
    if (me) setStats(me.stats);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setUser(data.user);
    setStats(null);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setStats(null);
  }, []);

  const mergeUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo(
    () => ({
      user,
      stats,
      loading,
      login,
      register,
      logout,
      refresh,
      mergeUser,
      setUser,
      unitSystem: user?.unitSystem || 'metric',
    }),
    [user, stats, loading, login, register, logout, refresh, mergeUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}

export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });

  const reload = useCallback(
    async (silent = false) => {
      if (!path) {
        setState({ data: null, loading: false, error: null });
        return null;
      }
      if (!silent) setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await api.get(path);
        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        setState({ data: null, loading: false, error });
        return null;
      }
    },
    [path]
  );

  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    setState((current) => ({ ...current, loading: true }));
    api
      .get(path)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ data: null, loading: false, error });
      });
    return () => {
      active = false;
    };
  }, [path]);

  return { ...state, reload, setData: (data) => setState({ data, loading: false, error: null }) };
}

export function useDebounced(value, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
