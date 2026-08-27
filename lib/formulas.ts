export type DateRange = { start: Date; end: Date };
export type PacingStatus = 'Abaixo do ritmo' | 'Dentro do ritmo' | 'Risco de estouro' | 'Orçamento excedido';

const dayMs = 86_400_000;
export function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
export function endOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999); }
export function daysInclusive(start: Date, end: Date) { return Math.max(0, Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / dayMs) + 1); }

export function corporateYtd(selected: Date): DateRange {
  const year = selected.getFullYear(); const limit = new Date(year, 9, 31); const end = selected > limit ? limit : selected;
  return { start: new Date(year, 0, 1), end: endOfDay(end) };
}

export function rollingTwelveMonths(selected: Date): DateRange {
  const end = endOfDay(selected); const start = startOfDay(new Date(selected.getFullYear() - 1, selected.getMonth(), selected.getDate() + 1));
  return { start, end };
}

export function monthRange(selected: Date): DateRange { return { start: new Date(selected.getFullYear(), selected.getMonth(), 1), end: endOfDay(new Date(selected.getFullYear(), selected.getMonth() + 1, 0)) }; }
export function dayRange(selected: Date): DateRange { return { start: startOfDay(selected), end: endOfDay(selected) }; }

export function safeDivide(numerator: number, denominator: number): number | null { return denominator === 0 ? null : numerator / denominator; }
export function achievement(realized: number, goal: number) { return safeDivide(realized, goal); }
export function goalBalance(realized: number, goal: number) { return realized - goal; }
export function remainingGoal(realized: number, goal: number) { return goal - realized; }
export function variation(current: number, previous: number) { return { absolute: current - previous, percentage: safeDivide(current - previous, previous) }; }

export function validateWeights(weights: number[]): boolean { return weights.length === 12 && weights.slice(0, 10).every((weight) => weight >= 0) && weights.slice(10).every((weight) => weight === 0) && Math.abs(weights.slice(0, 10).reduce((sum, value) => sum + value, 0) - 1) < 1e-9; }
export function distributeAnnualGoal(annualGoal: number, weights = [.1,.1,.1,.1,.1,.1,.1,.1,.1,.1,0,0]) {
  if (!validateWeights(weights)) throw new Error('Os pesos de janeiro a outubro devem somar 100%; novembro e dezembro devem ser zero.');
  return weights.map((weight) => annualGoal * weight);
}

export function proportionalGoalForRange(annualGoal: number, range: DateRange, weights = [.1,.1,.1,.1,.1,.1,.1,.1,.1,.1,0,0]) {
  const distributed = distributeAnnualGoal(annualGoal, weights); let total = 0;
  for (let year = range.start.getFullYear(); year <= range.end.getFullYear(); year += 1) {
    for (let month = 0; month < 10; month += 1) {
      const monthStart = new Date(year, month, 1); const monthEnd = endOfDay(new Date(year, month + 1, 0));
      const overlapStart = range.start > monthStart ? range.start : monthStart; const overlapEnd = range.end < monthEnd ? range.end : monthEnd;
      if (overlapStart <= overlapEnd) total += distributed[month] * daysInclusive(overlapStart, overlapEnd) / daysInclusive(monthStart, monthEnd);
    }
  }
  return total;
}

export function calculateBudgetPacing(budget: number, spent: number, elapsedDays: number, daysInMonth: number) {
  const safeElapsed = Math.max(1, elapsedDays); const remainingDays = Math.max(0, daysInMonth - elapsedDays); const balance = budget - spent; const consumed = safeDivide(spent, budget); const expected = budget * elapsedDays / daysInMonth; const projection = spent / safeElapsed * daysInMonth; const projectedDifference = budget - projection; const recommendedDaily = remainingDays === 0 ? 0 : Math.max(0, balance) / remainingDays;
  let status: PacingStatus = 'Dentro do ritmo';
  if (spent > budget) status = 'Orçamento excedido'; else if (projection > budget * 1.05) status = 'Risco de estouro'; else if (projection < budget * .9) status = 'Abaixo do ritmo';
  return { balance, consumed, expected, paceDeviation: spent - expected, projection, projectedDifference, remainingDays, recommendedDaily, status };
}
