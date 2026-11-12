import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Logo } from '../icons';
import { avatarGradient, classNames, initials, percent } from '../utils';

export function Card({ children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={classNames('card', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHead({ title, subtitle, actions, icon }) {
  return (
    <div className="card-head">
      <div className="card-head-main">
        {icon && (
          <span className="card-icon">
            <Icon name={icon} size={18} />
          </span>
        )}
        <div>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  className = '',
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={classNames('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  );
}

export function IconButton({ icon, label, className = '', size = 'md', ...rest }) {
  return (
    <button type="button" className={classNames('btn btn-icon', `btn-icon-${size}`, className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 19} />
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor, className = '', optional }) {
  return (
    <div className={classNames('field', className)}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {optional && <span className="field-optional">optional</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={classNames('input', className)} {...rest} />;
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={classNames('input textarea', className)} rows={3} {...rest} />;
}

export function Select({ children, className = '', ...rest }) {
  return (
    <select className={classNames('input select', className)} {...rest}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label, description, disabled = false, id }) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <div className={classNames('switch-row', disabled && 'is-disabled')}>
      <div className="switch-copy">
        {label && (
          <label htmlFor={inputId} className="switch-label">
            {label}
          </label>
        )}
        {description && <p className="switch-desc">{description}</p>}
      </div>
      <label className="switch" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
        />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
      </label>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, id, disabled }) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <label className="checkbox" htmlFor={inputId}>
      <input id={inputId} type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} />
      <span className="checkbox-box" aria-hidden="true">
        <Icon name="check" size={12} strokeWidth={3} />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Avatar({ name = '', src = null, size = 40, className = '', ring = false }) {
  return (
    <span
      className={classNames('avatar', ring && 'avatar-ring', className)}
      style={{ width: size, height: size, background: src ? undefined : avatarGradient(name) }}
      aria-hidden={!name}
    >
      {src ? <img src={src} alt={name ? `${name}'s avatar` : ''} loading="lazy" /> : <span className="avatar-initials">{initials(name)}</span>}
    </span>
  );
}

export function Badge({ children, tone = 'neutral', className = '', dot = false }) {
  return (
    <span className={classNames('badge', `badge-${tone}`, className)}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Chip({ children, active = false, onClick, className = '', as: Tag = 'button' }) {
  return (
    <Tag type={Tag === 'button' ? 'button' : undefined} className={classNames('chip', active && 'is-active', className)} onClick={onClick}>
      {children}
    </Tag>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={classNames('tabs', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={classNames('tab', value === tab.value && 'is-active')}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value = 0, max = 100, color = 'var(--accent)', className = '', label, showValue = false }) {
  const pct = percent(value, max);
  return (
    <div className={classNames('progress-wrap', className)}>
      {(label || showValue) && (
        <div className="progress-meta">
          <span>{label}</span>
          {showValue && <span className="mono">{pct}%</span>}
        </div>
      )}
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'progress'}>
        <span className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function Ring({ value = 0, max = 100, size = 132, stroke = 11, color = 'var(--accent)', label, sub, children }) {
  const pct = percent(value, max);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label || 'Progress'}: ${pct}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-progress"
        />
      </svg>
      <div className="ring-content">
        {children || (
          <>
            <strong>{Math.round(value)}</strong>
            <span>{label || `/ ${max}`}</span>
            {sub && <small>{sub}</small>}
          </>
        )}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, icon, change, tone = 'default', children }) {
  const changeTone = change === undefined || change === null ? null : change >= 0 ? 'up' : 'down';
  return (
    <div className={classNames('stat', `stat-${tone}`)}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="stat-icon">
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <div className="stat-value-row">
        <span className="stat-value">{value}</span>
        {change !== undefined && change !== null && (
          <span className={classNames('stat-change', `is-${changeTone}`)}>
            <Icon name={change >= 0 ? 'arrowUp' : 'arrowDown'} size={12} />
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {sub && <span className="stat-sub">{sub}</span>}
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', eyebrow }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={classNames('modal', `modal-${size}`)} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
        <header className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2 className="modal-title">{title}</h2>}
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <IconButton icon="close" label="Close dialog" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function Empty({ icon = 'sparkles', title, description, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 24 }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="loading-block">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', className = '' }) {
  return <span className={classNames('skeleton', className)} style={{ height, width }} aria-hidden="true" />;
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="section-title-row">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LogoLockup() {
  return <Logo size={36} />;
}

export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-state" role="alert">
      <Icon name="info" size={18} />
      <div>
        <strong>Something went wrong</strong>
        <p>{error.message || 'Please try again.'}</p>
      </div>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function InfoTip({ children }) {
  return (
    <span className="info-tip" tabIndex={0}>
      <Icon name="info" size={14} />
      <span className="info-tip-bubble">{children}</span>
    </span>
  );
}

export function useUniqueId(prefix = 'id') {
  const id = useId();
  return useMemo(() => `${prefix}-${id.replace(/:/g, '')}`, [id, prefix]);
}
