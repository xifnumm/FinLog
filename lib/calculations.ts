export type ExpenseWithLog = {
  id: string;
  name: string;
  dedicated_amount: number | null;
  actual_amount: number | null;
};

export function computeDelta(expense: ExpenseWithLog): number | null {
  if (expense.dedicated_amount == null || expense.actual_amount == null)
    return null;
  return expense.dedicated_amount - expense.actual_amount;
}

export function computePeriodSummary(
  totalReceived: number,
  expenses: ExpenseWithLog[],
) {
  const totalLogged = expenses.reduce(
    (sum, e) => sum + (e.actual_amount ?? 0),
    0,
  );
  const withDedicated = expenses.filter(
    (e) => e.dedicated_amount != null && e.actual_amount != null,
  );
  const totalDedicated = expenses
    .filter((e) => e.dedicated_amount != null)
    .reduce((sum, e) => sum + e.dedicated_amount!, 0);
  const totalSaved = totalReceived - totalLogged;
  const overBudgetCount = withDedicated.filter(
    (e) => (e.actual_amount ?? 0) > e.dedicated_amount!,
  ).length;

  return {
    totalReceived,
    totalLogged,
    totalDedicated,
    totalSaved,
    overBudgetCount,
  };
}
