import type { Member, Expense, Payment, Balance, Settlement } from '../types';

export function calculateBalances(
  members: Member[],
  expenses: Expense[],
  payments: Payment[],
): Balance[] {
  const net: Record<string, number> = {};
  members.forEach(m => { net[m.id] = 0; });

  for (const expense of expenses) {
    const share = expense.amount / expense.splitAmong.length;
    net[expense.paidByMemberId] = (net[expense.paidByMemberId] ?? 0) + expense.amount;
    for (const memberId of expense.splitAmong) {
      net[memberId] = (net[memberId] ?? 0) - share;
    }
  }

  for (const payment of payments) {
    net[payment.fromMemberId] = (net[payment.fromMemberId] ?? 0) - payment.amount;
    net[payment.toMemberId] = (net[payment.toMemberId] ?? 0) + payment.amount;
  }

  return members.map(m => ({
    memberId: m.id,
    memberName: m.name,
    net: Math.round((net[m.id] ?? 0) * 100) / 100,
  }));
}

export function simplifyDebts(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter(b => b.net > 0.005)
    .map(b => ({ ...b }))
    .sort((a, b) => b.net - a.net);
  const debtors = balances
    .filter(b => b.net < -0.005)
    .map(b => ({ ...b }))
    .sort((a, b) => a.net - b.net);

  const settlements: Settlement[] = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];
    const amount = Math.min(credit.net, -debt.net);

    if (amount > 0.005) {
      settlements.push({
        from: debt.memberId,
        fromName: debt.memberName,
        to: credit.memberId,
        toName: credit.memberName,
        amount: Math.round(amount * 100) / 100,
      });
    }

    credit.net -= amount;
    debt.net += amount;

    if (credit.net < 0.005) i++;
    if (-debt.net < 0.005) j++;
  }

  return settlements;
}
