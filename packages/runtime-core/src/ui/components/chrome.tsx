import { homedir } from "node:os";

import * as React from "react";

import type { ReactNode } from "react";

import { Box, Spacer, Text } from "ink";

import { getTuiTheme, getTuiThemeColors } from "../theme.js";
import type { TuiThemeName } from "../types.js";

export type UiTone =
  | "accent"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "muted"
  | "text";

export interface StatusBadgeDescriptor {
  active?: boolean;
  label: string;
  tone?: UiTone;
}

export interface StatusBadge extends StatusBadgeDescriptor {}

export interface StatusBadgeProps extends StatusBadgeDescriptor {
  themeName: TuiThemeName;
}

export function StatusBadge({
  active = true,
  label,
  themeName,
  tone = "muted"
}: StatusBadgeProps): React.JSX.Element {
  const theme = getTuiTheme(themeName);
  const color = toneToColor(theme.colors, tone);
  const text =
    theme.badgeStyle === "plain"
      ? label
      : theme.badgeStyle === "filled"
        ? ` ${label} `
        : `[${label}]`;

  return (
    <Text bold={active || theme.glow} color={color} dimColor={!active}>
      {text}
    </Text>
  );
}

export const Badge = StatusBadge;

export function BadgeStrip({
  badges,
  themeName,
  width
}: {
  badges: readonly StatusBadgeDescriptor[];
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const fitted = fitBadgeLabels(badges, width);

  return (
    <Box>
      {fitted.map((badge, index) => (
        <Box key={`${badge.label}-${index}`}>
          {index > 0 ? <Text color={colors.borderDim}> </Text> : null}
          <StatusBadge
            active={badge.active}
            label={badge.label}
            themeName={themeName}
            tone={badge.tone}
          />
        </Box>
      ))}
    </Box>
  );
}

export function StatusBar({
  badges,
  themeName
}: {
  badges: readonly StatusBadgeDescriptor[];
  themeName: TuiThemeName;
}): React.JSX.Element {
  return <BadgeStrip badges={badges} themeName={themeName} width={999} />;
}

export function Divider({
  themeName,
  width
}: {
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);

  return (
    <Text color={colors.borderDim} dimColor>
      {truncate("─".repeat(Math.max(0, width)), width)}
    </Text>
  );
}

export function InspectorSection({
  children,
  title,
  themeName
}: {
  children: ReactNode;
  title: string;
  themeName: TuiThemeName;
}): React.JSX.Element {
  const theme = getTuiTheme(themeName);

  return (
    <Box flexDirection="column" marginBottom={theme.sectionGap}>
      <Text bold color={theme.colors.panelTitle}>
        {title.toUpperCase()}
      </Text>
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}

export function InspectorTabs({
  active,
  tabs,
  themeName,
  width
}: {
  active: string;
  tabs: readonly string[];
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const labels = fitLabels(
    tabs.map((tab) => (tab === active ? `/${tab}` : tab)),
    width
  );

  return (
    <Box>
      {labels.map((label, index) => {
        const normalized = label.replace(/^\//, "");
        const selected = normalized === active;

        return (
          <Box key={`${label}-${index}`}>
            {index > 0 ? <Text color={colors.borderDim}> </Text> : null}
            <Text bold={selected} color={selected ? colors.accent : colors.muted}>
              {label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export const PanelTabs = InspectorTabs;

export function DataRow({
  label,
  tone = "text",
  value,
  width,
  themeName
}: {
  label: string;
  tone?: UiTone;
  value: string;
  width: number;
  themeName: TuiThemeName;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const labelWidth = Math.min(12, Math.max(6, Math.floor(width * 0.32)));
  const valueWidth = Math.max(4, width - labelWidth - 1);

  return (
    <Box>
      <Text color={colors.muted}>
        {truncate(label.padEnd(labelWidth, " "), labelWidth)}
      </Text>
      <Text color={toneToColor(colors, tone)}>
        {truncate(value, valueWidth)}
      </Text>
    </Box>
  );
}

export const ProgressRow = DataRow;

export function KeyHintBar({
  hints,
  themeName,
  width
}: {
  hints: readonly string[];
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const visibleHints = fitLabels(hints, width);

  return (
    <Box>
      {visibleHints.map((hint, index) => {
        const [key, ...rest] = hint.split(/\s+/, 2);
        const detail = rest.join(" ");

        return (
          <Box key={`${hint}-${index}`}>
            {index > 0 ? <Text color={colors.borderDim}>  </Text> : null}
            <Text bold color={key.startsWith("/") || key.includes("Ctrl") ? colors.accent : colors.text}>
              {key}
            </Text>
            {detail ? <Text color={colors.muted}>{` ${detail}`}</Text> : null}
          </Box>
        );
      })}
      <Spacer />
    </Box>
  );
}

export const FooterHints = KeyHintBar;

export function EmptyState({
  detail,
  title,
  themeName,
  width
}: {
  detail?: string;
  title: string;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);

  return (
    <Box flexDirection="column">
      <Text bold color={colors.text}>
        {truncate(title, width)}
      </Text>
      {detail ? (
        <Text color={colors.muted}>{truncate(detail, width)}</Text>
      ) : null}
    </Box>
  );
}

export function TaskRow({
  currentStep,
  id,
  state,
  themeName,
  title,
  width
}: {
  currentStep?: string;
  id: string;
  state: string;
  themeName: TuiThemeName;
  title: string;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const tone = taskStateTone(state);
  const stateWidth = 6;
  const idWidth = Math.min(11, Math.max(7, Math.floor(width * 0.24)));
  const stepWidth = Math.min(14, Math.max(6, Math.floor(width * 0.24)));
  const titleWidth = Math.max(6, width - stateWidth - idWidth - stepWidth - 3);

  return (
    <Box>
      <Text bold color={toneToColor(colors, tone)}>
        {truncate(state.toUpperCase().padEnd(stateWidth), stateWidth)}
      </Text>
      <Text color={colors.muted}>{truncate(id.padEnd(idWidth), idWidth)}</Text>
      <Text color={colors.text}>{truncate(title.padEnd(titleWidth), titleWidth)}</Text>
      <Text color={colors.muted}>{truncate(currentStep ?? "-", stepWidth)}</Text>
    </Box>
  );
}

export function TaskSummary({
  age,
  id,
  state,
  themeName,
  title,
  width
}: {
  age?: string;
  id: string;
  state: string;
  themeName: TuiThemeName;
  title: string;
  width: number;
}): React.JSX.Element {
  return (
    <TaskRow
      currentStep={age}
      id={id}
      state={state}
      themeName={themeName}
      title={title}
      width={width}
    />
  );
}

export function ApprovalRow({
  action,
  id,
  scope,
  task,
  themeName,
  width
}: {
  action: string;
  id: string;
  scope: string;
  task?: string;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const idWidth = Math.min(11, Math.max(7, Math.floor(width * 0.28)));
  const scopeWidth = Math.min(12, Math.max(7, Math.floor(width * 0.26)));
  const actionWidth = Math.max(6, width - idWidth - scopeWidth - 2);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={colors.warning}>
          {truncate(id.padEnd(idWidth), idWidth)}
        </Text>
        <Text color={colors.muted}>{truncate(scope.padEnd(scopeWidth), scopeWidth)}</Text>
        <Text color={colors.text}>{truncate(action, actionWidth)}</Text>
      </Box>
      {task ? (
        <Text color={colors.muted}>{truncate(`task ${task}`, width)}</Text>
      ) : null}
    </Box>
  );
}

export function ApprovalSummary({
  id,
  scope,
  summary,
  themeName,
  width
}: {
  id: string;
  scope: string;
  summary: string;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  return (
    <ApprovalRow
      action={summary}
      id={id}
      scope={scope}
      themeName={themeName}
      width={width}
    />
  );
}

export function FleetRow({
  blockerCount,
  id,
  role,
  state,
  task,
  themeName,
  width
}: {
  blockerCount: number;
  id: string;
  role: string;
  state: string;
  task: string;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const stateTone = taskStateTone(state);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={toneToColor(colors, stateTone)}>
          {truncate(state.toUpperCase(), 8)}
        </Text>
        <Text color={colors.borderDim}> </Text>
        <Text color={colors.text}>{truncate(`${id} ${role}`, Math.max(8, width - 16))}</Text>
        <Spacer />
        <Text color={blockerCount > 0 ? colors.warning : colors.muted}>
          {blockerCount > 0 ? `block ${blockerCount}` : "clear"}
        </Text>
      </Box>
      <Text color={colors.muted}>{truncate(task, width)}</Text>
    </Box>
  );
}

export function McpRow({
  health,
  name,
  status,
  themeName,
  transport,
  width
}: {
  health: string;
  name: string;
  status: string;
  themeName: TuiThemeName;
  transport: string;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const nameWidth = Math.max(8, width - 22);

  return (
    <Box>
      <Text color={status === "enabled" ? colors.accent : colors.text}>
        {truncate(name.padEnd(nameWidth), nameWidth)}
      </Text>
      <Text color={status === "enabled" ? colors.success : colors.muted}>
        {truncate(status.padEnd(9), 9)}
      </Text>
      <Text color={colors.muted}>{truncate(transport.padEnd(7), 7)}</Text>
      <Text color={health === "healthy" ? colors.success : colors.warning}>
        {truncate(health, 7)}
      </Text>
    </Box>
  );
}

export function shortenPath(value: string, width = 40): string {
  const home = homedir();
  const homeRelative = value.startsWith(home)
    ? `~${value.slice(home.length)}`
    : value;

  if (homeRelative.length <= width) {
    return homeRelative;
  }

  const parts = homeRelative.split(/[\\/]+/).filter(Boolean);

  if (parts.length <= 2) {
    return truncate(homeRelative, width);
  }

  const prefix = homeRelative.startsWith("~") ? "~/" : ".../";
  const tail = parts.slice(-2).join("/");

  return truncate(`${prefix}${tail}`, width);
}

export function truncate(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (value.length <= width) {
    return value;
  }

  if (width === 1) {
    return value.slice(0, 1);
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

export function toneToColor(
  colors: ReturnType<typeof getTuiThemeColors>,
  tone: UiTone
): string {
  switch (tone) {
    case "accent":
      return colors.accent;
    case "secondary":
      return colors.accentSecondary;
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "error":
      return colors.error;
    case "text":
      return colors.text;
    case "muted":
    default:
      return colors.muted;
  }
}

function fitBadgeLabels(
  badges: readonly StatusBadgeDescriptor[],
  width: number
): StatusBadgeDescriptor[] {
  const output: StatusBadgeDescriptor[] = [];
  let used = 0;

  for (const badge of badges) {
    const label = width < 70 ? truncate(badge.label, 14) : badge.label;
    const nextWidth = label.length + (output.length > 0 ? 1 : 0) + 2;

    if (used + nextWidth > width) {
      continue;
    }

    output.push({
      ...badge,
      label
    });
    used += nextWidth;
  }

  return output;
}

function fitLabels(labels: readonly string[], width: number): string[] {
  const output: string[] = [];
  let used = 0;

  for (const label of labels) {
    const nextWidth = label.length + (output.length > 0 ? 2 : 0);

    if (used + nextWidth > width) {
      break;
    }

    output.push(label);
    used += nextWidth;
  }

  return output.length > 0
    ? output
    : labels.slice(0, 1).map((label) => truncate(label, width));
}

function taskStateTone(state: string): UiTone {
  if (/fail|error/i.test(state)) {
    return "error";
  }

  if (/block|wait|approval|pause/i.test(state)) {
    return "warning";
  }

  if (/run|active|stream|think|build/i.test(state)) {
    return "accent";
  }

  if (/complete|done|pass|ready|clear|ok/i.test(state)) {
    return "success";
  }

  return "muted";
}
