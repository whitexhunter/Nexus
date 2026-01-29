
import React, { useState, useEffect } from 'react';
import { User, FriendRequest } from '../types';
import { db } from '../services/storage';

interface FriendRequestsProps {
  currentUser: User;
}

const FriendRequests: React.FC<FriendRequestsProps> = ({ currentUser }) => {
  const [requestId, setRequestId] = useState('');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = db.subscribeToIncomingRequests(currentUser.id, (incoming) => {
      setRequests(incoming);
    });
    return () => unsubscribe();
  }, [currentUser.id]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const targetUser = await db.getUserByUsername(requestId);
    
    if (!targetUser) {
      setStatus({ type: 'error', message: 'User ID not found in global database.' });
      return;
    }

    if (targetUser.id === currentUser.id) {
      setStatus({ type: 'error', message: 'Cannot add self.' });
      return;
    }

    const newRequest: FriendRequest = {
      id: crypto.randomUUID(),
      fromId: currentUser.id,
      toId: targetUser.id,
      status: 'pending',
      timestamp: Date.now()
    };

    await db.sendFriendRequest(newRequest);
    setStatus({ type: 'success', message: `Request sent to ${targetUser.username}.` });
    setRequestId('');
  };

  const handleAction = async (requestId: string, action: 'accepted' | 'rejected') => {
    await db.handleFriendRequest(requestId, action);
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-12">
      <div className="max-w-2xl mx-auto space-y-12">
        <header>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Connections</h1>
          <p className="text-indigo-200/40">Nexus identities are discoverable via global Unique User IDs.</p>
        </header>

        <section className="bg-white/5 p-8 rounded-3xl border border-white/10 shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">Send New Request</h2>
          <form onSubmit={handleSendRequest} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="Search Global User ID..."
              className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all active:scale-95">
              Discovery
            </button>
          </form>
          {status && (
            <div className={`mt-4 p-4 rounded-xl text-sm font-medium ${status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {status.message}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-6">Incoming Requests ({requests.length})</h2>
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="bg-white/5 border border-dashed border-white/10 p-12 rounded-3xl text-center text-white/20 italic">
                No pending identity requests.
              </div>
            ) : (
              requests.map(req => (
                <IncomingRequestItem key={req.id} req={req} onAction={handleAction} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const IncomingRequestItem: React.FC<{ req: FriendRequest, onAction: (id: string, action: 'accepted' | 'rejected') => void }> = ({ req, onAction }) => {
  const [sender, setSender] = useState<User | null>(null);

  useEffect(() => {
    db.getUser(req.fromId).then(setSender);
  }, [req.fromId]);

  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold">
          {sender?.username.charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <h4 className="font-bold text-lg">{sender?.username || 'Loading...'}</h4>
          <p className="text-xs text-indigo-200/40 uppercase tracking-widest">Wants to establish session</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onAction(req.id, 'accepted')} className="p-3 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white rounded-xl transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
        </button>
        <button onClick={() => onAction(req.id, 'rejected')} className="p-3 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  );
};

export default FriendRequests;
