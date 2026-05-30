import type { Member } from '../types';

interface Props {
  members: Member[];
  onSelect: (member: Member) => void;
  onSkip: () => void;
}

export default function IdentityModal({ members, onSelect, onSkip }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-surface2 border border-border rounded-2xl p-5 w-full max-w-sm">
        <h3 className="text-text font-bold text-base mb-1">Who are you?</h3>
        <p className="text-text3 text-sm mb-4">Pick your name so we can pre-fill expenses for you.</p>

        <div className="flex flex-col gap-2 mb-3">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:border-accent hover:bg-accent/5 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                {m.name[0]?.toUpperCase()}
              </div>
              <span className="text-text font-semibold text-sm">{m.name}</span>
            </button>
          ))}
        </div>

        <button onClick={onSkip} className="w-full text-center text-text3 text-sm py-2 hover:text-text2 transition-colors">
          I'm not listed yet — skip
        </button>
      </div>
    </div>
  );
}
