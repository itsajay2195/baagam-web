import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Member } from '../types';

const CATEGORIES = ['Food', 'Travel', 'Stay', 'Shopping', 'Entertainment', 'Utilities', 'Other'];

interface Props {
  groupId: string;
  members: Member[];
  onClose: () => void;
}

export default function AddExpenseModal({ groupId, members, onClose }: Props) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? '');
  const [category, setCategory] = useState('');
  const [splitAmong, setSplitAmong] = useState<string[]>(members.map(m => m.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleSplit = (id: string) => {
    setSplitAmong(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    const trimmedDesc = desc.trim();
    const parsedAmount = parseFloat(amount);

    if (!trimmedDesc) { setError('Enter a description.'); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('Enter a valid amount.'); return; }
    if (splitAmong.length === 0) { setError('Select at least one person to split with.'); return; }

    setLoading(true);
    try {
      await addDoc(collection(db, 'groups', groupId, 'expenses'), {
        description: trimmedDesc,
        amount: parsedAmount,
        paidByMemberId: paidBy,
        date: serverTimestamp(),
        category: category || null,
        splitAmong,
      });
      onClose();
    } catch {
      setError('Could not save expense. Try again.');
      setLoading(false);
    }
  };

  const share = members.find(m => m.id === paidBy)
    ? splitAmong.length > 0
      ? (parseFloat(amount) / splitAmong.length).toFixed(2)
      : '0'
    : '0';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-surface2 border border-border rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <h3 className="text-text font-bold text-base mb-4">Add expense</h3>

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
          className="input mb-3"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">None</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

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
          <p className="text-text3 text-xs mb-3">₹{share} each</p>
        )}

        {error && <p className="text-danger text-sm mb-3">{error}</p>}

        <div className="flex gap-3 mt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={save} disabled={loading}>
            {loading ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
