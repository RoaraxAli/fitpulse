import React, { useEffect, useRef, useState } from 'react';
import { useApi, useAuth, useToast } from '../state';
import { navigate } from '../router';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  Empty,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
} from '../components/ui';
import { Icon } from '../icons';
import { api } from '../api';
import { fmtDate, timeAgo } from '../utils';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function SettingsPage() {
  const { user, mergeUser, logout, refresh } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState('profile');

  const settingsApi = useApi('/settings');
  const ticketsApi = useApi('/support/tickets');
  const fileRef = useRef(null);

  const [profile, setProfile] = useState({ name: '', bio: '', location: '', heightCm: '', birthdate: '', gender: '' });
  const [prefs, setPrefs] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [ticket, setTicket] = useState({ type: 'support', subject: '', message: '' });
  const [sendingTicket, setSendingTicket] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name || '',
      bio: user.bio || '',
      location: user.location || '',
      heightCm: user.heightCm ?? '',
      birthdate: user.birthdate || '',
      gender: user.gender || '',
    });
  }, [user]);

  useEffect(() => {
    if (settingsApi.data?.settings) {
      setPrefs({
        ...settingsApi.data.settings,
        unitSystem: settingsApi.data.profile.unitSystem,
        theme: settingsApi.data.profile.theme,
        isPublic: settingsApi.data.profile.isPublic,
      });
    }
  }, [settingsApi.data]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const result = await api.patch('/users/me', {
        name: profile.name,
        bio: profile.bio,
        location: profile.location,
        heightCm: profile.heightCm === '' ? null : Number(profile.heightCm),
        birthdate: profile.birthdate || null,
        gender: profile.gender || null,
      });
      mergeUser(result.user);
      toast('Profile updated.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePrefs = async () => {
    if (!prefs) return;
    setSavingPrefs(true);
    try {
      await api.patch('/settings', {
        unitSystem: prefs.unitSystem,
        theme: prefs.theme,
        isPublic: prefs.isPublic,
        timezone: prefs.timezone,
        weekStart: prefs.weekStart,
        calorieGoal: prefs.calorieGoal,
        proteinGoal: prefs.proteinGoal,
        carbsGoal: prefs.carbsGoal,
        fatGoal: prefs.fatGoal,
        waterGoal: prefs.waterGoal,
        stepGoal: prefs.stepGoal,
        notifyWorkout: prefs.notifyWorkout,
        notifyMeal: prefs.notifyMeal,
        notifyGoals: prefs.notifyGoals,
        notifySocial: prefs.notifySocial,
        notifyEmail: prefs.notifyEmail,
      });
      mergeUser({ unitSystem: prefs.unitSystem, theme: prefs.theme, isPublic: prefs.isPublic, settings: prefs });
      toast('Preferences saved.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError(null);
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch('/auth/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast('Password updated.');
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast('Images must be 3 MB or smaller.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { avatar } = await api.post('/users/me/avatar', { image: reader.result });
        mergeUser({ avatar });
        toast('Avatar updated.');
      } catch (error) {
        toast(error.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = async () => {
    try {
      await api.del('/users/me/avatar');
      mergeUser({ avatar: null });
      toast('Avatar removed.');
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const submitTicket = async (event) => {
    event.preventDefault();
    if (!ticket.subject.trim() || !ticket.message.trim()) {
      toast('Add a subject and a message.', 'error');
      return;
    }
    setSendingTicket(true);
    try {
      await api.post('/support/tickets', ticket);
      toast('Message sent — we will follow up soon.');
      setTicket({ type: 'support', subject: '', message: '' });
      ticketsApi.reload(true);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSendingTicket(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/dashboard');
  };

  if (!user) return null;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Your account"
        title="Settings"
        subtitle="Profile, preferences, privacy and support."
      />

      <Tabs
        tabs={[
          { value: 'profile', label: 'Profile' },
          { value: 'preferences', label: 'Preferences' },
          { value: 'notifications', label: 'Notifications' },
          { value: 'security', label: 'Security' },
          { value: 'support', label: 'Support' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <>
          <Card>
            <CardHead title="Public profile" subtitle="How you appear across FitPulse" icon="user" />
            <div className="avatar-editor">
              <Avatar name={user.name} src={user.avatar} size={92} ring />
              <div className="avatar-editor-actions">
                <strong>{user.name}</strong>
                <span className="muted">@{user.username} · {user.email}</span>
                <div className="row-gap">
                  <Button variant="secondary" size="sm" icon="camera" onClick={() => fileRef.current?.click()}>Change photo</Button>
                  {user.avatar && <Button variant="ghost" size="sm" icon="trash" onClick={removeAvatar}>Remove</Button>}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={(event) => uploadAvatar(event.target.files?.[0])}
                />
              </div>
            </div>

            <form onSubmit={saveProfile} className="form-stack pad-top">
              <div className="form-grid two">
                <Field label="Name" htmlFor="profile-name">
                  <Input id="profile-name" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Location" htmlFor="profile-location" optional>
                  <Input id="profile-location" value={profile.location} onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))} placeholder="Austin, TX" />
                </Field>
              </div>
              <Field label="Bio" htmlFor="profile-bio" optional hint={`${profile.bio.length}/500`}>
                <Textarea id="profile-bio" rows={3} value={profile.bio} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} maxLength={500} />
              </Field>
              <div className="form-grid three">
                <Field label="Height (cm)" htmlFor="profile-height" optional>
                  <Input id="profile-height" type="number" min="50" max="260" value={profile.heightCm} onChange={(event) => setProfile((current) => ({ ...current, heightCm: event.target.value }))} />
                </Field>
                <Field label="Birthdate" htmlFor="profile-birthdate" optional>
                  <Input id="profile-birthdate" type="date" value={profile.birthdate || ''} onChange={(event) => setProfile((current) => ({ ...current, birthdate: event.target.value }))} />
                </Field>
                <Field label="Gender" htmlFor="profile-gender" optional>
                  <Select id="profile-gender" value={profile.gender || ''} onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value }))}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </Select>
                </Field>
              </div>
              <div className="form-actions">
                <Button type="submit" loading={savingProfile}>Save profile</Button>
                <Button variant="ghost" onClick={() => navigate(`/profile/${user.username}`)}>View public profile</Button>
              </div>
            </form>
          </Card>
        </>
      )}

      {tab === 'preferences' && (
        !prefs ? (
          <Skeleton height={320} />
        ) : (
          <>
            <Card>
              <CardHead title="Units & appearance" icon="settings" />
              <div className="form-grid two">
                <Field label="Unit system" htmlFor="pref-units">
                  <Select id="pref-units" value={prefs.unitSystem} onChange={(event) => setPrefs((current) => ({ ...current, unitSystem: event.target.value }))}>
                    <option value="metric">Metric (kg, cm)</option>
                    <option value="imperial">Imperial (lb, in)</option>
                  </Select>
                </Field>
                <Field label="Theme" htmlFor="pref-theme">
                  <Select id="pref-theme" value={prefs.theme} onChange={(event) => setPrefs((current) => ({ ...current, theme: event.target.value }))}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">Match system</option>
                  </Select>
                </Field>
                <Field label="Timezone" htmlFor="pref-timezone">
                  <Select id="pref-timezone" value={prefs.timezone} onChange={(event) => setPrefs((current) => ({ ...current, timezone: event.target.value }))}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </Select>
                </Field>
                <Field label="Week starts on" htmlFor="pref-week">
                  <Select id="pref-week" value={prefs.weekStart} onChange={(event) => setPrefs((current) => ({ ...current, weekStart: Number(event.target.value) }))}>
                    <option value={1}>Monday</option>
                    <option value={0}>Sunday</option>
                    <option value={6}>Saturday</option>
                  </Select>
                </Field>
              </div>
              <Switch
                checked={prefs.isPublic}
                onChange={(value) => setPrefs((current) => ({ ...current, isPublic: value }))}
                label="Public profile"
                description="Let other members view your stats and posts. Turn off to keep training data private."
              />
            </Card>

            <Card>
              <CardHead title="Daily targets" subtitle="Used across your dashboard and nutrition views" icon="target" />
              <div className="form-grid three">
                <Field label="Calories (kcal)" htmlFor="goal-cal">
                  <Input id="goal-cal" type="number" min="0" value={prefs.calorieGoal} onChange={(event) => setPrefs((current) => ({ ...current, calorieGoal: Number(event.target.value) }))} />
                </Field>
                <Field label="Protein (g)" htmlFor="goal-protein">
                  <Input id="goal-protein" type="number" min="0" value={prefs.proteinGoal} onChange={(event) => setPrefs((current) => ({ ...current, proteinGoal: Number(event.target.value) }))} />
                </Field>
                <Field label="Carbs (g)" htmlFor="goal-carbs">
                  <Input id="goal-carbs" type="number" min="0" value={prefs.carbsGoal} onChange={(event) => setPrefs((current) => ({ ...current, carbsGoal: Number(event.target.value) }))} />
                </Field>
                <Field label="Fat (g)" htmlFor="goal-fat">
                  <Input id="goal-fat" type="number" min="0" value={prefs.fatGoal} onChange={(event) => setPrefs((current) => ({ ...current, fatGoal: Number(event.target.value) }))} />
                </Field>
                <Field label="Water (ml)" htmlFor="goal-water">
                  <Input id="goal-water" type="number" min="0" value={prefs.waterGoal} onChange={(event) => setPrefs((current) => ({ ...current, waterGoal: Number(event.target.value) }))} />
                </Field>
                <Field label="Steps" htmlFor="goal-steps">
                  <Input id="goal-steps" type="number" min="0" value={prefs.stepGoal} onChange={(event) => setPrefs((current) => ({ ...current, stepGoal: Number(event.target.value) }))} />
                </Field>
              </div>
            </Card>

            <div className="form-actions sticky-actions">
              <Button loading={savingPrefs} onClick={savePrefs}>Save preferences</Button>
            </div>
          </>
        )
      )}

      {tab === 'notifications' && (
        !prefs ? (
          <Skeleton height={280} />
        ) : (
          <Card>
            <CardHead title="Notification preferences" subtitle="Choose what FitPulse tells you about" icon="bell" />
            <div className="switch-list">
              <Switch checked={prefs.notifyWorkout} onChange={(value) => setPrefs((current) => ({ ...current, notifyWorkout: value }))} label="Workout reminders" description="Nudges for scheduled training and reminder times." />
              <Switch checked={prefs.notifyMeal} onChange={(value) => setPrefs((current) => ({ ...current, notifyMeal: value }))} label="Meal reminders" description="Gentle prompts to log meals." />
              <Switch checked={prefs.notifyGoals} onChange={(value) => setPrefs((current) => ({ ...current, notifyGoals: value }))} label="Goal milestones" description="Celebrate when you hit a target." />
              <Switch checked={prefs.notifySocial} onChange={(value) => setPrefs((current) => ({ ...current, notifySocial: value }))} label="Community activity" description="Likes, replies and new followers." />
              <Switch checked={prefs.notifyEmail} onChange={(value) => setPrefs((current) => ({ ...current, notifyEmail: value }))} label="Email digest" description="A weekly summary by email (optional)." />
            </div>
            <div className="form-actions">
              <Button loading={savingPrefs} onClick={savePrefs}>Save preferences</Button>
            </div>
          </Card>
        )
      )}

      {tab === 'security' && (
        <>
          <Card>
            <CardHead title="Change password" subtitle="Use at least 8 characters with a letter and a number" icon="lock" />
            <form onSubmit={changePassword} className="form-stack">
              {passwordError && <div className="form-alert" role="alert">{passwordError}</div>}
              <Field label="Current password" htmlFor="pw-current">
                <Input id="pw-current" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" required />
              </Field>
              <div className="form-grid two">
                <Field label="New password" htmlFor="pw-new">
                  <Input id="pw-new" type="password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" required />
                </Field>
                <Field label="Confirm new password" htmlFor="pw-confirm">
                  <Input id="pw-confirm" type="password" value={passwords.confirm} onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))} autoComplete="new-password" required />
                </Field>
              </div>
              <div className="form-actions">
                <Button type="submit" loading={savingPassword} disabled={!passwords.currentPassword || !passwords.newPassword}>Update password</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHead title="Your data" subtitle="Download or manage the information you have logged" icon="shield" />
            <div className="data-actions">
              <a className="btn btn-secondary" href="api/reports/summary.pdf" download>
                <Icon name="download" size={17} /> <span>Progress report (PDF)</span>
              </a>
              <a className="btn btn-ghost" href="api/reports/workouts.csv" download>
                <Icon name="download" size={17} /> <span>Workouts (CSV)</span>
              </a>
              <a className="btn btn-ghost" href="api/reports/nutrition.csv" download>
                <Icon name="download" size={17} /> <span>Nutrition (CSV)</span>
              </a>
              <a className="btn btn-ghost" href="api/reports/measurements.csv" download>
                <Icon name="download" size={17} /> <span>Measurements (CSV)</span>
              </a>
            </div>
            <p className="muted small">
              Account since {fmtDate(user.createdAt, { year: 'numeric' })}{user.lastLoginAt ? ` · last sign-in ${timeAgo(user.lastLoginAt)}` : ''}.
            </p>
            <div className="form-actions">
              <Button variant="secondary" icon="refresh" onClick={() => refresh()}>Refresh account data</Button>
              <Button variant="danger" icon="logout" onClick={signOut}>Sign out</Button>
            </div>
          </Card>
        </>
      )}

      {tab === 'support' && (
        <>
          <Card>
            <CardHead title="Contact support" subtitle="Report a bug, ask a question or send feedback" icon="message" />
            <form onSubmit={submitTicket} className="form-stack">
              <div className="form-grid two">
                <Field label="Type" htmlFor="ticket-type">
                  <Select id="ticket-type" value={ticket.type} onChange={(event) => setTicket((current) => ({ ...current, type: event.target.value }))}>
                    <option value="support">Support</option>
                    <option value="bug">Bug report</option>
                    <option value="feedback">Feedback</option>
                    <option value="feature">Feature request</option>
                  </Select>
                </Field>
                <Field label="Subject" htmlFor="ticket-subject">
                  <Input id="ticket-subject" value={ticket.subject} onChange={(event) => setTicket((current) => ({ ...current, subject: event.target.value }))} placeholder="Short summary" maxLength={120} required />
                </Field>
              </div>
              <Field label="Message" htmlFor="ticket-message" hint={`${ticket.message.length}/4000`}>
                <Textarea id="ticket-message" rows={5} value={ticket.message} onChange={(event) => setTicket((current) => ({ ...current, message: event.target.value }))} maxLength={4000} required />
              </Field>
              <div className="form-actions">
                <Button type="submit" icon="send" loading={sendingTicket}>Send message</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHead title="Your requests" subtitle="History of your support tickets" icon="list" />
            {ticketsApi.loading && !ticketsApi.data ? (
              <Skeleton height={120} />
            ) : (ticketsApi.data?.items || []).length === 0 ? (
              <Empty icon="message" title="No requests yet" description="Anything you send will appear here." />
            ) : (
              <ul className="ticket-list">
                {(ticketsApi.data?.items || []).map((item) => (
                  <li key={item.id}>
                    <div className="ticket-head">
                      <strong>{item.subject}</strong>
                      <Badge tone={item.status === 'open' ? 'accent' : 'neutral'}>{item.status}</Badge>
                    </div>
                    <p>{item.message}</p>
                    <small>{item.type} · {timeAgo(item.createdAt)}</small>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
