/**
 * Failure output of the data-reading romanization suites (F-CNT-002 §3.9): one finding
 * per line, shaped as a GitHub workflow annotation, so a failing PR names the file.
 */
import type { RomanizationIssue } from './compare';

/** `::error file=<path>,line=<n>::<rule>: <message>` (`::warning` for a warning; no line when unknown). */
export function formatRomanizationFinding(file: string, line: number | undefined, issue: RomanizationIssue): string {
  const where = line === undefined ? `file=${file}` : `file=${file},line=${line}`;
  return `::${issue.severity} ${where}::${issue.rule}: ${issue.message}`;
}

/** 1-based line of the first occurrence of `text` in `source`, or undefined. */
export function lineOfText(source: string, text: string): number | undefined {
  const at = source.indexOf(text);
  return at < 0 ? undefined : source.slice(0, at).split('\n').length;
}
