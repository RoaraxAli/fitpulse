import React, { useEffect, useMemo, useState } from 'react';
import { useApi, useAuth, useToast } from '../state';
import { navigate } from '../router';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  Empty,
  PageHeader,
  Skeleton,
  Stat,
} from '../components/ui';
import { Icon } from '../icons';
import { api } from '../api';
import { fmtCompact, fmtDate, timeAgo } from '../utils';

function resolveUser(username) {
  return api.get(`/users?q=${encodeURIComponent(username)}&limit=10`).then((data) => {
    const match = data.items.find((item) => item.username.toLowerCase() === String(username).toLowerCase());
    return match || null;
  });
}

export function ProfilePage({ route }) {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const username = route.segments[1] || me?.username || '';
  const [resolved, setResolved] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResolveError(null);
    setProfile(null);
    if (!username) {
      setLoading(false);
      return () => {};
    }
    resolveUser(username)
      .then(async (match) => {
        if (!active) return;
        if (!match) {
          setResolveError('That profile could not be found.');
          setLoading(false);
          return;
        }
        setResolved(match);
        const data = await api.get(`/users/${match.id}`);
        if (!active) return;
        setProfile(data);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setResolveError(error.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  const refresh = async () => {
    if (!resolved) return;
    const data = await api.get(`/users/${resolved.id}`);
    setProfile(data);
  };

  const toggleFollow = async () => {
    if (!resolved || !profile) return;
    try {
      if (profile.isFollowing) await api.del(`/users/${resolved.id}/follow`);
      else await api.post(`/users/${resolved.id}/follow`);
      toast(profile.isFollowing ? `Unfollowed ${profile.user.name}.` : `Following ${profile.user.name}.`);
      refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const isSelf = profile?.isSelf || (me && resolved && String(me.id) === String(resolved.id));

  if (loading) {
    return (
      <div className="page-stack">
        <Skeleton height={200} />
        <div className="stats-grid">{[0, 1, 2, 3].map((key) => <Skeleton key={key} height={110} />)}</div>
        <Skeleton height={220} />
      </div>
    );
  }

  if (resolveError || !profile) {
    return (
      <Empty
        icon="user"
        title="Profile not found"
        description={resolveError || 'This member may have deleted their account.'}
        action={<Button onClick={() => navigate('/community')}>Back to community</Button>}
      />
    );
  }

  const person = profile.user;
  const stats = profile.stats;

  return (
    <div className="page-stack">
      <Card className="profile-hero">
        <div className="profile-hero-main">
          <Avatar name={person.name} src={person.avatar} size={104} ring />
          <div className="profile-hero-copy">
            <div className="profile-hero-title">
              <h1>{person.name}</h1>
              {!person.isPublic && <Badge tone="neutral"><Icon name="lock" size={12} /> Private</Badge>}
              {isSelf && <Badge tone="accent">You</Badge>}
            </div>
            <span className="profile-handle">@{person.username}</span>
            {person.bio && <p className="profile-bio">{person.bio}</p>}
            <div className="profile-meta">
              {person.location && <span><Icon name="info" size={14} /> {person.location}</span>}
              <span><Icon name="calendar" size={14} /> Joined {fmtDate(person.createdAt, { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
        <div className="profile-hero-actions">
          {isSelf ? (
            <>
              <Button variant="secondary" icon="edit" onClick={() => navigate('/settings')}>Edit profile</Button>
              <Button variant="ghost" icon="settings" onClick={() => navigate('/settings')}>Settings</Button>
            </>
          ) : (
            <Button variant={profile.isFollowing ? 'ghost' : 'primary'} icon={profile.isFollowing ? 'check' : 'plus'} onClick={toggleFollow}>
              {profile.isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>
      </Card>

      {profile.private ? (
        <Card>
          <Empty
            icon="lock"
            title="This profile is private"
            description={`Follow @${person.username} to see their training stats and posts.`}
            action={!profile.isFollowing ? <Button icon="plus" onClick={toggleFollow}>Follow to view</Button> : null}
          />
        </Card>
      ) : (
        <>
          <div className="stats-grid">
            <Stat label="Workouts" value={fmtCompact(stats?.workouts ?? 0)} icon="dumbbell" sub={`${fmtCompact(stats?.totalVolume ?? 0)} kg lifted`} />
            <Stat label="Training time" value={`${fmtCompact(stats?.totalMinutes ?? 0)} min`} icon="clock" sub={`${fmtCompact(stats?.totalCalories ?? 0)} kcal burned`} />
            <Stat label="Followers" value={fmtCompact(stats?.followers ?? 0)} icon="users" sub={`${stats?.following ?? 0} following`} />
            <Stat
              label="Body weight"
              value={stats?.latestWeightKg != null ? `${stats.latestWeightKg} kg` : '—'}
              icon="scale"
              sub={
                stats?.weightChange != null
                  ? `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange} kg change`
                  : 'No measurements'
              }
            />
          </div>

          <div className="grid two">
            <Card>
              <CardHead title="Achievements" subtitle={`${profile.achievements?.length || 0} unlocked`} icon="award" />
              {(profile.achievements || []).length === 0 ? (
                <Empty icon="award" title="No badges yet" description={isSelf ? 'Log workouts to start earning badges.' : 'Their badges will appear here.'} />
              ) : (
                <div className="achievement-grid compact">
                  {profile.achievements.map((achievement) => (
                    <div key={achievement.key} className="achievement is-unlocked">
                      <span className="achievement-icon"><Icon name={achievement.icon} size={20} /></span>
                      <div>
                        <strong>{achievement.title}</strong>
                        {achievement.unlockedAt && <span className="achievement-date">{fmtDate(achievement.unlockedAt, { year: 'numeric' })}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHead
                title="Recent posts"
                subtitle={isSelf ? 'Your latest updates' : `${person.name.split(' ')[0]}’s latest`}
                icon="message"
                actions={<Button variant="ghost" size="sm" iconRight="chevronRight" onClick={() => navigate('/community')}>Community</Button>}
              />
              {(profile.posts || []).length === 0 ? (
                <Empty icon="message" title="No posts yet" description={isSelf ? 'Share an update with the community.' : 'No public posts from this member.'} />
              ) : (
                <ul className="profile-post-list">
                  {profile.posts.map((post) => (
                    <li key={post.id}>
                      <div className="profile-post-head">
                        <Badge tone="neutral">{post.category}</Badge>
                        <small>{timeAgo(post.createdAt)}</small>
                      </div>
                      <strong>{post.title}</strong>
                      <p>{post.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {stats && (
            <Card>
              <CardHead title="At a glance" subtitle="Lifetime training summary" icon="chart" />
              <div className="glance-grid">
                <div><span className="mini-label">Sessions</span><strong>{fmtCompact(stats.workouts)}</strong></div>
                <div><span className="mini-label">Volume</span><strong>{fmtCompact(stats.totalVolume)} kg</strong></div>
                <div><span className="mini-label">Minutes</span><strong>{fmtCompact(stats.totalMinutes)}</strong></div>
                <div><span className="mini-label">Calories</span><strong>{fmtCompact(stats.totalCalories)}</strong></div>
                <div><span className="mini-label">Posts</span><strong>{fmtCompact(stats.posts)}</strong></div>
                <div><span className="mini-label">Member for</span><strong>{fmtCompact(stats.memberDays)} days</strong></div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
