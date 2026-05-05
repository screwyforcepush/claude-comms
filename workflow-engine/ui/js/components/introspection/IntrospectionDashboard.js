import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { LoadingSkeleton, QIcon } from '../shared/index.js';

const WINDOW_OPTIONS = [10, 25, 50, 100];
const HARNESSES = ['all', 'claude', 'codex', 'gemini'];
const JOB_TYPES = ['all', 'implement', 'pm', 'review', 'uat', 'plan', 'document'];

const ANCHOR_RUBRIC_LABELS = {
  assignmentMatchedWork: 'Assignment matched work',
  projectStateClean: 'Project state clean',
  followedConventions: 'Followed conventions',
  docsSufficient: 'Docs were sufficient',
};

const RISK_RUBRIC_LABELS = {
  intentInferred: 'Intent had to be inferred',
  toolErrorsBlocked: 'Tool errors blocked progress',
  toolRepetitionRequired: 'Tool repetition required',
  neededToolMissing: 'Needed tool missing',
  toolOutputNoise: 'Tool output noise',
  toolOutputInsufficient: 'Tool output insufficient',
  undocumentedSetup: 'Undocumented setup',
  hiddenContextDiscovered: 'Hidden context discovered',
  priorStateInterfered: 'Prior state interfered',
  repeatedWork: 'Repeated work',
  wrongPathFirst: 'Wrong path first',
  contextLoadingExcessive: 'Context loading excessive',
  sameApproachAgain: 'Same approach likely again',
  overengineeredPart: 'Overengineered part',
  underdeliveredPart: 'Underdelivered part',
  assumedUnverified: 'Assumed unverified',
};

const GAP_REASON_LABELS = {
  unsupported_harness: 'Unsupported harness',
  missing_session_id: 'Missing session',
  reflection_missing: 'Reflection missing',
};

const TONE_CLASS = {
  copper: 'glow--copper',
  torch: 'glow--torch',
  slime: 'glow--slime',
  lava: 'glow--lava',
  teleport: '',
};

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatPct(value) {
  return `${Math.round(clampPercent((value || 0) * 100))}%`;
}

function formatCount(value) {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString();
}

function formatAverage(value, suffix = '') {
  if (!Number.isFinite(value)) return 'n/a';
  return `${Math.round(value).toLocaleString()}${suffix}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return 'n/a';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(value) {
  if (!Number.isFinite(value)) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function humanizeKey(key) {
  if (!key) return 'Unknown';
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeKeyword(keyword) {
  return String(keyword || '').trim().toLowerCase();
}

function previewText(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return undefined;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function countMapToRows(map) {
  return Object.entries(map)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function summarizeReflections(rows, gaps) {
  const keywordCounts = {};
  const jobTypeCounts = {};
  const harnessCounts = {};
  const rubricCounts = {};
  const rubricByJobType = {};
  const jobTypeGroups = {};
  const riskKeys = new Set(Object.keys(RISK_RUBRIC_LABELS));
  const anchorKeys = new Set(Object.keys(ANCHOR_RUBRIC_LABELS));

  for (const row of rows) {
    const jobType = row.jobType || 'unknown';
    if (!jobTypeGroups[jobType]) {
      jobTypeGroups[jobType] = {
        jobType,
        count: 0,
        riskYes: 0,
        riskAnswered: 0,
        anchorYes: 0,
        anchorAnswered: 0,
        keywordCounts: {},
        riskCounts: {},
        tokens: [],
        toolCalls: [],
        durations: [],
      };
    }

    const jobGroup = jobTypeGroups[jobType];
    jobGroup.count += 1;
    if (Number.isFinite(row.totalTokens)) jobGroup.tokens.push(row.totalTokens);
    if (Number.isFinite(row.toolCallCount)) jobGroup.toolCalls.push(row.toolCallCount);
    if (Number.isFinite(row.durationMs)) jobGroup.durations.push(row.durationMs);

    jobTypeCounts[jobType] = (jobTypeCounts[jobType] || 0) + 1;
    harnessCounts[row.harness || 'unknown'] = (harnessCounts[row.harness || 'unknown'] || 0) + 1;

    for (const keyword of row.keywords || []) {
      const normalized = normalizeKeyword(keyword);
      if (!normalized) continue;
      keywordCounts[normalized] = (keywordCounts[normalized] || 0) + 1;
      jobGroup.keywordCounts[normalized] = (jobGroup.keywordCounts[normalized] || 0) + 1;
    }

    for (const [key, value] of Object.entries(row.rubric || {})) {
      if (!rubricCounts[key]) {
        rubricCounts[key] = {
          key,
          label: ANCHOR_RUBRIC_LABELS[key] || RISK_RUBRIC_LABELS[key] || humanizeKey(key),
          trueCount: 0,
          falseCount: 0,
          total: 0,
          isAnchor: Boolean(ANCHOR_RUBRIC_LABELS[key]),
        };
      }
      if (!rubricByJobType[key]) {
        rubricByJobType[key] = {
          key,
          label: ANCHOR_RUBRIC_LABELS[key] || RISK_RUBRIC_LABELS[key] || humanizeKey(key),
          isAnchor: Boolean(ANCHOR_RUBRIC_LABELS[key]),
          isRisk: Boolean(RISK_RUBRIC_LABELS[key]),
          cells: {},
          trueCount: 0,
          total: 0,
        };
      }
      if (!rubricByJobType[key].cells[jobType]) {
        rubricByJobType[key].cells[jobType] = { trueCount: 0, total: 0, rate: 0 };
      }

      rubricCounts[key].total += 1;
      rubricByJobType[key].total += 1;
      rubricByJobType[key].cells[jobType].total += 1;
      if (value) {
        rubricCounts[key].trueCount += 1;
        rubricByJobType[key].trueCount += 1;
        rubricByJobType[key].cells[jobType].trueCount += 1;
      } else {
        rubricCounts[key].falseCount += 1;
      }

      if (riskKeys.has(key)) {
        jobGroup.riskAnswered += 1;
        if (value) {
          jobGroup.riskYes += 1;
          jobGroup.riskCounts[key] = (jobGroup.riskCounts[key] || 0) + 1;
        }
      }
      if (anchorKeys.has(key)) {
        jobGroup.anchorAnswered += 1;
        if (value) {
          jobGroup.anchorYes += 1;
        }
      }
    }
  }

  const gapReasonCounts = {};
  for (const gap of gaps) {
    gapReasonCounts[gap.skipReason || 'unknown'] = (gapReasonCounts[gap.skipReason || 'unknown'] || 0) + 1;
  }

  const rubricRows = Object.values(rubricCounts).map((entry) => ({
    ...entry,
    rate: entry.total === 0 ? 0 : entry.trueCount / entry.total,
  }));
  const jobTypeKeys = countMapToRows(jobTypeCounts).map((row) => row.key);
  const rubricMatrixRows = Object.values(rubricByJobType).map((entry) => {
    for (const cell of Object.values(entry.cells)) {
      cell.rate = cell.total === 0 ? 0 : cell.trueCount / cell.total;
    }
    return {
      ...entry,
      rate: entry.total === 0 ? 0 : entry.trueCount / entry.total,
    };
  });
  const jobTypeAttentionRows = Object.values(jobTypeGroups).map((group) => {
    const riskRate = group.riskAnswered === 0 ? 0 : group.riskYes / group.riskAnswered;
    const anchorRate = group.anchorAnswered === 0 ? 1 : group.anchorYes / group.anchorAnswered;
    const topRisk = countMapToRows(group.riskCounts)[0] || null;
    const topKeyword = countMapToRows(group.keywordCounts)[0] || null;
    const attentionScore = Math.round(
      riskRate * 70 +
      (1 - anchorRate) * 20 +
      Math.min(group.count / 5, 1) * 10
    );

    return {
      jobType: group.jobType,
      count: group.count,
      riskRate,
      anchorRate,
      attentionScore,
      topRisk: topRisk ? {
        key: topRisk.key,
        label: RISK_RUBRIC_LABELS[topRisk.key] || humanizeKey(topRisk.key),
        count: topRisk.count,
      } : null,
      topKeyword,
      avgTokens: average(group.tokens),
      avgToolCalls: average(group.toolCalls),
      avgDurationMs: average(group.durations),
    };
  }).sort((a, b) => b.attentionScore - a.attentionScore || b.count - a.count || a.jobType.localeCompare(b.jobType));

  return {
    rowCount: rows.length,
    keywordRows: countMapToRows(keywordCounts),
    jobTypeRows: countMapToRows(jobTypeCounts),
    jobTypeKeys,
    jobTypeAttentionRows,
    harnessRows: countMapToRows(harnessCounts),
    gapReasonRows: countMapToRows(gapReasonCounts),
    riskRubricRows: rubricRows
      .filter((entry) => !entry.isAnchor)
      .sort((a, b) => b.trueCount - a.trueCount || b.rate - a.rate || a.label.localeCompare(b.label)),
    anchorRubricRows: rubricRows
      .filter((entry) => entry.isAnchor)
      .sort((a, b) => b.rate - a.rate || b.trueCount - a.trueCount || a.label.localeCompare(b.label)),
    rubricMatrixRows,
    avgTokens: average(rows.map((row) => row.totalTokens)),
    avgToolCalls: average(rows.map((row) => row.toolCallCount)),
    avgDurationMs: average(rows.map((row) => row.durationMs)),
  };
}

function buildInsights(coverage, gaps, analytics) {
  const insights = [];
  const terminalJobs = coverage?.terminalJobs || 0;
  const reflectedJobs = coverage?.reflectedJobs || 0;
  const coverageRate = terminalJobs === 0 ? 0 : reflectedJobs / terminalJobs;
  const topRisk = analytics.riskRubricRows.find((row) => row.trueCount > 0);
  const topKeyword = analytics.keywordRows[0];
  const topGap = analytics.gapReasonRows[0];

  if (terminalJobs === 0) {
    insights.push({
      tone: 'torch',
      title: 'No denominator yet',
      body: 'This namespace has no terminal reflection-integrated jobs in the selected window.',
    });
  } else if (coverageRate < 0.7) {
    insights.push({
      tone: 'lava',
      title: 'Coverage is the first constraint',
      body: `${formatCount(reflectedJobs)} of ${formatCount(terminalJobs)} terminal jobs have reflections. Read gaps before interpreting friction trends.`,
    });
  } else {
    insights.push({
      tone: 'slime',
      title: 'Coverage supports trend reading',
      body: `${formatPct(coverageRate)} coverage gives the recent reflections enough denominator context for steward review.`,
    });
  }

  if (topGap) {
    insights.push({
      tone: topGap.key === 'reflection_missing' ? 'lava' : 'torch',
      title: GAP_REASON_LABELS[topGap.key] || humanizeKey(topGap.key),
      body: `${formatCount(topGap.count)} gap${topGap.count === 1 ? '' : 's'} in the selected terminal job window.`,
    });
  }

  if (topRisk) {
    insights.push({
      tone: 'copper',
      title: topRisk.label,
      body: `${formatCount(topRisk.trueCount)} yes signal${topRisk.trueCount === 1 ? '' : 's'} across ${formatCount(topRisk.total)} answered rubric row${topRisk.total === 1 ? '' : 's'}.`,
    });
  }

  if (topKeyword) {
    insights.push({
      tone: 'teleport',
      title: `Theme: ${humanizeKey(topKeyword.key)}`,
      body: `${formatCount(topKeyword.count)} mention${topKeyword.count === 1 ? '' : 's'} in recent reflection keywords.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: 'copper',
      title: 'No strong signal yet',
      body: 'Collect more reflections or widen the window before making process changes.',
    });
  }

  return insights.slice(0, 4);
}

function Panel({ title, eyebrow, icon, children, className = '' }) {
  return React.createElement('section', {
    className: `introspection-panel riveted-panel ${className}`,
  },
    React.createElement('div', { className: 'introspection-panel__header' },
      React.createElement('div', null,
        eyebrow && React.createElement('div', { className: 'introspection-eyebrow' }, eyebrow),
        React.createElement('h3', null, title)
      ),
      icon && React.createElement('span', { className: 'introspection-panel__icon' },
        React.createElement(QIcon, { name: icon, size: 20, color: 'currentColor' })
      )
    ),
    children
  );
}

function Meter({ value, tone = 'copper', label }) {
  const pct = clampPercent((value || 0) * 100);
  return React.createElement('div', { className: 'introspection-meter', 'aria-label': label },
    React.createElement('div', {
      className: `introspection-meter__fill introspection-meter__fill--${tone}`,
      style: { width: `${pct}%` },
    }),
    React.createElement('span', null, `${Math.round(pct)}%`)
  );
}

function MiniStat({ label, value, detail, tone = 'copper' }) {
  return React.createElement('div', { className: `introspection-mini-stat introspection-mini-stat--${tone}` },
    React.createElement('span', null, label),
    React.createElement('strong', null, value),
    detail && React.createElement('small', null, detail)
  );
}

function ControlSelect({ label, value, onChange, children }) {
  const fieldId = `introspection-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return React.createElement('label', { className: 'introspection-control' },
    React.createElement('span', null, label),
    React.createElement('select', {
      className: 'introspection-select',
      id: fieldId,
      name: fieldId,
      value,
      onChange: (event) => onChange(event.target.value),
    }, children)
  );
}

function WindowSwitch({ value, onChange }) {
  return React.createElement('div', { className: 'introspection-window-switch', role: 'group', 'aria-label': 'Reflection window' },
    WINDOW_OPTIONS.map((option) =>
      React.createElement('button', {
        key: option,
        type: 'button',
        className: `q-btn q-btn--sm ${value === option ? 'q-btn--primary' : 'q-btn--ghost'}`,
        onClick: () => onChange(option),
      }, `LAST ${option}`)
    )
  );
}

function DonutGauge({ value, label, sublabel, tone = 'torch' }) {
  const pct = clampPercent((value || 0) * 100);
  return React.createElement('div', { className: `introspection-donut introspection-donut--${tone}` },
    React.createElement('svg', { viewBox: '0 0 180 180', role: 'img', 'aria-label': `${label} ${Math.round(pct)}%` },
      React.createElement('circle', { cx: 90, cy: 90, r: 70, className: 'introspection-donut__track' }),
      React.createElement('circle', {
        cx: 90,
        cy: 90,
        r: 70,
        className: 'introspection-donut__value',
        pathLength: 100,
        strokeDasharray: `${pct} 100`,
        transform: 'rotate(-90 90 90)',
      }),
      React.createElement('circle', { cx: 90, cy: 90, r: 45, className: 'introspection-donut__core' })
    ),
    React.createElement('div', { className: 'introspection-donut__label' },
      React.createElement('strong', null, `${Math.round(pct)}%`),
      React.createElement('span', null, label),
      sublabel && React.createElement('small', null, sublabel)
    )
  );
}

function DenominatorFunnel({ coverage, gaps }) {
  const terminal = coverage?.terminalJobs || 0;
  const reflected = coverage?.reflectedJobs || 0;
  const gapCount = gaps.length;
  const max = Math.max(terminal, reflected, gapCount, 1);
  const rows = [
    { key: 'terminal', label: 'terminal jobs', count: terminal, tone: 'copper' },
    { key: 'reflected', label: 'reflected', count: reflected, tone: 'slime' },
    { key: 'gaps', label: 'gaps', count: gapCount, tone: gapCount > 0 ? 'lava' : 'slime' },
  ];

  return React.createElement('div', { className: 'introspection-funnel' },
    rows.map((row) =>
      React.createElement('div', { key: row.key, className: 'introspection-funnel__row' },
        React.createElement('div', { className: 'introspection-funnel__meta' },
          React.createElement('span', null, row.label),
          React.createElement('strong', null, formatCount(row.count))
        ),
        React.createElement('div', { className: 'introspection-funnel__bar' },
          React.createElement('div', {
            className: `introspection-funnel__fill introspection-funnel__fill--${row.tone}`,
            style: { width: `${clampPercent((row.count / max) * 100)}%` },
          })
        )
      )
    )
  );
}

function SystemHealthPanel({ coverage, gaps, analytics, onSelectGap }) {
  const byHarness = coverage?.byHarness || {};
  const gapPreview = gaps.slice(0, 4);

  return React.createElement(Panel, { title: 'Reflection System Health', eyebrow: 'pipeline observability', icon: 'eye', className: 'introspection-panel--health' },
    React.createElement('div', { className: 'introspection-health-grid' },
      React.createElement(DonutGauge, {
        value: coverage?.rate || 0,
        label: 'coverage',
        sublabel: `${formatCount(coverage?.reflectedJobs || 0)} / ${formatCount(coverage?.terminalJobs || 0)} jobs`,
        tone: (coverage?.rate || 0) >= 0.8 ? 'slime' : (coverage?.rate || 0) >= 0.5 ? 'torch' : 'lava',
      }),
      React.createElement('div', { className: 'introspection-health-stack' },
        React.createElement('div', { className: 'introspection-health-stats' },
          React.createElement(MiniStat, { label: 'eligible claude', value: formatPct(coverage?.eligibleCoverage || 0), detail: 'reflection-capable', tone: (coverage?.eligibleCoverage || 0) >= 0.7 ? 'slime' : 'lava' }),
          React.createElement(MiniStat, { label: 'gaps', value: formatCount(gaps.length), detail: 'missing rows', tone: gaps.length === 0 ? 'slime' : 'lava' })
        ),
        React.createElement(DenominatorFunnel, { coverage, gaps }),
        React.createElement('div', { className: 'introspection-health-reasons' },
          analytics.gapReasonRows.length > 0
            ? analytics.gapReasonRows.map((row) =>
                React.createElement('span', { key: row.key, className: 'introspection-chip introspection-chip--lava' },
                  `${GAP_REASON_LABELS[row.key] || humanizeKey(row.key)}: ${formatCount(row.count)}`
                )
              )
            : React.createElement('span', { className: 'introspection-chip' }, 'No reflection gaps')
        ),
        gapPreview.length > 0 && React.createElement('div', { className: 'introspection-health-gap-strip' },
          gapPreview.map((gap) =>
            React.createElement('button', {
              key: gap.jobId,
              type: 'button',
              className: 'introspection-gap-pill',
              onClick: () => onSelectGap(gap),
            },
              React.createElement('strong', null, gap.jobType || 'job'),
              React.createElement('span', null, GAP_REASON_LABELS[gap.skipReason] || humanizeKey(gap.skipReason))
            )
          )
        ),
        React.createElement('div', { className: 'introspection-harness-orbit' },
          ['claude', 'codex', 'gemini'].map((harness) => {
            const row = byHarness[harness] || { terminal: 0, reflected: 0 };
            const rate = row.terminal === 0 ? 0 : row.reflected / row.terminal;
            return React.createElement('div', { key: harness, className: 'introspection-harness-chip' },
              React.createElement('span', null, harness),
              React.createElement(Meter, { value: rate, tone: harness === 'claude' ? 'slime' : 'copper', label: `${harness} coverage` }),
              React.createElement('strong', null, `${formatCount(row.reflected)} / ${formatCount(row.terminal)}`)
            );
          })
        )
      )
    ),
    React.createElement('div', { className: 'introspection-panel-note' },
      'Denominator is terminal jobs with namespaceId; historical jobs without namespaceId are excluded.'
    )
  );
}

function ThemesPanel({ analytics, activeKeyword, onSelectKeyword }) {
  const keywordRows = analytics.keywordRows.slice(0, 10);
  const maxCount = keywordRows[0]?.count || 1;
  return React.createElement(Panel, { title: 'Theme Cloud', eyebrow: 'keyword gravity', icon: 'search', className: 'introspection-panel--themes' },
    keywordRows.length > 0
      ? React.createElement('div', { className: 'introspection-bubble-cloud' },
          keywordRows.map((row) =>
            React.createElement('button', {
              key: row.key,
              type: 'button',
              className: `introspection-bubble ${activeKeyword === row.key ? 'is-active' : ''}`,
              style: { '--bubble-size': `${72 + clampPercent((row.count / maxCount) * 68)}px` },
              onClick: () => onSelectKeyword(activeKeyword === row.key ? null : row.key),
            },
              React.createElement('strong', null, formatCount(row.count)),
              React.createElement('span', null, humanizeKey(row.key))
            )
          )
        )
      : React.createElement('div', { className: 'introspection-empty' }, 'No keywords recorded yet.')
  );
}

function JobTypeAttentionPanel({ analytics, activeJobType, onSelectJobType }) {
  const rows = analytics.jobTypeAttentionRows;
  const maxScore = Math.max(...rows.map((row) => row.attentionScore), 1);

  return React.createElement(Panel, { title: 'Job Type Attention', eyebrow: 'where friction clusters', icon: 'route', className: 'introspection-panel--jobtypes' },
    rows.length > 0
      ? React.createElement('div', { className: 'introspection-jobtype-board' },
          rows.map((row) =>
            React.createElement('button', {
              key: row.jobType,
              type: 'button',
              className: `introspection-jobtype-card ${activeJobType === row.jobType ? 'is-active' : ''}`,
              onClick: () => onSelectJobType(activeJobType === row.jobType ? 'all' : row.jobType),
            },
              React.createElement('div', { className: 'introspection-jobtype-card__head' },
                React.createElement('strong', null, row.jobType),
                React.createElement('span', null, `${formatCount(row.count)} rows`)
              ),
              React.createElement('div', { className: 'introspection-jobtype-score' },
                React.createElement('span', null, 'attention'),
                React.createElement('strong', null, formatCount(row.attentionScore))
              ),
              React.createElement('div', { className: 'introspection-bar introspection-bar--attention' },
                React.createElement('div', {
                  className: `introspection-bar__fill ${row.attentionScore > 60 ? 'introspection-bar__fill--lava' : row.attentionScore > 35 ? 'introspection-bar__fill--torch' : 'introspection-bar__fill--slime'}`,
                  style: { width: `${clampPercent((row.attentionScore / maxScore) * 100)}%` },
                })
              ),
              React.createElement('div', { className: 'introspection-jobtype-card__signals' },
                React.createElement('span', null, `risk ${formatPct(row.riskRate)}`),
                React.createElement('span', null, `anchor ${formatPct(row.anchorRate)}`),
                React.createElement('span', null, formatDuration(row.avgDurationMs))
              ),
              React.createElement('p', null,
                row.topRisk
                  ? `Top risk: ${row.topRisk.label} (${formatCount(row.topRisk.count)})`
                  : 'No positive risk rubric signals.'
              ),
              row.topKeyword && React.createElement('small', null, `theme: ${humanizeKey(row.topKeyword.key)}`)
            )
          )
        )
      : React.createElement('div', { className: 'introspection-empty' }, 'No reflected job types in this window.')
  );
}

function RubricPanel({ analytics }) {
  const riskRows = analytics.riskRubricRows.slice(0, 6);
  const anchorRows = analytics.anchorRubricRows.slice(0, 4);
  return React.createElement(Panel, { title: 'Rubric Radar', eyebrow: 'boolean signal shape', icon: 'rune', className: 'introspection-panel--radar' },
    riskRows.length > 0
      ? React.createElement(RadarChart, { rows: riskRows })
      : React.createElement('div', { className: 'introspection-empty' }, 'No friction rubric answers yet.'),
    React.createElement('div', { className: 'introspection-anchor-row' },
      anchorRows.length > 0
        ? anchorRows.map((row) =>
            React.createElement('div', { key: row.key, className: 'introspection-anchor-chip' },
              React.createElement('span', null, row.label),
              React.createElement('strong', null, `${Math.round(row.rate * 100)}%`)
            )
          )
        : React.createElement('div', { className: 'introspection-empty' }, 'No anchor answers yet.')
    )
  );
}

function RubricMatrixPanel({ analytics }) {
  const jobTypeKeys = analytics.jobTypeKeys.slice(0, 5);
  const rows = analytics.rubricMatrixRows
    .filter((row) => row.isRisk || row.isAnchor)
    .sort((a, b) => {
      if (a.isAnchor !== b.isAnchor) return a.isAnchor ? 1 : -1;
      return b.trueCount - a.trueCount || b.rate - a.rate || a.label.localeCompare(b.label);
    })
    .slice(0, 10);

  return React.createElement(Panel, { title: 'Rubric By Job Type', eyebrow: 'cross-section heatmap', icon: 'config', className: 'introspection-panel--matrix' },
    rows.length > 0 && jobTypeKeys.length > 0
      ? React.createElement('div', {
          className: 'introspection-rubric-matrix',
          style: { '--matrix-columns': jobTypeKeys.length },
        },
          React.createElement('div', { className: 'introspection-rubric-matrix__corner' }, 'rubric'),
          jobTypeKeys.map((jobType) =>
            React.createElement('div', { key: jobType, className: 'introspection-rubric-matrix__head' }, jobType)
          ),
          rows.map((row) =>
            React.createElement(React.Fragment, { key: row.key },
              React.createElement('div', { className: `introspection-rubric-matrix__label ${row.isAnchor ? 'is-anchor' : 'is-risk'}` }, row.label),
              jobTypeKeys.map((jobType) => {
                const cell = row.cells[jobType] || { trueCount: 0, total: 0, rate: 0 };
                const pct = Math.round(cell.rate * 100);
                const heatRgb = row.isAnchor ? '60, 116, 32' : '196, 56, 24';
                const heatAlpha = row.isAnchor ? 0.10 + cell.rate * 0.54 : 0.12 + cell.rate * 0.58;
                return React.createElement('div', {
                  key: `${row.key}-${jobType}`,
                  className: `introspection-rubric-cell ${row.isAnchor ? 'is-anchor' : 'is-risk'}`,
                  style: {
                    background: `linear-gradient(180deg, rgba(${heatRgb}, ${heatAlpha.toFixed(2)}), rgba(12, 10, 7, 0.86))`,
                  },
                  title: `${row.label} / ${jobType}: ${cell.trueCount}/${cell.total}`,
                },
                  cell.total > 0
                    ? React.createElement(React.Fragment, null,
                        React.createElement('strong', null, `${pct}%`),
                        React.createElement('span', null, `${cell.trueCount}/${cell.total}`)
                      )
                    : React.createElement('span', null, '-')
                );
              })
            )
          )
        )
      : React.createElement('div', { className: 'introspection-empty' }, 'No rubric/job-type matrix data yet.')
  );
}

function RadarChart({ rows }) {
  const size = 240;
  const center = size / 2;
  const radius = 82;
  const count = Math.max(rows.length, 3);
  const angleFor = (index) => ((Math.PI * 2) / count) * index - Math.PI / 2;
  const point = (index, value = 1) => {
    const angle = angleFor(index);
    const r = radius * value;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };
  const polygon = rows.map((row, index) => point(index, row.rate).map((value) => value.toFixed(1)).join(',')).join(' ');
  const grid = [0.33, 0.66, 1].map((step) =>
    Array.from({ length: count }, (_, index) => point(index, step).map((value) => value.toFixed(1)).join(',')).join(' ')
  );

  return React.createElement('div', { className: 'introspection-radar-wrap' },
    React.createElement('svg', { viewBox: `0 0 ${size} ${size}`, className: 'introspection-radar' },
      grid.map((points, index) =>
        React.createElement('polygon', { key: index, points, className: 'introspection-radar__grid' })
      ),
      rows.map((row, index) => {
        const [x, y] = point(index, 1);
        const [dotX, dotY] = point(index, row.rate);
        return React.createElement(React.Fragment, { key: row.key },
          React.createElement('line', { x1: center, y1: center, x2: x, y2: y, className: 'introspection-radar__axis' }),
          React.createElement('circle', { cx: dotX, cy: dotY, r: 4, className: 'introspection-radar__dot' })
        );
      }),
      React.createElement('polygon', { points: polygon, className: 'introspection-radar__area' })
    ),
    React.createElement('div', { className: 'introspection-radar-legend' },
      rows.map((row) =>
        React.createElement('div', { key: row.key },
          React.createElement('span', null, row.label),
          React.createElement('strong', null, `${Math.round(row.rate * 100)}%`)
        )
      )
    )
  );
}

function RunScatter({ rows, onSelectReflection }) {
  const width = 420;
  const height = 260;
  const padding = 34;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const maxTokens = Math.max(...rows.map((row) => row.totalTokens || 0), 1);
  const maxDuration = Math.max(...rows.map((row) => row.durationMs || 0), 1);

  return React.createElement(Panel, { title: 'Run Shape Map', eyebrow: 'tokens x duration', icon: 'lightning', className: 'introspection-panel--scatter' },
    rows.length > 0
      ? React.createElement('div', { className: 'introspection-scatter-wrap' },
          React.createElement('svg', { viewBox: `0 0 ${width} ${height}`, className: 'introspection-scatter' },
            React.createElement('line', { x1: padding, y1: height - padding, x2: width - padding, y2: height - padding, className: 'introspection-scatter__axis' }),
            React.createElement('line', { x1: padding, y1: padding, x2: padding, y2: height - padding, className: 'introspection-scatter__axis' }),
            [0.25, 0.5, 0.75].map((step) =>
              React.createElement('line', {
                key: step,
                x1: padding,
                x2: width - padding,
                y1: padding + usableHeight * step,
                y2: padding + usableHeight * step,
                className: 'introspection-scatter__grid',
              })
            ),
            rows.map((row, index) => {
              const x = padding + ((row.totalTokens || 0) / maxTokens) * usableWidth;
              const y = height - padding - ((row.durationMs || 0) / maxDuration) * usableHeight;
              const r = 6 + Math.min(12, row.toolCallCount || 0);
              return React.createElement('circle', {
                key: row._id || row.jobId || index,
                cx: x,
                cy: y,
                r,
                tabIndex: 0,
                className: `introspection-scatter__point introspection-scatter__point--${row.jobType || 'job'}`,
                onClick: () => onSelectReflection(row),
              });
            }),
            React.createElement('text', { x: width - padding, y: height - 8, className: 'introspection-scatter__label', textAnchor: 'end' }, 'tokens'),
            React.createElement('text', { x: 10, y: padding, className: 'introspection-scatter__label' }, 'duration')
          ),
          React.createElement('div', { className: 'introspection-scatter-key' },
            React.createElement('span', null, 'Each dot is a reflection. Radius tracks tool calls. Click a dot to inspect.')
          )
        )
      : React.createElement('div', { className: 'introspection-empty' }, 'No reflected run-shape data yet.')
  );
}

function ReflectionStream({ rows, activeKeyword, onSelectReflection }) {
  const visibleRows = activeKeyword
    ? rows.filter((row) => (row.keywords || []).some((keyword) => normalizeKeyword(keyword) === activeKeyword))
    : rows;

  return React.createElement(Panel, { title: activeKeyword ? `Drilldown: ${humanizeKey(activeKeyword)}` : 'Reflection Stream', eyebrow: 'click any card', icon: 'frag', className: 'introspection-panel--stream' },
    visibleRows.length > 0
      ? React.createElement('div', { className: 'introspection-stream' },
          visibleRows.slice(0, 10).map((row) =>
            React.createElement('button', {
              key: row._id,
              type: 'button',
              className: 'introspection-stream-card',
              onClick: () => onSelectReflection(row),
            },
              React.createElement('span', { className: 'introspection-stream-card__type' }, row.jobType || 'job'),
              React.createElement('span', { className: 'introspection-stream-card__time' }, formatTimestamp(row.createdAt)),
              React.createElement('strong', null, previewText(row.description || row.critique, 120)),
              React.createElement('small', null, previewText(row.improvements || row.alternativeApproach, 110))
            )
          )
        )
      : React.createElement('div', { className: 'introspection-empty' }, 'No reflections match this drilldown.')
  );
}

function InsightStack({ insights }) {
  return React.createElement(Panel, { title: 'Steward Readout', eyebrow: 'generated scan', icon: 'info', className: 'introspection-panel--insights' },
    React.createElement('div', { className: 'introspection-insight-stack' },
      insights.map((insight) =>
        React.createElement(InsightCard, { key: `${insight.title}-${insight.body}`, insight })
      )
    )
  );
}

function InsightCard({ insight }) {
  return React.createElement('article', {
    className: `introspection-insight introspection-insight--${insight.tone}`,
  },
    React.createElement('div', { className: 'introspection-insight__icon' },
      React.createElement(QIcon, {
        name: insight.tone === 'lava' ? 'warning' : insight.tone === 'slime' ? 'check' : 'eye',
        size: 18,
        color: 'currentColor',
      })
    ),
    React.createElement('div', null,
      React.createElement('strong', null, insight.title),
      React.createElement('p', null, insight.body)
    )
  );
}

function DetailDrawer({ detail, onClose }) {
  if (!detail) return null;
  const isReflection = detail.type === 'reflection';
  const row = detail.row;

  return React.createElement('div', { className: 'introspection-drawer-shell' },
    React.createElement('button', { type: 'button', className: 'introspection-drawer-scrim', onClick: onClose, 'aria-label': 'Close detail drawer' }),
    React.createElement('aside', { className: 'introspection-drawer riveted-panel' },
      React.createElement('div', { className: 'introspection-drawer__head' },
        React.createElement('div', null,
          React.createElement('div', { className: 'introspection-eyebrow' }, isReflection ? 'Reflection Detail' : 'Gap Detail'),
          React.createElement('h2', null, isReflection ? `${row.jobType || 'job'} reflection` : `${row.jobType || 'job'} gap`)
        ),
        React.createElement('button', { type: 'button', className: 'q-btn q-btn--sm q-btn--ghost', onClick: onClose }, 'CLOSE')
      ),
      isReflection
        ? React.createElement(ReflectionDetail, { row })
        : React.createElement(GapDetail, { row })
    )
  );
}

function DetailField({ title, children }) {
  if (!children) return null;
  return React.createElement('section', { className: 'introspection-detail-field' },
    React.createElement('h4', null, title),
    React.createElement('p', null, children)
  );
}

function ReflectionDetail({ row }) {
  return React.createElement('div', { className: 'introspection-detail-body' },
    React.createElement('div', { className: 'introspection-detail-meta' },
      React.createElement(MiniStat, { label: 'job', value: String(row.jobId || '').slice(0, 12), detail: row.harness || 'unknown', tone: 'copper' }),
      React.createElement(MiniStat, { label: 'created', value: formatTimestamp(row.createdAt), detail: row.jobType || 'job', tone: 'torch' }),
      React.createElement(MiniStat, { label: 'shape', value: formatDuration(row.durationMs), detail: `${formatAverage(row.totalTokens, ' tokens')} - ${formatAverage(row.toolCallCount, ' tools')}`, tone: 'slime' })
    ),
    row.keywords?.length > 0 && React.createElement('div', { className: 'introspection-chip-row' },
      row.keywords.map((keyword) => React.createElement('span', { key: keyword, className: 'introspection-chip' }, keyword))
    ),
    React.createElement(DetailField, { title: 'Description' }, row.description),
    React.createElement(DetailField, { title: 'Critique' }, row.critique),
    React.createElement(DetailField, { title: 'Alternative Approach' }, row.alternativeApproach),
    React.createElement(DetailField, { title: 'Improvements' }, row.improvements),
    React.createElement('section', { className: 'introspection-detail-field' },
      React.createElement('h4', null, 'Rubric'),
      React.createElement('div', { className: 'introspection-rubric-grid' },
        Object.entries(row.rubric || {}).map(([key, value]) =>
          React.createElement('span', { key, className: `introspection-rubric-token ${value ? 'is-true' : 'is-false'}` },
            `${value ? 'YES' : 'NO'} ${ANCHOR_RUBRIC_LABELS[key] || RISK_RUBRIC_LABELS[key] || humanizeKey(key)}`
          )
        )
      )
    )
  );
}

function GapDetail({ row }) {
  return React.createElement('div', { className: 'introspection-detail-body' },
    React.createElement('div', { className: 'introspection-detail-meta' },
      React.createElement(MiniStat, { label: 'job', value: String(row.jobId || '').slice(0, 12), detail: row.harness || 'unknown', tone: 'lava' }),
      React.createElement(MiniStat, { label: 'reason', value: GAP_REASON_LABELS[row.skipReason] || humanizeKey(row.skipReason), detail: row.status || 'terminal', tone: 'torch' }),
      React.createElement(MiniStat, { label: 'session', value: row.sessionIdPresent ? 'present' : 'missing', detail: formatTimestamp(row.completedAt), tone: row.sessionIdPresent ? 'slime' : 'lava' })
    ),
    React.createElement(DetailField, { title: 'Result Preview' }, row.resultPreview || 'No result preview recorded.')
  );
}

export function IntrospectionDashboard({ namespaces, responsive, onBack }) {
  const namespaceOptions = useMemo(() => Array.isArray(namespaces) ? namespaces : [], [namespaces]);
  const [selectedNamespaceId, setSelectedNamespaceId] = useState('');
  const [windowSize, setWindowSize] = useState(25);
  const [harnessFilter, setHarnessFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [activeKeyword, setActiveKeyword] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    if (namespaceOptions.length === 0) return;
    const selectedExists = namespaceOptions.some((namespace) => namespace._id === selectedNamespaceId);
    if (!selectedNamespaceId || !selectedExists) {
      const preferred = namespaceOptions.find((namespace) => namespace.name === 'claude-comms') || namespaceOptions[0];
      setSelectedNamespaceId(preferred._id);
    }
  }, [namespaceOptions, selectedNamespaceId]);

  const selectedNamespace = namespaceOptions.find((namespace) => namespace._id === selectedNamespaceId) || null;

  const portfolioArgs = useMemo(() => {
    if (!selectedNamespaceId) return null;
    return {
      namespaceId: selectedNamespaceId,
      last: windowSize,
      ...(harnessFilter !== 'all' ? { harness: harnessFilter } : {}),
    };
  }, [harnessFilter, selectedNamespaceId, windowSize]);

  const queryArgs = useMemo(() => {
    if (!portfolioArgs) return null;
    return {
      ...portfolioArgs,
      ...(jobTypeFilter !== 'all' ? { jobType: jobTypeFilter } : {}),
    };
  }, [jobTypeFilter, portfolioArgs]);

  const coverageQuery = useQuery(portfolioArgs ? api.reflections.coverageRate : null, portfolioArgs || {});
  const portfolioRecentQuery = useQuery(portfolioArgs ? api.reflections.recent : null, portfolioArgs || {});
  const gapsQuery = useQuery(portfolioArgs ? api.reflections.gaps : null, portfolioArgs || {});
  const recentQuery = useQuery(queryArgs ? api.reflections.recent : null, queryArgs || {});

  const coverage = coverageQuery.data;
  const recentRows = recentQuery.data?.page || [];
  const portfolioRows = portfolioRecentQuery.data?.page || [];
  const gaps = gapsQuery.data || [];
  const loading = coverageQuery.loading || portfolioRecentQuery.loading || recentQuery.loading || gapsQuery.loading;
  const errors = [coverageQuery.error, portfolioRecentQuery.error, recentQuery.error, gapsQuery.error].filter(Boolean);

  const analytics = useMemo(() => summarizeReflections(recentRows, gaps), [recentRows, gaps]);
  const portfolioAnalytics = useMemo(() => summarizeReflections(portfolioRows, gaps), [portfolioRows, gaps]);
  const insights = useMemo(() => buildInsights(coverage, gaps, portfolioAnalytics), [coverage, gaps, portfolioAnalytics]);

  return React.createElement('div', {
    className: `introspection-dashboard ${responsive?.isMobile ? 'introspection-dashboard--mobile' : ''}`,
  },
    React.createElement('header', { className: 'introspection-topbar' },
      React.createElement('div', { className: 'introspection-titleblock' },
        React.createElement('div', { className: 'introspection-eyebrow' }, 'Steward Console'),
        React.createElement('h1', null, 'Reflection Introspection'),
        React.createElement('p', null, 'Coverage, missing reflections, and operating friction extracted from completed agent jobs.')
      ),
      React.createElement('div', { className: 'introspection-nav-actions' },
        React.createElement('button', {
          type: 'button',
          className: 'q-btn q-btn--md q-btn--runic',
          onClick: onBack,
        },
          React.createElement(QIcon, { name: 'chevronRight', size: 16, color: 'currentColor' }),
          'BACK TO THREADS'
        )
      )
    ),

    React.createElement('section', { className: 'introspection-command-deck copper-texture copper-texture--dark glow--copper' },
      React.createElement('div', { className: 'introspection-command-deck__copy' },
        React.createElement('div', { className: 'introspection-eyebrow' }, selectedNamespace?.name || 'Namespace loading'),
        React.createElement('h2', null, 'Scan the signal. Drill the evidence.'),
        React.createElement('p', null,
          'Job-type attention, rubric heat, and reflection drilldowns are the main surface. Pipeline coverage is kept compact as system observability.'
        )
      ),
      React.createElement('div', { className: 'introspection-controls' },
        React.createElement(ControlSelect, {
          label: 'Namespace',
          value: selectedNamespaceId,
          onChange: setSelectedNamespaceId,
        },
          namespaceOptions.length > 0
            ? namespaceOptions.map((namespace) =>
                React.createElement('option', { key: namespace._id, value: namespace._id }, namespace.name)
              )
            : React.createElement('option', { value: '' }, 'No namespaces')
        ),
        React.createElement(ControlSelect, {
          label: 'Harness',
          value: harnessFilter,
          onChange: setHarnessFilter,
        },
          HARNESSES.map((harness) =>
            React.createElement('option', { key: harness, value: harness }, harness.toUpperCase())
          )
        ),
        React.createElement(ControlSelect, {
          label: 'Job Type',
          value: jobTypeFilter,
          onChange: setJobTypeFilter,
        },
          JOB_TYPES.map((jobType) =>
            React.createElement('option', { key: jobType, value: jobType }, jobType.toUpperCase())
          )
        ),
        React.createElement(WindowSwitch, { value: windowSize, onChange: setWindowSize })
      )
    ),

    errors.length > 0 && React.createElement('div', { className: 'introspection-error riveted-panel glow--lava' },
      React.createElement(QIcon, { name: 'warning', size: 20, color: 'var(--q-lava1)' }),
      React.createElement('span', null, errors.join(' - '))
    ),

    loading && !coverage && React.createElement('div', { className: 'introspection-loading-grid' },
      React.createElement(LoadingSkeleton, { variant: 'card', count: 4 }),
      React.createElement(LoadingSkeleton, { variant: 'card', count: 2 })
    ),

    !loading && !selectedNamespaceId && React.createElement('div', { className: 'introspection-empty introspection-empty--large riveted-panel' },
      'No namespace is available for reflection introspection.'
    ),

    coverage && React.createElement(React.Fragment, null,
      React.createElement('section', { className: 'introspection-bento' },
        React.createElement(SystemHealthPanel, {
          coverage,
          gaps,
          analytics: portfolioAnalytics,
          onSelectGap: (row) => setSelectedDetail({ type: 'gap', row }),
        }),
        React.createElement(JobTypeAttentionPanel, {
          analytics: portfolioAnalytics,
          activeJobType: jobTypeFilter,
          onSelectJobType: setJobTypeFilter,
        }),
        React.createElement(RubricMatrixPanel, { analytics: portfolioAnalytics }),
        React.createElement(RunScatter, {
          rows: recentRows,
          onSelectReflection: (row) => setSelectedDetail({ type: 'reflection', row }),
        }),
        React.createElement(InsightStack, { insights }),
        React.createElement(RubricPanel, { analytics }),
        React.createElement(ThemesPanel, {
          analytics,
          activeKeyword,
          onSelectKeyword: setActiveKeyword,
        }),
        React.createElement(ReflectionStream, {
          rows: recentRows,
          activeKeyword,
          onSelectReflection: (row) => setSelectedDetail({ type: 'reflection', row }),
        })
      ),
      React.createElement(DetailDrawer, {
        detail: selectedDetail,
        onClose: () => setSelectedDetail(null),
      })
    )
  );
}

export default IntrospectionDashboard;
