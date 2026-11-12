import React, { useEffect, useState } from 'react';
import { useApi, useAuth, useDebounced, useToast } from '../state';
import { navigate } from '../router';
import {
  Avatar,
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
  Tabs,
  Textarea,
} from '../components/ui';
import { Icon } from '../icons';
import { api } from '../api';
import { POST_CATEGORIES, classNames, fmtDate, timeAgo } from '../utils';

const CATEGORY_TONE = {
  general: 'neutral',
  training: 'accent',
  nutrition: 'teal',
  progress: 'orange',
  motivation: 'violet',
  question: 'blue',
};

function ComposeModal({ open, onClose, onPosted }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', body: '', category: 'general' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({ title: '', body: '', category: 'general' });
      setError(null);
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/posts', form);
      toast('Post published.');
      onPosted();
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
      title="Share with the community"
      subtitle="Progress, questions, wins — the community grows on honesty."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="compose-form" loading={saving}>Publish</Button>
        </>
      }
    >
      <form id="compose-form" onSubmit={submit} className="form-stack">
        {error && <div className="form-alert" role="alert">{error}</div>}
        <Field label="Title" htmlFor="post-title">
          <Input id="post-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Week 6 of the cut — down 4.2 kg" maxLength={140} required />
        </Field>
        <Field label="Category" htmlFor="post-category">
          <Select id="post-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
            {POST_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Post" htmlFor="post-body" hint={`${form.body.length}/5000`}>
          <Textarea id="post-body" rows={6} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="What did you learn this week?" maxLength={5000} required />
        </Field>
      </form>
    </Modal>
  );
}

function PostCard({ post, onOpen, onLike, currentUserId }) {
  const mine = post.author && currentUserId && String(post.author.id) === String(currentUserId);
  return (
    <article className="post-card">
      <div className="post-head">
        <button
          type="button"
          className="post-author"
          onClick={() => navigate(`/profile/${post.author?.username}`)}
          disabled={!post.author?.username}
        >
          <Avatar name={post.author?.name || 'Member'} src={post.author?.avatar} size={40} />
          <span className="post-author-copy">
            <strong>{post.author?.name || 'FitPulse member'}</strong>
            <small>@{post.author?.username || 'member'} · {timeAgo(post.createdAt)}</small>
          </span>
        </button>
        <Badge tone={CATEGORY_TONE[post.category] || 'neutral'}>{post.category}</Badge>
      </div>
      <button type="button" className="post-body-button" onClick={() => onOpen(post)}>
        <h3>{post.title}</h3>
        <p>{post.body}</p>
      </button>
      <div className="post-foot">
        <button type="button" className={classNames('post-action', post.likedByMe && 'is-active')} onClick={() => onLike(post)}>
          <Icon name="heart" size={17} />
          <span>{post.likes}</span>
        </button>
        <button type="button" className="post-action" onClick={() => onOpen(post)}>
          <Icon name="message" size={17} />
          <span>{post.replies}</span>
        </button>
        {mine && (
          <span className="post-mine">
            <Icon name="user" size={14} /> Your post
          </span>
        )}
      </div>
    </article>
  );
}

function PostModal({ post, onClose, onChanged }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, loading, reload } = useApi(post ? `/posts/${post.id}` : null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setReply('');
  }, [post?.id]);

  if (!post) return null;
  const detail = data?.post || post;
  const replies = data?.replies || [];

  const sendReply = async (event) => {
    event.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/posts/${post.id}/replies`, { body: reply.trim() });
      setReply('');
      reload(true);
      onChanged();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const like = async () => {
    try {
      await api.post(`/posts/${post.id}/like`);
      reload(true);
      onChanged();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.del(`/posts/${post.id}`);
      toast('Post deleted.');
      onChanged();
      onClose();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const isMine = detail.author && user && String(detail.author.id) === String(user.id);

  return (
    <Modal
      open={Boolean(post)}
      onClose={onClose}
      title={detail.title}
      subtitle={`${detail.author?.name || 'Member'} · ${fmtDate(detail.createdAt, { year: 'numeric' })}`}
      size="lg"
      footer={isMine ? <Button variant="danger" icon="trash" onClick={remove}>Delete post</Button> : null}
    >
      <div className="post-detail">
        <div className="post-detail-meta">
          <Badge tone={CATEGORY_TONE[detail.category] || 'neutral'}>{detail.category}</Badge>
          <button type="button" className={classNames('post-action', detail.likedByMe && 'is-active')} onClick={like}>
            <Icon name="heart" size={16} /> {detail.likes} {detail.likes === 1 ? 'like' : 'likes'}
          </button>
        </div>
        <p className="post-detail-body">{detail.body}</p>
      </div>

      <div className="reply-section">
        <h4>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</h4>
        {loading && !data ? (
          <Skeleton height={80} />
        ) : replies.length === 0 ? (
          <p className="muted small">No replies yet — be the first to respond.</p>
        ) : (
          <ul className="reply-list">
            {replies.map((item) => (
              <li key={item.id}>
                <Avatar name={item.author?.name || 'Member'} src={item.author?.avatar} size={32} />
                <div className="reply-body">
                  <div className="reply-head">
                    <strong>{item.author?.name || 'Member'}</strong>
                    <span className="muted small">{timeAgo(item.createdAt)}</span>
                  </div>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={sendReply} className="reply-form">
          <Avatar name={user.name} src={user.avatar} size={32} />
          <Input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Add a reply…" aria-label="Reply" maxLength={2000} />
          <Button type="submit" icon="send" loading={sending} disabled={!reply.trim()}>Reply</Button>
        </form>
      </div>
    </Modal>
  );
}

function PeopleList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const { data, loading, reload } = useApi(`/users?q=${encodeURIComponent(debounced)}&limit=24`);

  const toggleFollow = async (person) => {
    try {
      if (person.isFollowing) await api.del(`/users/${person.id}/follow`);
      else await api.post(`/users/${person.id}/follow`);
      toast(person.isFollowing ? `Unfollowed ${person.name}.` : `Following ${person.name}.`);
      reload(true);
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const people = (data?.items || []).filter((person) => String(person.id) !== String(user.id));

  return (
    <Card>
      <CardHead
        title="People"
        subtitle="Follow others to fill your feed"
        icon="users"
        actions={
          <div className="search-inline search-inline-sm">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search people" />
          </div>
        }
      />
      {loading && !data ? (
        <Skeleton height={200} />
      ) : people.length === 0 ? (
        <Empty icon="users" title="No people found" description="Try a different name." />
      ) : (
        <ul className="people-list">
          {people.map((person) => (
            <li key={person.id}>
              <button type="button" className="people-main" onClick={() => navigate(`/profile/${person.username}`)}>
                <Avatar name={person.name} src={person.avatar} size={42} />
                <span>
                  <strong>{person.name}</strong>
                  <small>@{person.username}{person.location ? ` · ${person.location}` : ''}</small>
                  {person.bio && <span className="people-bio">{person.bio}</span>}
                </span>
              </button>
              <Button variant={person.isFollowing ? 'ghost' : 'secondary'} size="sm" icon={person.isFollowing ? 'check' : 'plus'} onClick={() => toggleFollow(person)}>
                {person.isFollowing ? 'Following' : 'Follow'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CommunityPage({ route }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState(route.query.get('tab') || 'feed');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [composeOpen, setComposeOpen] = useState(false);
  const [openPost, setOpenPost] = useState(null);

  const feed = useApi('/feed?limit=20');
  const posts = useApi(`/posts?limit=20&category=${category === 'all' ? '' : category}&sort=${sort}&q=${encodeURIComponent(debounced)}`);

  useEffect(() => {
    const value = route.query.get('tab');
    if (value) setTab(value);
  }, [route.hash]);

  const refresh = () => {
    feed.reload(true);
    posts.reload(true);
  };

  const like = async (post) => {
    try {
      await api.post(`/posts/${post.id}/like`);
      refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const items = tab === 'feed' ? feed.data?.items || [] : posts.data?.items || [];
  const listLoading = tab === 'feed' ? feed.loading && !feed.data : posts.loading && !posts.data;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Community"
        title="Train together"
        subtitle="Share progress, ask questions and cheer each other on."
        actions={<Button icon="plus" onClick={() => setComposeOpen(true)}>New post</Button>}
      />

      <div className="toolbar">
        <Tabs
          tabs={[
            { value: 'feed', label: 'Your feed', count: feed.data?.total },
            { value: 'discover', label: 'Discover', count: posts.data?.total },
            { value: 'people', label: 'People' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab !== 'people' && (
          <div className="search-inline">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search posts" aria-label="Search posts" />
          </div>
        )}
      </div>

      {tab === 'people' ? (
        <PeopleList />
      ) : (
        <>
          {tab === 'discover' && (
            <div className="filter-row">
              {['all', ...POST_CATEGORIES].map((item) => (
                <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
                  {item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}
                </Chip>
              ))}
              <span className="spacer" />
              <Select value={sort} onChange={(event) => setSort(event.target.value)} className="select-sm" aria-label="Sort posts">
                <option value="recent">Newest</option>
                <option value="popular">Most active</option>
              </Select>
            </div>
          )}

          {listLoading ? (
            <div className="post-grid">
              {[0, 1, 2].map((key) => <Skeleton key={key} height={210} />)}
            </div>
          ) : items.length === 0 ? (
            <Empty
              icon="message"
              title={tab === 'feed' ? 'Your feed is quiet' : 'No posts found'}
              description={tab === 'feed' ? 'Follow a few people or share the first update.' : 'Try a different category or search term.'}
              action={
                tab === 'feed'
                  ? <Button variant="secondary" onClick={() => setTab('people')}>Find people</Button>
                  : <Button onClick={() => setComposeOpen(true)}>Write a post</Button>
              }
            />
          ) : (
            <div className="post-grid">
              {items.map((post) => (
                <PostCard key={post.id} post={post} onOpen={setOpenPost} onLike={like} currentUserId={user.id} />
              ))}
            </div>
          )}
        </>
      )}

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onPosted={refresh} />
      <PostModal post={openPost} onClose={() => setOpenPost(null)} onChanged={refresh} />
    </div>
  );
}
