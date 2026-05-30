import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../utils/activityLogger';
import type { Member, Expense } from '../types';

const CATEGORIES = ['Food', 'Travel', 'Stay', 'Shopping', 'Entertainment', 'Utilities', 'Other'];

interface Props {
  groupId: string;
  members: Member[];
  expense?: Expense;
  defaultPaidBy?: string;
  onClose: () => void;
}

export default function AddExpenseModal({ groupId, members, expense, defaultPaidBy, onClose }: Props) {
  const isEdit = !!expense;
  const [desc, setDesc] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense?.amount.toString() ?? '');
  const [paidBy, setPaidBy] = useState(expense?.paidByMemberId ?? defaultPaidBy ?? members[0]?.id ?? '');
  const [category, setCategory] = useState(expense?.category ?? '');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>(
    expense?.splits && Object.keys(expense.splits).length > 0 ? 'custom' : 'equal',
  );
  const [splitAmong, setSplitAmong] = useState<string[]>(
    expense?.splitAmong ?? members.map(m => m.id),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    if (expense?.splits) {
      return Object.fromEntries(Object.entries(expense.splits).map(([k, v]) => [k, v.toString()]));
    }
    return Object.fromEntries(members.map(m => [m.id, '']));
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = parseFloat(amount);
  const equalShare = splitAmong.length > 0 && !isNaN(parsedAmount)
    ? (parsedAmount / splitAmong.length).toFixed(2)
    : '0';

  const customTotal = Object.values(customAmounts)
    .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const toggleSplit = (id: string) => {
    setSplitAmong(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    const trimmedDesc = desc.trim();

    if (!trimmedDesc) { setError('Enter a description.'); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('Enter a valid amount.'); return; }

    if (splitType === 'equal') {
      if (splitAmong.length === 0) { setError('Select at least one person to split with.'); return; }
    } else {
      const diff = Math.abs(customTotal - parsedAmount);
      if (diff > 0.01) {
        setError(`Custom amounts total ₹${customTotal.toFixed(2)}, but expense is ₹${parsedAmount.toFixed(2)}.`);
        return;
      }
    }

    setLoading(true);
    try {
      let splits: Record<string, number> | null = null;
      let finalSplitAmong = splitAmong;

      if (splitType === 'custom') {
        splits = Object.fromEntries(
          Object.entries(customAmounts)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([k, v]) => [k, parseFloat(v)]),
        );
        finalSplitAmong = Object.keys(splits);
      }

      const data: Record<string, unknown> = {
        description: trimmedDesc,
        amount: parsedAmount,
        paidByMemberId: paidBy,
        category: category || null,
        splitAmong: finalSplitAmong,
        splits: splits ?? null,
      };

      const paidByName = members.find(m => m.id === paidBy)?.name ?? '?';
      if (isEdit) {
        await updateDoc(doc(db, 'groups', groupId, 'expenses', expense.id), data);
        await logActivity(groupId, 'expense_edited', `${paidByName} edited "${trimmedDesc}" (₹${parsedAmount.toFixed(2)})`);
      } else {
        await addDoc(collection(db, 'groups', groupId, 'expenses'), {
          ...data,
          date: serverTimestamp(),
        });
        await logActivity(groupId, 'expense_added', `${paidByName} paid ₹${parsedAmount.toFixed(2)} for "${trimmedDesc}"`);
      }
      onClose();
    } catch {
      setError('Could not save expense. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-surface2 border border-border rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <h3 className="text-text font-bold text-base mb-4">{isEdit ? 'Edit expense' : 'Add expense'}</h3>

        <label className="label">Description</label>
        <input
          className="input mb-3"
          placeholder="e.g. Dinner at hotel"
          value={desc}
          onChange={e => { setDesc(e.target.value); setError(''); }}
        />

        <label className="label">Amount (₹)</label>
        <input
          className="input mb-3"
          placeholder="0.00"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={e => { setAmount(e.target.value); setError(''); }}
        />

        <label className="label">Paid by</label>
        <select
          className="input mb-3"
          value={paidBy}
          onChange={e => setPaidBy(e.target.value)}
        >
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <label className="label">Category</label>
        <select
          className="input mb-4"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">None</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Split type toggle */}
        <div className="flex gap-1 bg-surface rounded-xl p-1 mb-3">
          {(['equal', 'custom'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setSplitType(t); setError(''); }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
                splitType === t ? 'bg-surface2 text-text' : 'text-text3'
              }`}
            >
              {t === 'equal' ? 'Equal split' : 'Custom split'}
            </button>
          ))}
        </div>

        {splitType === 'equal' && (
          <>
            <label className="label">Split among</label>
            <div className="flex flex-wrap gap-2 mb-1">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleSplit(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                    splitAmong.includes(m.id)
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-surface border-border text-text3'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            {amount && splitAmong.length > 0 && (
              <p className="text-text3 text-xs mb-3">₹{equalShare} each</p>
            )}
          </>
        )}

        {splitType === 'custom' && (
          <>
            <label className="label">Amount per person</label>
            <div className="flex flex-col gap-2 mb-1">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-text text-sm w-24 truncate">{m.name}</span>
                  <input
                    className="input flex-1 py-2 text-sm"
                    placeholder="0"
                    type="number"
                    inputMode="decimal"
                    value={customAmounts[m.id] ?? ''}
                    onChange={e => {
                      setCustomAmounts(prev => ({ ...prev, [m.id]: e.target.value }));
                      setError('');
                    }}
                  />
                </div>
              ))}
            </div>
            {!isNaN(parsedAmount) && parsedAmount > 0 && (
              <p className={`text-xs mb-3 ${Math.abs(customTotal - parsedAmount) < 0.01 ? 'text-accent' : 'text-danger'}`}>
                Total: ₹{customTotal.toFixed(2)} / ₹{parsedAmount.toFixed(2)}
              </p>
            )}
          </>
        )}

        {error && <p className="text-danger text-sm mb-3">{error}</p>}

        <div className="flex gap-3 mt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={save} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
