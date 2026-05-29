import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Member } from '../types';

interface Props {
  groupId: string;
  existingMembers: Member[];
  onClose: () => void;
}

export default function AddMemberModal({ groupId, existingMembers, onClose }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const duplicate = existingMembers.some(
      m => m.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setError(`"${trimmed}" is already in the group.`);
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'groups', groupId, 'members'), {
        name: trimmed,
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setError('Could not add member. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-surface2 border border-border rounded-2xl p-5 w-full max-w-sm">
        <h3 className="text-text font-bold text-base mb-4">Add member</h3>

        <label className="label">Name</label>
        <input
          className="input mb-4"
          placeholder="e.g. Ajay"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && add()}
          autoFocus
        />

        {error && <p className="text-danger text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={add} disabled={loading || !name.trim()}>
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
