import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc,
  collection,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Group, Member, Expense, Payment } from '../types';
import { calculateBalances, simplifyDebts } from '../utils/balanceCalculator';
import AddMemberModal from '../components/AddMemberModal';
import AddExpenseModal from '../components/AddExpenseModal';
import SettleUpModal from '../components/SettleUpModal';

type Tab = 'expenses' | 'balances' | 'members';

function toDate(val: Timestamp | Date | null | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  return val;
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<Tab>('expenses');
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(doc(db, 'groups', groupId), snap => {
        if (!snap.exists()) { setNotFound(true); return; }
        const d = snap.data();
        setGroup({ id: snap.id, name: d.name, code: d.code, createdAt: toDate(d.createdAt) });
      }),
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', groupId, 'members'), snap => {
        setMembers(snap.docs.map(d => ({
          id: d.id,
          name: d.data().name,
          createdAt: toDate(d.data().createdAt),
        })));
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

    return () => unsubs.forEach(u => u());
  }, [groupId]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const sortedExpenses = [...expenses].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 pb-8">
      {/* Header */}
      <div className="pt-10 pb-6">
        <Link to="/" className="text-text3 text-sm hover:text-text2 transition-colors">← All groups</Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-text">{group.name}</h1>
            <p className="text-text3 text-sm mt-0.5">
              {members.length} {members.length === 1 ? 'member' : 'members'} · {expenses.length}{' '}
              {expenses.length === 1 ? 'expense' : 'expenses'}
            </p>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 bg-surface2 border border-border px-3 py-2 rounded-xl text-sm text-text2 hover:text-text transition-colors mt-1"
          >
            <span>{copied ? '✓ Copied' : '🔗 Share'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 mb-5">
        {(['expenses', 'balances', 'members'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
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
            <div className="card text-text3 text-sm text-center py-6">
              No expenses yet. Add the first one!
            </div>
          )}

          <div className="flex flex-col gap-2">
            {sortedExpenses.map(exp => {
              const share = exp.splitAmong.length > 0
                ? (exp.amount / exp.splitAmong.length).toFixed(2)
                : '0';
              return (
                <div key={exp.id} className="card flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-text font-semibold text-sm truncate">{exp.description}</p>
                    <p className="text-text3 text-xs mt-0.5">
                      Paid by{' '}
                      <span className="text-text2">{memberMap[exp.paidByMemberId] ?? '?'}</span>
                      {exp.splitAmong.length > 0 && (
                        <> · ₹{share} each</>
                      )}
                      {exp.category && (
                        <span className="ml-1.5 bg-surface px-1.5 py-0.5 rounded text-text3">{exp.category}</span>
                      )}
                    </p>
                    <p className="text-text3 text-xs mt-0.5">
                      {exp.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-text font-bold text-base shrink-0">₹{exp.amount.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Balances tab */}
      {tab === 'balances' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="label mb-0">Balances</span>
            {settlements.length > 0 && (
              <button className="btn-primary text-sm py-1.5 px-3" onClick={() => setShowSettleUp(true)}>
                Settle up
              </button>
            )}
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
              <div className="flex flex-col gap-2">
                {settlements.map((s, i) => (
                  <div key={i} className="card flex items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-text">{s.fromName}</span>
                      <span className="text-text3"> → </span>
                      <span className="font-semibold text-text">{s.toName}</span>
                    </div>
                    <span className="text-accent font-bold shrink-0">₹{s.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {members.length > 0 && settlements.length === 0 && expenses.length > 0 && (
            <div className="card text-accent text-sm text-center py-4 font-semibold">
              All settled up! 🎉
            </div>
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
              <div key={m.id} className="card flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                  {m.name[0]?.toUpperCase()}
                </div>
                <span className="text-text font-semibold text-sm">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddMember && groupId && (
        <AddMemberModal
          groupId={groupId}
          existingMembers={members}
          onClose={() => setShowAddMember(false)}
        />
      )}
      {showAddExpense && groupId && (
        <AddExpenseModal
          groupId={groupId}
          members={members}
          onClose={() => setShowAddExpense(false)}
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
