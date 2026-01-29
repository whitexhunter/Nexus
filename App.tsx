
import React, { useState, useEffect } from 'react';
import { User } from './types';
import { db, vaultDb } from './services/storage';
import AuthScreen from './components/AuthScreen';
import ChatInterface from './components/ChatInterface';
import ProfilePage from './components/ProfilePage';
import FriendRequests from './components/FriendRequests';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'profile' | 'requests'>('chats');
  const [isLoading, setIsLoading] = useState(true);
  const isSimulated = db.isSimulated();

  useEffect(() => {
    const initSession = async () => {
      try {
        const lastSessionId = vaultDb.getLastSessionId();
        if (lastSessionId) {
          const user = await db.getUser(lastSessionId);
          if (user) {
            await db.updateUserStatus(user.id, { status: 'online', lastSeen: Date.now() });
            setCurrentUser({ ...user, status: 'online', lastSeen: Date.now() });
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      db.updateUserStatus(currentUser.id, { lastSeen: Date.now() });
    }, 25000);

    const unsubscribe = db.subscribeToUser(currentUser.id, (updated) => {
      setCurrentUser(updated);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [currentUser?.id]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    vaultDb.setLastSessionId(user.id);
  };

  const handleLogout = async () => {
    if (currentUser) {
      await db.updateUserStatus(currentUser.id, { status: 'offline', lastSeen: Date.now(), typingTo: null });
    }
    setCurrentUser(null);
    vaultDb.setLastSessionId(null);
  };

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-[#0f172a] text-white">Initializing Nexus Session...</div>;

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-gradient-to-br from-[#1e1b4b] to-[#0f172a] text-white overflow-hidden">
      <nav className="w-full md:w-20 bg-indigo-950/40 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 flex md:flex-col items-center justify-between p-4 z-50">
        <div className="flex md:flex-col items-center gap-6">
          <div className="group relative">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${isSimulated ? 'from-amber-500 to-orange-600' : 'from-blue-500 to-purple-600'} flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20`}>
              {isSimulated ? 'S' : 'N'}
            </div>
            <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-[10px] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[100]">
              {isSimulated ? 'Simulated Session' : 'Nexus Cloud Session'}
            </div>
          </div>
          
          <button 
            onClick={() => setActiveTab('chats')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'chats' ? 'bg-white/20 text-white shadow-inner' : 'text-indigo-300 hover:text-white hover:bg-white/10'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'requests' ? 'bg-white/20 text-white shadow-inner' : 'text-indigo-300 hover:text-white hover:bg-white/10'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
          </button>
        </div>
        
        <div className="flex md:flex-col items-center gap-6">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-white/20 text-white shadow-inner' : 'text-indigo-300 hover:text-white hover:bg-white/10'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </button>
          <button 
            onClick={handleLogout}
            className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'chats' && <ChatInterface currentUser={currentUser} />}
        {activeTab === 'profile' && <ProfilePage currentUser={currentUser} onUpdateUser={setCurrentUser} />}
        {activeTab === 'requests' && <FriendRequests currentUser={currentUser} />}
        
        {isSimulated && (
          <div className="absolute top-2 right-2 bg-amber-500/20 text-amber-500 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md pointer-events-none z-50">
            Simulated Session (Local)
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
