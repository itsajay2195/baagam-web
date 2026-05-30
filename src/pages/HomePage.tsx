import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { nanoid } from "nanoid";
import { db } from "../firebase";
import type { RecentGroup } from "../types";

function getRecentGroups(): RecentGroup[] {
  try {
    return JSON.parse(localStorage.getItem("baagam_recent_groups") ?? "[]");
  } catch {
    return [];
  }
}

export default function HomePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentGroups] = useState<RecentGroup[]>(getRecentGroups);

  const createGroup = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const code = nanoid(8);
      const docRef = await addDoc(collection(db, "groups"), {
        name: trimmed,
        code,
        createdAt: serverTimestamp(),
      });
      navigate(`/group/${docRef.id}`);
    } catch (e) {
      console.log("eee>", e);
      setError("Could not create group. Check your Firebase config.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-accent mb-2">Baagam</h1>
          <p className="text-text2 text-sm">
            Split expenses with friends — no sign-up needed
          </p>
        </div>

        <div className="card mb-5">
          <h2 className="text-text font-bold text-lg mb-5">
            Create a new group
          </h2>

          <label className="label">Group name</label>
          <input
            className="input mb-4"
            placeholder="e.g. Goa Trip, Flat Expenses"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createGroup()}
            autoFocus
          />

          {error && <p className="text-danger text-sm mb-4">{error}</p>}

          <button
            className="btn-primary w-full"
            onClick={createGroup}
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating..." : "Create Group →"}
          </button>
        </div>

        {recentGroups.length > 0 && (
          <div>
            <p className="label">Recent groups</p>
            <div className="flex flex-col gap-2">
              {recentGroups.map(g => (
                <Link
                  key={g.id}
                  to={`/group/${g.id}`}
                  className="card flex items-center justify-between hover:border-accent/50 transition-colors"
                >
                  <div>
                    <p className="text-text font-semibold text-sm">{g.name}</p>
                    <p className="text-text3 text-xs mt-0.5">
                      {new Date(g.visitedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-text3 text-lg">›</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="text-text3 text-xs text-center mt-6">
          After creating, share the link with your friends. Everyone with the
          link can add expenses.
        </p>
      </div>
    </div>
  );
}
