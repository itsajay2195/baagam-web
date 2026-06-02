import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { RecentGroup } from '../types';

function getLocalRecentGroups(): RecentGroup[] {
  try {
    return JSON.parse(localStorage.getItem('baagam_recent_groups') ?? '[]');
  } catch {
    return [];
  }
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, loading, signIn, signOut } = useAuth();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [myGroups, setMyGroups] = useState<RecentGroup[]>([]);
  const [localGroups] = useState<RecentGroup[]>(getLocalRecentGroups);

  // Real-time listener for signed-in user's groups
  useEffect(() => {
    if (!user) { setMyGroups([]); return; }
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'groups'),
      snap => {
        const groups = snap.docs
          .map(d => ({ id: d.id, name: d.data().name, visitedAt: d.data().visitedAt ?? '' }))
          .sort((a, b) => (b.visitedAt > a.visitedAt ? 1 : -1));
        setMyGroups(groups);
      },
    );
    return unsub;
  }, [user]);

  const createGroup = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError('');
    try {
      const code = nanoid(8);
      const data: Record<string, unknown> = {
        name: trimmed,
        code,
        createdAt: serverTimestamp(),
      };
      if (user) data.createdBy = user.uid;

      const docRef = await addDoc(collection(db, 'groups'), data);

      if (user) {
        await setDoc(doc(db, 'users', user.uid, 'groups', docRef.id), {
          name: trimmed,
          visitedAt: new Date().toISOString(),
        });
      }

      navigate(`/group/${docRef.id}`);
    } catch (e) {
      console.error(e);
      setError('Could not create group. Check your Firebase config.');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayGroups = user ? myGroups : localGroups;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-accent mb-1">Baagam</h1>
          <p className="text-text2 text-sm">Split expenses with friends</p>
        </div>

        {/* Auth bar */}
        <div className="flex items-center justify-between mb-5 card py-3">
          {user ? (
            <>
              <div className="flex items-center gap-2.5">
                {user.photoURL && (
                  <img src={user.photoURL} className="w-7 h-7 rounded-full" alt="" />
                )}
                <div>
                  <p className="text-text text-sm font-semibold leading-none">{user.displayName}</p>
                  <p className="text-text3 text-xs mt-0.5">Groups sync across devices</p>
                </div>
              </div>
              <button onClick={signOut} className="text-text3 text-xs hover:text-text2 transition-colors">
                Sign out
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-text text-sm font-semibold">Sign in to sync groups</p>
                <p className="text-text3 text-xs mt-0.5">Access your groups on any device</p>
              </div>
              <button
                onClick={signIn}
                className="flex items-center gap-2 bg-white text-gray-800 font-semibold text-xs px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
            </>
          )}
        </div>

        {/* Create group */}
        <div className="card mb-5">
          <h2 className="text-text font-bold text-base mb-4">Create a new group</h2>
          <label className="label">Group name</label>
          <input
            className="input mb-4"
            placeholder="e.g. Goa Trip, Flat Expenses"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createGroup()}
            autoFocus
          />
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button
            className="btn-primary w-full"
            onClick={createGroup}
            disabled={creating || !name.trim()}
          >
            {creating ? 'Creating...' : 'Create Group →'}
          </button>
        </div>

        {/* Groups list */}
        {displayGroups.length > 0 && (
          <div>
            <p className="label">{user ? 'My groups' : 'Recent groups'}</p>
            <div className="flex flex-col gap-2">
              {displayGroups.map(g => (
                <Link
                  key={g.id}
                  to={`/group/${g.id}`}
                  className="card flex items-center justify-between hover:border-accent/40 transition-colors"
                >
                  <div>
                    <p className="text-text font-semibold text-sm">{g.name}</p>
                    {g.visitedAt && (
                      <p className="text-text3 text-xs mt-0.5">
                        {new Date(g.visitedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span className="text-text3 text-lg">›</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <p className="text-text3 text-xs text-center mt-6">
            Sign in with Google to access your groups on any device.
          </p>
        )}
      </div>
    </div>
  );
}
