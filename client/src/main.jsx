import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders, useAuth } from './state';
import { useRoute } from './router';
import { AppShell } from './components/layout';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { WorkoutsPage } from './pages/Workouts';
import { NutritionPage } from './pages/Nutrition';
import { ProgressPage } from './pages/Progress';
import { AnalyticsPage } from './pages/Analytics';
import { CommunityPage } from './pages/Community';
import { NotificationsPage } from './pages/Notifications';
import { SettingsPage } from './pages/Settings';
import { ProfilePage } from './pages/Profile';
import { CoachPage } from './pages/Coach';
import { Logo } from './icons';
import { Button, Empty } from './components/ui';
import './styles.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.errorHash = window.location.hash;
    console.error('FitPulse UI error', error, info);
  }

  componentDidUpdate() {
    // A failed page should not trap the user: navigating away clears the error.
    if (this.state.error && window.location.hash !== this.errorHash) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <Logo size={48} />
          <h1>Something went sideways</h1>
          <p>{this.state.error.message}</p>
          <Button onClick={() => window.location.reload()}>Reload the app</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  const { user, loading } = useAuth();
  const route = useRoute();

  if (loading) {
    return (
      <div className="splash">
        <Logo size={52} />
        <span className="splash-loader" aria-label="Loading FitPulse" />
        <p>Warming up…</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const root = route.segments[0] || 'dashboard';

  const renderPage = () => {
    switch (root) {
      case 'dashboard':
        return <DashboardPage />;
      case 'workouts':
        return <WorkoutsPage route={route} />;
      case 'nutrition':
        return <NutritionPage route={route} />;
      case 'progress':
        return <ProgressPage route={route} />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'community':
        return <CommunityPage route={route} />;
      case 'notifications':
        return <NotificationsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return <ProfilePage route={route} />;
      case 'coach':
        return <CoachPage />;
      default:
        return (
          <Empty
            icon="info"
            title="Page not found"
            description="That link does not exist. Head back to your dashboard."
            action={<Button onClick={() => { window.location.hash = '#/dashboard'; }}>Go to dashboard</Button>}
          />
        );
    }
  };

  return (
    <AppShell route={route}>
      <ErrorBoundary>{renderPage()}</ErrorBoundary>
    </AppShell>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <Router />
      </AppProviders>
    </ErrorBoundary>
  </React.StrictMode>
);
