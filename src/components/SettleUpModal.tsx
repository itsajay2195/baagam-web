import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../utils/activityLogger';
import type { Member, Settlement } from '../types';

interface Props {
  groupId: string;
  members: Member[];
  settlements: Settlement[];
  onClose: () => void;
}

export default function SettleUpModal({ groupId, members, settlements, onClose }: Props) {
  const [from, setFrom] = useState(settlements[0]?.from ?? members[0]?.id ?? '');
  const [to, setTo] = useState(settlements[0]?.to ?? members[1]?.id ?? '');
  const [amount, setAmount] = useState(settlements[0]?.amount.toFixed(2) ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const parsedAmount = parseFloat(amount);
    if (from === to) { setError('Payer and receiver cannot be the same.'); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('Enter a valid amount.'); return; }

    setLoading(true);
    try {
      await addDoc(collection(db, 'groups', groupId, 'payments'), {
        fromMemberId: from,
        toMemberId: to,
        amount: parsedAmount,
        date: serverTimestamp(),
      });
      const fromName = members.find(m => m.id === from)?.name ?? '?';
      const toName = members.find(m => m.id === to)?.name ?? '?';
      await logActivity(groupId, 'payment_added', `${fromName} paid ₹${parsedAmount.toFixed(2)} to ${toName}`);
      onClose();
    } catch {
      setError('Could not record payment. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-surface2 border border-border rounded-2xl p-5 w-full max-w-sm">
        <h3 className="text-text font-bold text-base mb-4">Record a payment</h3>

        {settlements.length > 0 && (
          <div className="mb-4">
            <label className="label">Suggested</label>
            <div className="flex flex-col gap-2">
              {settlements.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setFrom(s.from); setTo(s.to); setAmount(s.amount.toFixed(2)); }}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    from === s.from && to === s.to
                      ? 'border-accent bg-accent/10 text-text'
                      : 'border-border bg-surface text-text2'
                  }`}
                >
                  <span className="font-semibold text-text">{s.fromName}</span>
                  <span className="text-text3"> pays </span>
                  <span className="font-semibold text-accent">₹{s.amount.toFixed(2)}</span>
                  <span className="text-text3"> to </span>
                  <span className="font-semibold text-text">{s.toName}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="label">Paid by</label>
        <select className="input mb-3" value={from} onChange={e => setFrom(e.target.value)}>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <label className="label">Paid to</label>
        <select className="input mb-3" value={to} onChange={e => setTo(e.target.value)}>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <label className="label">Amount (₹)</label>
        <input
          className="input mb-4"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={e => { setAmount(e.target.value); setError(''); }}
        />

        {error && <p className="text-danger text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={save} disabled={loading}>
            {loading ? 'Saving...' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
