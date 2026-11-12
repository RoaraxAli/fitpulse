import React, { useEffect, useState } from 'react';
import { useApi, useToast } from '../state';
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
  Switch,
  Tabs,
} from '../components/ui';
import { Icon } from '../icons';
import { api } from '../api';
import { REMINDER_TYPES, classNames, timeAgo } from '../utils';

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const TYPE_ICON = {
  workout: 'dumbbell',
  meal: 'utensils',
  water: 'droplet',
  sleep: 'moon',
  custom: 'bell',
};

function ReminderModal({ open, initial, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', type: 'workout', timeOfDay: '18:00', days: [1, 3, 5], enabled: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title,
        type: initial.type,
        timeOfDay: initial.timeOfDay,
        days: initial.days,
        enabled: initial.enabled,
      });
    } else {
      setForm({ title: '', type: 'workout', timeOfDay: '18:00', days: [1, 3, 5], enabled: true });
    }
    setError(null);
  }, [open, initial]);

  const toggleDay = (day) => {
    setForm((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day].sort(),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Give your reminder a title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await api.patch(`/reminders/${initial.id}`, form);
      else await api.post('/reminders', form);
      toast(initial ? 'Reminder updated.' : 'Reminder created.');
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
      title={initial ? 'Edit reminder' : 'New reminder'}
      subtitle="FitPulse nudges you in-app when this time comes around."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="reminder-form" loading={saving}>{initial ? 'Save' : 'Create reminder'}</Button>
        </>
      }
    >
      <form id="reminder-form" onSubmit={submit} className="form-stack">
        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="form-grid two">
          <Field label="Title" htmlFor="reminder-title">
            <Input id="reminder-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Push day" required />
          </Field>
          <Field label="Type" htmlFor="reminder-type">
            <Select id="reminder-type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              {REMINDER_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Time" htmlFor="reminder-time">
          <Input id="reminder-time" type="time" value={form.timeOfDay} onChange={(event) => setForm((current) => ({ ...current, timeOfDay: event.target.value }))} />
        </Field>
        <Field label="Repeat on">
          <div className="day-picker">
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                className={classNames('day-chip', form.days.includes(day.value) && 'is-active')}
                onClick={() => toggleDay(day.value)}
                aria-pressed={form.days.includes(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </Field>
        <Switch checked={form.enabled} onChange={(value) => setForm((current) => ({ ...current, enabled: value }))} label="Enabled" description="Pause without deleting." />
      </form>
    </Modal>
  );
}

export function NotificationsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('notifications');
  const [filter, setFilter] = useState('all');
  const [reminderModal, setReminderModal] = useState({ open: false, initial: null });

  const notifications = useApi(`/notifications?filter=${filter === 'unread' ? 'unread' : ''}`);
  const reminders = useApi('/reminders');

  const refreshNotifications = () => notifications.reload(true);
  const refreshReminders = () => reminders.reload(true);

  const markRead = async (item) => {
    if (item.isRead) return;
    try {
      await api.patch(`/notifications/${item.id}/read`);
      refreshNotifications();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      toast('All notifications marked as read.');
      refreshNotifications();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const removeNotification = async (item) => {
    try {
      await api.del(`/notifications/${item.id}`);
      refreshNotifications();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const openNotification = (item) => {
    markRead(item);
    if (item.link) navigate(item.link);
  };

  const toggleReminder = async (reminder) => {
    try {
      await api.patch(`/reminders/${reminder.id}`, { enabled: !reminder.enabled });
      refreshReminders();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const deleteReminder = async (reminder) => {
    if (!window.confirm(`Delete the “${reminder.title}” reminder?`)) return;
    try {
      await api.del(`/reminders/${reminder.id}`);
      toast('Reminder deleted.');
      refreshReminders();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const items = notifications.data?.items || [];
  const reminderItems = reminders.data?.items || [];
  const unread = notifications.data?.unread ?? items.filter((item) => !item.isRead).length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Stay on track"
        title="Notifications"
        subtitle="Reminders, milestones and community activity."
        actions={
          tab === 'notifications' ? (
            <Button variant="secondary" icon="check" onClick={markAllRead} disabled={unread === 0}>Mark all read</Button>
          ) : (
            <Button icon="plus" onClick={() => setReminderModal({ open: true, initial: null })}>New reminder</Button>
          )
        }
      />

      <Tabs
        tabs={[
          { value: 'notifications', label: 'Notifications', count: unread },
          { value: 'reminders', label: 'Reminders', count: reminderItems.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'notifications' && (
        <>
          <div className="filter-row">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
            <Chip active={filter === 'unread'} onClick={() => setFilter('unread')}>Unread {unread > 0 && <span className="chip-badge">{unread}</span>}</Chip>
          </div>

          {notifications.loading && !notifications.data ? (
            <Skeleton height={360} />
          ) : items.length === 0 ? (
            <Empty
              icon="bell"
              title={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
              description="Log a workout or join the community to get things rolling."
            />
          ) : (
            <Card className="notif-card">
              <ul className="notif-list">
                {items.map((item) => (
                  <li key={item.id} className={classNames('notif-item', !item.isRead && 'is-unread')}>
                    <span className={`notif-icon notif-icon-${item.type}`}>
                      <Icon name={item.icon || 'bell'} size={18} />
                    </span>
                    <button type="button" className="notif-main" onClick={() => openNotification(item)}>
                      <strong>{item.title}</strong>
                      {item.body && <span>{item.body}</span>}
                      <small>{timeAgo(item.createdAt)}</small>
                    </button>
                    <div className="notif-actions">
                      {!item.isRead && <span className="unread-dot" aria-label="Unread" />}
                      <IconButton icon="close" label="Dismiss notification" size="sm" onClick={() => removeNotification(item)} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'reminders' && (
        <>
          {reminders.loading && !reminders.data ? (
            <Skeleton height={300} />
          ) : reminderItems.length === 0 ? (
            <Empty
              icon="clock"
              title="No reminders yet"
              description="Set a nudge for training, meals or hydration."
              action={<Button icon="plus" onClick={() => setReminderModal({ open: true, initial: null })}>Create a reminder</Button>}
            />
          ) : (
            <div className="reminder-grid">
              {reminderItems.map((reminder) => (
                <Card key={reminder.id} className={classNames('reminder-card', !reminder.enabled && 'is-paused')}>
                  <div className="reminder-head">
                    <span className="reminder-icon">
                      <Icon name={TYPE_ICON[reminder.type] || 'bell'} size={19} />
                    </span>
                    <div className="reminder-copy">
                      <strong>{reminder.title}</strong>
                      <span className="mono">{reminder.timeOfDay}</span>
                    </div>
                    <Switch checked={reminder.enabled} onChange={() => toggleReminder(reminder)} id={`rem-${reminder.id}`} />
                  </div>
                  <div className="reminder-days">
                    {DAYS.map((day) => (
                      <span key={day.value} className={classNames('reminder-day', reminder.days.includes(day.value) && 'is-on')}>
                        {day.label[0]}
                      </span>
                    ))}
                  </div>
                  <div className="reminder-foot">
                    <Badge tone="neutral">{reminder.type}</Badge>
                    <div className="goal-card-actions">
                      <IconButton icon="edit" label="Edit reminder" size="sm" onClick={() => setReminderModal({ open: true, initial: reminder })} />
                      <IconButton icon="trash" label="Delete reminder" size="sm" onClick={() => deleteReminder(reminder)} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <ReminderModal
        open={reminderModal.open}
        initial={reminderModal.initial}
        onClose={() => setReminderModal({ open: false, initial: null })}
        onSaved={refreshReminders}
      />
    </div>
  );
}
