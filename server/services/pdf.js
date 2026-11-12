'use strict';

/**
 * Tiny dependency-free PDF writer.
 * Uses the standard Helvetica fonts and simple drawing primitives, which is
 * enough for clean, printable progress reports.
 */
const clamp01 = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const ascii = (value) =>
  String(value ?? '')
    .replace(/[^\x20-\x7E\n]/g, (ch) => ({ '–': '-', '—': '-', '’': "'", '“': '"', '”': '"', '·': '-', '→': '->' }[ch] || '-'))
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

class PdfDocument {
  constructor({ width = 595.28, height = 841.89 } = {}) {
    this.width = width;
    this.height = height;
    this.pages = [];
    this.newPage();
  }

  newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.cursorY = 56;
    return this;
  }

  _color(rgb, stroke = false) {
    const [r, g, b] = Array.isArray(rgb) ? rgb : [0.1, 0.1, 0.1];
    return `${clamp01(r).toFixed(3)} ${clamp01(g).toFixed(3)} ${clamp01(b).toFixed(3)} ${stroke ? 'RG' : 'rg'}`;
  }

  text(value, x, y, { size = 10, font = 'F1', color = [0.08, 0.09, 0.08], align = 'left' } = {}) {
    const text = ascii(value);
    let drawX = x;
    if (align === 'right') drawX = x - text.length * size * 0.5;
    if (align === 'center') drawX = x - (text.length * size * 0.5) / 2;
    this.ops.push(`BT ${this._color(color)} /${font} ${size} Tf 1 0 0 1 ${drawX.toFixed(2)} ${(this.height - y).toFixed(2)} Tm (${text}) Tj ET`);
    return this;
  }

  textBlock(lines, x, y, opts = {}) {
    const { size = 10, lineHeight = size * 1.45 } = opts;
    let cursor = y;
    for (const line of lines) {
      this.text(line, x, cursor, opts);
      cursor += lineHeight;
    }
    return cursor;
  }

  rect(x, y, w, h, { fill = [0.95, 0.96, 0.95], stroke = null, lineWidth = 1, radius = 0 } = {}) {
    const bottom = this.height - y - h;
    if (radius > 0) {
      const r = Math.min(radius, w / 2, h / 2);
      const k = 0.5523 * r;
      const path = [
        `${x + r} ${bottom} m`,
        `${x + w - r} ${bottom} l`,
        `${x + w - r + k} ${bottom} ${x + w} ${bottom + r - k} ${x + w} ${bottom + r} c`,
        `${x + w} ${bottom + h - r} l`,
        `${x + w} ${bottom + h - r + k} ${x + w - r + k} ${bottom + h} ${x + w - r} ${bottom + h} c`,
        `${x + r} ${bottom + h} l`,
        `${x + r - k} ${bottom + h} ${x} ${bottom + h - r + k} ${x} ${bottom + h - r} c`,
        `${x} ${bottom + r} l`,
        `${x} ${bottom + r - k} ${x + r - k} ${bottom} ${x + r} ${bottom} c`,
        'h',
      ].join(' ');
      if (fill) this.ops.push(`${this._color(fill)} ${path} f`);
      if (stroke) this.ops.push(`${this._color(stroke, true)} ${lineWidth} w ${path} S`);
      return this;
    }
    if (fill) this.ops.push(`${this._color(fill)} ${x} ${bottom} ${w} ${h} re f`);
    if (stroke) this.ops.push(`${this._color(stroke, true)} ${lineWidth} w ${x} ${bottom} ${w} ${h} re S`);
    return this;
  }

  line(x1, y1, x2, y2, { color = [0.85, 0.87, 0.85], width = 0.7 } = {}) {
    this.ops.push(`${this._color(color, true)} ${width} w ${x1} ${this.height - y1} m ${x2} ${this.height - y2} l S`);
    return this;
  }

  dashLine(x1, y1, x2, y2, { color = [0.82, 0.84, 0.82], width = 0.6 } = {}) {
    this.ops.push(`[3 3] 0 d ${this._color(color, true)} ${width} w ${x1} ${this.height - y1} m ${x2} ${this.height - y2} l S [] 0 d`);
    return this;
  }

  polyline(points, { color = [0.25, 0.55, 0.1], width = 2 } = {}) {
    if (points.length < 2) return this;
    const [first, ...rest] = points;
    const commands = [`${first.x.toFixed(2)} ${(this.height - first.y).toFixed(2)} m`];
    rest.forEach((p) => commands.push(`${p.x.toFixed(2)} ${(this.height - p.y).toFixed(2)} l`));
    this.ops.push(`${this._color(color, true)} ${width} w ${commands.join(' ')} S`);
    return this;
  }

  circle(cx, cy, radius, { fill = [0.2, 0.4, 0.1] } = {}) {
    const k = 0.5523 * radius;
    const bottom = this.height - cy;
    const path = [
      `${cx + radius} ${bottom} m`,
      `${cx + radius} ${bottom + k} ${cx + k} ${bottom + radius} ${cx} ${bottom + radius} c`,
      `${cx - k} ${bottom + radius} ${cx - radius} ${bottom + k} ${cx - radius} ${bottom} c`,
      `${cx - radius} ${bottom - k} ${cx - k} ${bottom - radius} ${cx} ${bottom - radius} c`,
      `${cx + k} ${bottom - radius} ${cx + radius} ${bottom - k} ${cx + radius} ${bottom} c`,
      'h',
    ].join(' ');
    this.ops.push(`${this._color(fill)} ${path} f`);
    return this;
  }

  toBuffer() {
    const objects = [];
    const add = (content) => {
      objects.push(content);
      return objects.length; // 1-based object id
    };
    const catalogId = add('');
    const pagesId = add('');
    const fonts = {
      F1: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
      F2: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
      F3: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'),
    };

    const pageIds = [];
    this.pages.forEach((ops, index) => {
      const stream = ops.join('\n');
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
      const pageId = add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] ` +
          `/Resources << /Font << /F1 ${fonts.F1} 0 R /F2 ${fonts.F2} 0 R /F3 ${fonts.F3} 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
      void index;
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [0];
    objects.forEach((content, index) => {
      offsets.push(Buffer.byteLength(output, 'latin1'));
      output += `${index + 1} 0 obj\n${content}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(output, 'latin1');
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) {
      output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(output, 'latin1');
  }
}

const GREEN = [0.36, 0.62, 0.08];
const INK = [0.08, 0.1, 0.09];
const MUTED = [0.42, 0.47, 0.44];
const LIME = [0.73, 0.94, 0.35];
const TEAL = [0.31, 0.85, 0.72];

function statCard(doc, x, y, w, h, label, value, sub) {
  doc.rect(x, y, w, h, { fill: [0.975, 0.982, 0.975], radius: 8, stroke: [0.9, 0.92, 0.9] });
  doc.text(label.toUpperCase(), x + 12, y + 18, { size: 7, color: MUTED });
  doc.text(value, x + 12, y + 40, { size: 17, font: 'F2', color: INK });
  if (sub) doc.text(sub, x + 12, y + 55, { size: 7.5, color: MUTED });
}

function lineChart(doc, x, y, w, h, series, { color = GREEN, unit = '', title = '' } = {}) {
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const plotX = x + 34;
  const plotW = w - 44;
  const plotY = y + 10;
  const plotH = h - 34;

  if (title) doc.text(title, x, y - 6, { size: 9, font: 'F2', color: INK });

  for (let i = 0; i <= 3; i += 1) {
    const gy = plotY + (plotH / 3) * i;
    doc.line(plotX, gy, plotX + plotW, gy, { color: [0.9, 0.915, 0.9] });
    const val = hi - ((hi - lo) / 3) * i;
    doc.text(`${Math.round(val * 10) / 10}${unit}`, plotX - 5, gy + 3, { size: 7, color: MUTED, align: 'right' });
  }

  const points = series.map((point, index) => ({
    x: plotX + (series.length === 1 ? plotW / 2 : (index / (series.length - 1)) * plotW),
    y: plotY + plotH - ((point.value - lo) / (hi - lo || 1)) * plotH,
  }));

  // Soft area under the line.
  if (points.length > 1) {
    const area = [points[0], ...points.slice(1), { x: points[points.length - 1].x, y: plotY + plotH }, { x: points[0].x, y: plotY + plotH }];
    const cmds = area.map((p, i) => `${p.x.toFixed(1)} ${(doc.height - p.y).toFixed(1)} ${i === 0 ? 'm' : 'l'}`).join(' ');
    doc.ops.push(`0.94 0.98 0.88 rg ${cmds} h f`);
  }
  doc.polyline(points, { color, width: 2 });
  points.forEach((p) => doc.circle(p.x, p.y, 2.2, { fill: color }));

  doc.text(series[0].label, plotX, plotY + plotH + 14, { size: 7, color: MUTED });
  doc.text(series[series.length - 1].label, plotX + plotW, plotY + plotH + 14, { size: 7, color: MUTED, align: 'right' });
}

function barChart(doc, x, y, w, h, series, { color = LIME } = {}) {
  const values = series.map((p) => p.value);
  const max = Math.max(1, ...values);
  const plotY = y + 8;
  const plotH = h - 28;
  const barSpace = w / series.length;
  const barW = Math.min(24, barSpace * 0.55);
  series.forEach((point, index) => {
    const barH = (point.value / max) * plotH;
    const bx = x + index * barSpace + (barSpace - barW) / 2;
    doc.rect(bx, plotY + plotH - barH, barW, barH, { fill: color, radius: 2 });
    doc.text(String(point.value), bx + barW / 2, plotY + plotH - barH - 3, { size: 6.5, color: MUTED, align: 'center' });
    doc.text(point.label, bx + barW / 2, plotY + plotH + 10, { size: 6.5, color: MUTED, align: 'center' });
  });
  doc.line(x, plotY + plotH, x + w, plotY + plotH, { color: [0.85, 0.87, 0.85] });
}

function macroBar(doc, x, y, w, label, grams, total, color) {
  doc.text(label, x, y, { size: 8, color: INK });
  doc.text(`${Math.round(grams)} g`, x + w, y, { size: 8, color: MUTED, align: 'right' });
  doc.rect(x, y + 5, w, 5, { fill: [0.92, 0.94, 0.92], radius: 2.5 });
  const ratio = total > 0 ? Math.min(1, grams / total) : 0;
  if (ratio > 0) doc.rect(x, y + 5, Math.max(2, w * ratio), 5, { fill: color, radius: 2.5 });
}

function renderProgressReport({ user, range, stats, measurements, weeklyActivity, nutrition, goals, prs }) {
  const doc = new PdfDocument({ width: 595.28, height: 841.89 });
  const margin = 44;
  const contentW = doc.width - margin * 2;

  // Header band
  doc.rect(0, 0, doc.width, 112, { fill: [0.043, 0.06, 0.05] });
  doc.rect(0, 108, doc.width, 4, { fill: LIME });
  doc.text('FITPULSE', margin, 34, { size: 11, font: 'F2', color: LIME });
  doc.text('Progress Report', margin, 58, { size: 24, font: 'F2', color: [1, 1, 1] });
  doc.text(`${user.name} (@${user.username})  ·  ${range.start} to ${range.end}`, margin, 82, {
    size: 9,
    color: [0.72, 0.78, 0.74],
  });
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, doc.width - margin, 82, {
    size: 8,
    color: [0.6, 0.68, 0.63],
    align: 'right',
  });

  // Snapshot cards
  let y = 132;
  const gap = 10;
  const cardW = (contentW - gap * 3) / 4;
  statCard(doc, margin, y, cardW, 66, 'Workouts', String(stats.workouts), `${stats.totalMinutes} min total`);
  statCard(doc, margin + (cardW + gap), y, cardW, 66, 'Active streak', `${stats.streak?.current ?? 0}d`, `best ${stats.streak?.best ?? 0}d`);
  statCard(doc, margin + (cardW + gap) * 2, y, cardW, 66, 'Volume', `${Math.round(stats.totalVolume / 1000)}k`, 'kg lifted');
  statCard(doc, margin + (cardW + gap) * 3, y, cardW, 66, 'Weight change', stats.weightChange == null ? '—' : `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange} kg`, stats.latestWeightKg ? `now ${stats.latestWeightKg} kg` : 'no data');

  // Weight chart
  y += 92;
  doc.text('Body weight trend', margin, y, { size: 12, font: 'F2', color: INK });
  y += 20;
  const weightSeries = measurements.filter((m) => m.weightKg != null).map((m) => ({ label: m.measuredOn.slice(5), value: m.weightKg }));
  if (weightSeries.length > 1) {
    lineChart(doc, margin, y, contentW, 150, weightSeries, { color: GREEN, unit: 'kg' });
  } else {
    doc.rect(margin, y, contentW, 150, { fill: [0.97, 0.98, 0.97], radius: 8 });
    doc.text('Log at least two measurements to see your trend.', margin + 16, y + 78, { size: 9, color: MUTED });
  }

  // Weekly activity
  y += 182;
  doc.text('Weekly training activity', margin, y, { size: 12, font: 'F2', color: INK });
  y += 20;
  if (weeklyActivity.length) {
    barChart(doc, margin, y, contentW, 120, weeklyActivity);
  } else {
    doc.text('No workouts logged in this period.', margin, y + 20, { size: 9, color: MUTED });
  }

  // Nutrition
  y += 160;
  doc.text('Nutrition averages', margin, y, { size: 12, font: 'F2', color: INK });
  y += 18;
  doc.rect(margin, y, contentW, 104, { fill: [0.975, 0.982, 0.975], radius: 8, stroke: [0.9, 0.92, 0.9] });
  doc.text(`${nutrition.avgCalories} kcal`, margin + 16, y + 32, { size: 20, font: 'F2', color: INK });
  doc.text('average per day', margin + 16, y + 48, { size: 7.5, color: MUTED });
  doc.text(`${nutrition.daysLogged}`, margin + 150, y + 30, { size: 16, font: 'F2', color: INK });
  doc.text('days logged', margin + 150, y + 46, { size: 7.5, color: MUTED });
  macroBar(doc, margin + 260, y + 22, contentW - 290, 'Protein', nutrition.protein, Math.max(nutrition.protein, nutrition.carbs, nutrition.fat), [0.2, 0.65, 0.35]);
  macroBar(doc, margin + 260, y + 48, contentW - 290, 'Carbs', nutrition.carbs, Math.max(nutrition.protein, nutrition.carbs, nutrition.fat), [0.85, 0.62, 0.15]);
  macroBar(doc, margin + 260, y + 74, contentW - 290, 'Fat', nutrition.fat, Math.max(nutrition.protein, nutrition.carbs, nutrition.fat), [0.85, 0.35, 0.35]);

  // Goals + PRs
  y += 126;
  doc.text('Goals', margin, y, { size: 12, font: 'F2', color: INK });
  doc.text('Personal records', margin + contentW / 2 + 10, y, { size: 12, font: 'F2', color: INK });
  y += 16;
  const goalsToShow = goals.slice(0, 5);
  goalsToShow.forEach((goal, index) => {
    const rowY = y + index * 26;
    doc.text(goal.title, margin, rowY + 10, { size: 8.5, color: INK });
    doc.text(goal.unit ? `${goal.currentValue}/${goal.targetValue} ${goal.unit}` : `${goal.currentValue}/${goal.targetValue}`, margin, rowY + 20, { size: 7, color: MUTED });
    doc.rect(margin + 150, rowY + 6, 80, 4, { fill: [0.9, 0.92, 0.9], radius: 2 });
    doc.rect(margin + 150, rowY + 6, Math.max(1, (80 * Math.min(100, goal.progress)) / 100), 4, { fill: GREEN, radius: 2 });
  });
  if (!goalsToShow.length) doc.text('No active goals.', margin, y + 10, { size: 8, color: MUTED });

  prs.slice(0, 5).forEach((pr, index) => {
    const px = margin + contentW / 2 + 10;
    const rowY = y + index * 26;
    doc.text(pr.exerciseName, px, rowY + 10, { size: 8.5, color: INK });
    doc.text(`${pr.weight} kg × ${pr.reps} reps`, px, rowY + 20, { size: 7, color: MUTED });
    doc.text(pr.date, px + contentW / 2 - 20, rowY + 10, { size: 7, color: MUTED, align: 'right' });
  });
  if (!prs.length) doc.text('No strength records yet.', margin + contentW / 2 + 10, y + 10, { size: 8, color: MUTED });

  // Footer
  const footerY = doc.height - 36;
  doc.line(margin, footerY - 12, doc.width - margin, footerY - 12, { color: [0.9, 0.92, 0.9] });
  doc.text('Generated by FitPulse · Train. Fuel. Evolve.', margin, footerY, { size: 7, color: MUTED });
  doc.text('Page 1', doc.width - margin, footerY, { size: 7, color: MUTED, align: 'right' });

  return doc.toBuffer();
}

module.exports = { PdfDocument, renderProgressReport };
