import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  doc,
  collection,
  onSnapshot,
  deleteDoc,
  updateDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Group, Member, Expense, Payment, RecentGroup } from '../types';
import type { ActivityType } from '../utils/activityLogger';

interface Activity {
  id: string;
  type: ActivityType;
  text: string;
  createdAt: Date;
}
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { calculateBalances, simplifyDebts } from '../utils/balanceCalculator';
import AddMemberModal from '../components/AddMemberModal';
import AddExpenseModal from '../components/AddExpenseModal';
import SettleUpModal from '../components/SettleUpModal';
import IdentityModal from '../components/IdentityModal';

type Tab = 'expenses' | 'balances' | 'members' | 'stats';

const CHART_COLORS = ['#00e5a0', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function shareOnWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function toDate(val: Timestamp | Date | null | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  return val;
}

function saveRecentGroup(id: string, name: string) {
  try {
    const stored: RecentGroup[] = JSON.parse(localStorage.getItem('baagam_recent_groups') ?? '[]');
    const filtered = stored.filter(g => g.id !== id);
    const updated = [{ id, name, visitedAt: new Date().toISOString() }, ...filtered].slice(0, 10);
    localStorage.setItem('baagam_recent_groups', JSON.stringify(updated));
  } catch {}
}

function getIdentityId(groupId: string): string | null {
  return localStorage.getItem(`identity_${groupId}`);
}

function saveIdentityId(groupId: string, memberId: string) {
  localStorage.setItem(`identity_${groupId}`, memberId);
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tab, setTab] = useState<Tab>('expenses');
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [identityMemberId, setIdentityMemberId] = useState<string | null>(
    groupId ? getIdentityId(groupId) : null,
  );
  const [showIdentityModal, setShowIdentityModal] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSettleUp, setShowSettleUp] = useState(false);

  // Edit group name
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!groupId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(doc(db, 'groups', groupId), snap => {
        if (!snap.exists()) { setNotFound(true); return; }
        const d = snap.data();
        const g: Group = { id: snap.id, name: d.name, code: d.code, createdAt: toDate(d.createdAt) };
        setGroup(g);
        saveRecentGroup(snap.id, d.name);
      }),
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', groupId, 'members'), snap => {
        const loaded = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name,
          upiId: d.data().upiId ?? undefined,
          createdAt: toDate(d.data().createdAt),
        }));
        setMembers(loaded);
        // Show identity modal if identity not set and members exist
        if (loaded.length > 0 && !getIdentityId(groupId)) {
          setShowIdentityModal(true);
        }
      }),
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', groupId, 'expenses'), snap => {
        setExpenses(snap.docs.map(d => ({
          id: d.id,
          description: d.data().description,
          amount: d.data().amount,
          paidByMemberId: d.data().paidByMemberId,
          date: toDate(d.data().date),
          category: d.data().category ?? undefined,
          splitAmong: d.data().splitAmong ?? [],
          splits: d.data().splits ?? undefined,
        })));
      }),
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', groupId, 'payments'), snap => {
        setPayments(snap.docs.map(d => ({
          id: d.id,
          fromMemberId: d.data().fromMemberId,
          toMemberId: d.data().toMemberId,
          amount: d.data().amount,
          date: toDate(d.data().date),
        })));
      }),
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', groupId, 'activities'), snap => {
        setActivities(
          snap.docs
            .map(d => ({
              id: d.id,
              type: d.data().type as ActivityType,
              text: d.data().text,
              createdAt: toDate(d.data().createdAt),
            }))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 20),
        );
      }),
    );

    return () => unsubs.forEach(u => u());
  }, [groupId]);

  const handleIdentitySelect = (member: Member) => {
    if (!groupId) return;
    saveIdentityId(groupId, member.id);
    setIdentityMemberId(member.id);
    setShowIdentityModal(false);
  };

  const deleteExpense = async (expenseId: string) => {
    if (!groupId || !window.confirm('Delete this expense?')) return;
    await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId));
  };

  const deletePayment = async (paymentId: string) => {
    if (!groupId || !window.confirm('Delete this payment?')) return;
    await deleteDoc(doc(db, 'groups', groupId, 'payments', paymentId));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditName = () => {
    if (!group) return;
    setNameInput(group.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const saveGroupName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !groupId || trimmed === group?.name) { setEditingName(false); return; }
    await updateDoc(doc(db, 'groups', groupId), { name: trimmed });
    setEditingName(false);
  };

  const deleteGroup = async () => {
    if (!groupId) return;
    const confirmed = window.confirm(`Delete "${group?.name}"? This will permanently remove all expenses, members, and data. This cannot be undone.`);
    if (!confirmed) return;
    const subcollections = ['members', 'expenses', 'payments', 'activities'];
    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, 'groups', groupId, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
    await deleteDoc(doc(db, 'groups', groupId));
    try {
      const stored = JSON.parse(localStorage.getItem('baagam_recent_groups') ?? '[]');
      localStorage.setItem('baagam_recent_groups', JSON.stringify(stored.filter((g: { id: string }) => g.id !== groupId)));
    } catch {}
    navigate('/');
  };

  const exportSummary = () => {
    if (!group) return;
    const sortedExp = [...expenses].sort((a, b) => a.date.getTime() - b.date.getTime());
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${group.name} — Baagam Summary</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; color: #111; padding: 0 20px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 32px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin: 24px 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; border-bottom: 2px solid #eee; padding: 6px 8px; color: #666; font-size: 12px; }
    td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
    .amount { text-align: right; font-weight: 600; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .neutral { color: #666; }
    .total { font-weight: 700; font-size: 18px; color: #111; }
    .footer { margin-top: 40px; color: #999; font-size: 12px; text-align: center; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${group.name}</h1>
  <p class="meta">Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · ${members.length} members · ${expenses.length} expenses</p>

  <h2>Summary</h2>
  <p class="total">Total spent: ₹${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}</p>

  <h2>Balances</h2>
  <table>
    <tr><th>Member</th><th class="amount">Balance</th></tr>
    ${balances.map(b => `<tr>
      <td>${b.memberName}</td>
      <td class="amount ${b.net > 0.005 ? 'positive' : b.net < -0.005 ? 'negative' : 'neutral'}">
        ${b.net > 0.005 ? `+₹${b.net.toFixed(2)}` : b.net < -0.005 ? `-₹${(-b.net).toFixed(2)}` : 'Settled'}
      </td>
    </tr>`).join('')}
  </table>

  ${settlements.length > 0 ? `
  <h2>Settlements</h2>
  <table>
    <tr><th>From</th><th>To</th><th class="amount">Amount</th></tr>
    ${settlements.map(s => `<tr><td>${s.fromName}</td><td>${s.toName}</td><td class="amount">₹${s.amount.toFixed(2)}</td></tr>`).join('')}
  </table>` : ''}

  <h2>Expenses</h2>
  <table>
    <tr><th>Date</th><th>Description</th><th>Paid by</th><th class="amount">Amount</th></tr>
    ${sortedExp.map(e => `<tr>
      <td>${e.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
      <td>${e.description}${e.category ? ` <span style="color:#999;font-size:11px">[${e.category}]</span>` : ''}</td>
      <td>${memberMap[e.paidByMemberId] ?? '?'}</td>
      <td class="amount">₹${e.amount.toFixed(2)}</td>
    </tr>`).join('')}
  </table>

  <p class="footer">Exported from Baagam</p>
</body>
</html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-text2 text-lg mb-4">Group not found.</p>
        <Link to="/" className="text-accent text-sm underline">← Create a new group</Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const balances = calculateBalances(members, expenses, payments);
  const settlements = simplifyDebts(balances);
  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));
  const memberUpiMap = Object.fromEntries(members.filter(m => m.upiId).map(m => [m.id, m.upiId!]));

  const sortedExpenses = [...expenses].sort((a, b) => b.date.getTime() - a.date.getTime());
  const sortedPayments = [...payments].sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  // Category chart data
  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    const cat = e.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + e.amount;
  }
  const categoryData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  // Per-person spend data
  const personSpend: Record<string, number> = {};
  for (const e of expenses) {
    personSpend[e.paidByMemberId] = (personSpend[e.paidByMemberId] ?? 0) + e.amount;
  }
  const personData = members
    .map(m => ({ name: m.name, value: Math.round((personSpend[m.id] ?? 0) * 100) / 100 }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const buildWhatsAppSummary = () => {
    const lines: string[] = [];
    lines.push(`💰 *${group.name} — Expense Summary*`);
    lines.push(`Total: ₹${totalSpend.toFixed(2)}\n`);
    lines.push('*Balances:*');
    for (const b of balances) {
      if (b.net > 0.005) lines.push(`✅ ${b.memberName} gets back ₹${b.net.toFixed(2)}`);
      else if (b.net < -0.005) lines.push(`🔴 ${b.memberName} owes ₹${(-b.net).toFixed(2)}`);
      else lines.push(`✔️ ${b.memberName} is settled`);
    }
    if (settlements.length > 0) {
      lines.push('\n*Settlements:*');
      for (const s of settlements) {
        lines.push(`👉 ${s.fromName} → ${s.toName}: ₹${s.amount.toFixed(2)}`);
      }
    }
    lines.push(`\n_Shared from Baagam_`);
    return lines.join('\n');
  };

  const activityIcons: Record<ActivityType, string> = {
    expense_added: '🧾',
    expense_edited: '✏️',
    member_added: '👤',
    payment_added: '💸',
  };

  const myName = identityMemberId ? memberMap[identityMemberId] : null;

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 pb-8">
      {/* Header */}
      <div className="pt-10 pb-6">
        <Link to="/" className="text-text3 text-sm hover:text-text2 transition-colors">← All groups</Link>
        <div className="flex items-start justify-between mt-3 gap-3">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  className="input text-xl font-bold py-1 px-2"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGroupName(); if (e.key === 'Escape') setEditingName(false); }}
                />
                <button onClick={saveGroupName} className="btn-primary py-1.5 px-3 text-sm shrink-0">Save</button>
                <button onClick={() => setEditingName(false)} className="text-text3 text-sm hover:text-text2 shrink-0">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-text truncate">{group.name}</h1>
                <button onClick={startEditName} className="text-text3 hover:text-text2 transition-colors shrink-0" title="Rename">✏️</button>
              </div>
            )}
            <p className="text-text3 text-sm mt-0.5">
              {members.length} {members.length === 1 ? 'member' : 'members'} · {expenses.length}{' '}
              {expenses.length === 1 ? 'expense' : 'expenses'}
              {myName && <> · <span className="text-accent">{myName}</span></>}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0 mt-1">
            <div className="flex gap-1.5">
              {myName && (
                <button onClick={() => setShowIdentityModal(true)} className="bg-surface2 border border-border px-2.5 py-1.5 rounded-xl text-xs text-text2 hover:text-text transition-colors">
                  Switch
                </button>
              )}
              <button onClick={copyLink} className="bg-surface2 border border-border px-2.5 py-1.5 rounded-xl text-xs text-text2 hover:text-text transition-colors">
                {copied ? '✓ Copied' : '🔗 Share'}
              </button>
            </div>
            {expenses.length > 0 && (
              <button onClick={exportSummary} className="bg-surface2 border border-border px-2.5 py-1.5 rounded-xl text-xs text-text2 hover:text-text transition-colors text-center">
                Export PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 mb-5">
        {(['expenses', 'balances', 'members', 'stats'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${
              tab === t ? 'bg-surface2 text-text' : 'text-text3 hover:text-text2'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Expenses tab */}
      {tab === 'expenses' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="label mb-0">Expenses</span>
            <button
              className="btn-primary text-sm py-1.5 px-3"
              onClick={() => setShowAddExpense(true)}
              disabled={members.length < 2}
            >
              + Add
            </button>
          </div>

          {members.length < 2 && (
            <div className="card text-text3 text-sm text-center py-6 mb-3">
              Add at least 2 members before adding expenses.
            </div>
          )}

          {members.length >= 2 && sortedExpenses.length === 0 && (
            <div className="card text-text3 text-sm text-center py-6 mb-4">
              No expenses yet. Add the first one!
            </div>
          )}

          <div className="flex flex-col gap-2 mb-6">
            {sortedExpenses.map(exp => {
              const isCustom = exp.splits && Object.keys(exp.splits).length > 0;
              const share = !isCustom && exp.splitAmong.length > 0
                ? (exp.amount / exp.splitAmong.length).toFixed(2)
                : null;
              return (
                <div key={exp.id} className="card flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-text font-semibold text-sm truncate">{exp.description}</p>
                    <p className="text-text3 text-xs mt-0.5">
                      Paid by{' '}
                      <span className="text-text2">{memberMap[exp.paidByMemberId] ?? '?'}</span>
                      {share && <> · ₹{share} each</>}
                      {isCustom && <> · custom split</>}
                      {exp.category && (
                        <span className="ml-1.5 bg-surface px-1.5 py-0.5 rounded text-text3">{exp.category}</span>
                      )}
                    </p>
                    <p className="text-text3 text-xs mt-0.5">
                      {exp.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-text font-bold text-base">₹{exp.amount.toFixed(2)}</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditingExpense(exp)}
                        className="text-text3 hover:text-text2 text-xs px-2 py-1 rounded-lg border border-border bg-surface transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteExpense(exp.id)}
                        className="text-danger hover:text-danger/80 text-xs px-2 py-1 rounded-lg border border-danger/30 bg-danger/5 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activity feed */}
          {activities.length > 0 && (
            <>
              <p className="label mb-3">Activity</p>
              <div className="flex flex-col gap-1.5">
                {activities.map(a => (
                  <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
                    <span className="text-base mt-0.5">{activityIcons[a.type]}</span>
                    <div>
                      <p className="text-text text-sm">{a.text}</p>
                      <p className="text-text3 text-xs mt-0.5">
                        {a.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {a.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Balances tab */}
      {tab === 'balances' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="label mb-0">Balances</span>
            <div className="flex gap-2">
              {expenses.length > 0 && (
                <button
                  onClick={() => shareOnWhatsApp(buildWhatsAppSummary())}
                  className="bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-[#25D366]/20 transition-colors"
                >
                  WhatsApp
                </button>
              )}
              {settlements.length > 0 && (
                <button className="btn-primary text-sm py-1.5 px-3" onClick={() => setShowSettleUp(true)}>
                  Settle up
                </button>
              )}
            </div>
          </div>

          {members.length === 0 && (
            <div className="card text-text3 text-sm text-center py-6">
              Add members to see balances.
            </div>
          )}

          <div className="flex flex-col gap-2 mb-5">
            {balances.map(b => (
              <div key={b.memberId} className="card flex items-center justify-between">
                <span className="text-text font-semibold text-sm">{b.memberName}</span>
                <span className={`font-bold text-sm ${
                  b.net > 0.005 ? 'text-accent' : b.net < -0.005 ? 'text-danger' : 'text-text3'
                }`}>
                  {b.net > 0.005 ? `+₹${b.net.toFixed(2)}` : b.net < -0.005 ? `-₹${(-b.net).toFixed(2)}` : 'Settled'}
                </span>
              </div>
            ))}
          </div>

          {settlements.length > 0 && (
            <>
              <label className="label">Suggested settlements</label>
              <div className="flex flex-col gap-2 mb-5">
                {settlements.map((s, i) => {
                  const upiId = memberUpiMap[s.to];
                  const upiLink = upiId
                    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(s.toName)}&am=${s.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Baagam settlement')}`
                    : null;
                  return (
                    <div key={i} className="card flex items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-semibold text-text">{s.fromName}</span>
                        <span className="text-text3"> → </span>
                        <span className="font-semibold text-text">{s.toName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-accent font-bold">₹{s.amount.toFixed(2)}</span>
                        {upiLink && (
                          <a
                            href={upiLink}
                            className="bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors"
                          >
                            Pay UPI
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {members.length > 0 && settlements.length === 0 && expenses.length > 0 && (
            <div className="card text-accent text-sm text-center py-4 font-semibold mb-5">
              All settled up! 🎉
            </div>
          )}

          {/* Recorded payments */}
          {sortedPayments.length > 0 && (
            <>
              <label className="label">Recorded payments</label>
              <div className="flex flex-col gap-2">
                {sortedPayments.map(p => (
                  <div key={p.id} className="card flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-sm">
                        <span className="font-semibold">{memberMap[p.fromMemberId] ?? '?'}</span>
                        <span className="text-text3"> → </span>
                        <span className="font-semibold">{memberMap[p.toMemberId] ?? '?'}</span>
                      </p>
                      <p className="text-text3 text-xs mt-0.5">
                        {p.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-accent font-bold text-sm">₹{p.amount.toFixed(2)}</span>
                      <button
                        onClick={() => deletePayment(p.id)}
                        className="text-danger hover:text-danger/80 text-xs px-2 py-1 rounded-lg border border-danger/30 bg-danger/5 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="label mb-0">Members</span>
            <button className="btn-primary text-sm py-1.5 px-3" onClick={() => setShowAddMember(true)}>
              + Add
            </button>
          </div>

          {members.length === 0 && (
            <div className="card text-text3 text-sm text-center py-6">
              No members yet. Add the first one!
            </div>
          )}

          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div
                key={m.id}
                className={`card flex items-center gap-3 ${m.id === identityMemberId ? 'border-accent/50' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  m.id === identityMemberId ? 'bg-accent text-black' : 'bg-accent/10 text-accent'
                }`}>
                  {m.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-text font-semibold text-sm">{m.name}</span>
                    {m.id === identityMemberId && (
                      <span className="text-accent text-xs font-semibold">You</span>
                    )}
                  </div>
                  {m.upiId && (
                    <p className="text-text3 text-xs mt-0.5">{m.upiId}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-text3 text-xs mb-3">Danger zone</p>
            <button onClick={deleteGroup} className="btn-danger w-full text-sm">
              Delete group
            </button>
          </div>
        </div>
      )}

      {/* Stats tab */}
      {tab === 'stats' && (
        <div>
          {expenses.length === 0 ? (
            <div className="card text-text3 text-sm text-center py-6">
              Add some expenses to see stats.
            </div>
          ) : (
            <>
              {/* Total */}
              <div className="card mb-4 text-center">
                <p className="text-text3 text-xs font-semibold uppercase tracking-wide mb-1">Total spent</p>
                <p className="text-accent text-3xl font-bold">₹{totalSpend.toFixed(2)}</p>
                <p className="text-text3 text-xs mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Category donut */}
              {categoryData.length > 0 && (
                <div className="card mb-4">
                  <p className="text-text font-semibold text-sm mb-4">By category</p>
                  <div className="flex items-center gap-4">
                    <PieChart width={140} height={140}>
                      <Pie
                        data={categoryData}
                        cx={65}
                        cy={65}
                        innerRadius={42}
                        outerRadius={65}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown) => [`₹${Number(v).toFixed(2)}`, '']}
                        contentStyle={{ background: '#1c1c22', border: '1px solid #2c2c36', borderRadius: 10, fontSize: 12 }}
                        itemStyle={{ color: '#f2f2f5' }}
                      />
                    </PieChart>
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      {categoryData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-text2 text-xs truncate flex-1">{d.name}</span>
                          <span className="text-text text-xs font-semibold shrink-0">₹{d.value.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Per-person bar chart */}
              {personData.length > 0 && (
                <div className="card">
                  <p className="text-text font-semibold text-sm mb-4">Paid by person</p>
                  <ResponsiveContainer width="100%" height={personData.length * 44 + 10}>
                    <BarChart
                      data={personData}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                      barSize={18}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={70}
                        tick={{ fill: '#9494a8', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: unknown) => [`₹${Number(v).toFixed(2)}`, 'Paid']}
                        contentStyle={{ background: '#1c1c22', border: '1px solid #2c2c36', borderRadius: 10, fontSize: 12 }}
                        itemStyle={{ color: '#f2f2f5' }}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar dataKey="value" fill="#00e5a0" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showIdentityModal && members.length > 0 && (
        <IdentityModal
          members={members}
          onSelect={handleIdentitySelect}
          onSkip={() => setShowIdentityModal(false)}
        />
      )}
      {showAddMember && groupId && (
        <AddMemberModal
          groupId={groupId}
          existingMembers={members}
          onClose={(added) => {
            setShowAddMember(false);
            if (added && !identityMemberId) setShowIdentityModal(true);
          }}
        />
      )}
      {showAddExpense && groupId && (
        <AddExpenseModal
          groupId={groupId}
          members={members}
          defaultPaidBy={identityMemberId ?? undefined}
          onClose={() => setShowAddExpense(false)}
        />
      )}
      {editingExpense && groupId && (
        <AddExpenseModal
          groupId={groupId}
          members={members}
          expense={editingExpense}
          defaultPaidBy={identityMemberId ?? undefined}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {showSettleUp && groupId && (
        <SettleUpModal
          groupId={groupId}
          members={members}
          settlements={settlements}
          onClose={() => setShowSettleUp(false)}
        />
      )}
    </div>
  );
}
