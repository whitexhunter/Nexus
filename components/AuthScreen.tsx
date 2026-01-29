
import React, { useState, useEffect } from 'react';
import { db, authService, vaultDb } from '../services/storage';
import { User, LocalVaultEntry } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [vault, setVault] = useState<LocalVaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setVault(vaultDb.getVault());
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const existing = await db.getUserByUsername(username);
        if (existing) {
          setError('Username already taken.');
          setIsLoading(false);
          return;
        }

        const newUser: User = {
          id: crypto.randomUUID(),
          username,
          passwordHash: authService.encryptPassword(password),
          bio: 'Nexus user active.',
          avatar: `https://picsum.photos/seed/${username}/200`,
          status: 'online',
          lastSeen: Date.now()
        };

        await db.saveUser(newUser);
        if (rememberMe) saveToVault(username, newUser.passwordHash);
        onLogin(newUser);
      } else {
        const user = await db.getUserByUsername(username);
        if (user && authService.comparePassword(password, user.passwordHash)) {
          await db.updateUserStatus(user.id, { status: 'online', lastSeen: Date.now() });
          if (rememberMe) saveToVault(username, user.passwordHash);
          onLogin({ ...user, status: 'online', lastSeen: Date.now() });
        } else {
          setError('Identity verification failed.');
        }
      }
    } catch (err) {
      setError('Connection to Nexus failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveToVault = (user: string, hash: string) => {
    const currentVault = vaultDb.getVault();
    const existingIdx = currentVault.findIndex(v => v.username === user);
    if (existingIdx > -1) {
      currentVault[existingIdx] = { username: user, passwordHash: hash, lastLogin: Date.now() };
    } else {
      currentVault.push({ username: user, passwordHash: hash, lastLogin: Date.now() });
    }
    vaultDb.saveVault(currentVault);
  };

  const loginFromVault = async (entry: LocalVaultEntry) => {
    setIsLoading(true);
    const user = await db.getUserByUsername(entry.username);
    if (user && user.passwordHash === entry.passwordHash) {
      await db.updateUserStatus(user.id, { status: 'online', lastSeen: Date.now() });
      onLogin({ ...user, status: 'online', lastSeen: Date.now() });
    } else {
      setError('Vault token expired.');
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full"></div>

      <div className="w-full max-w-md p-8 backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl z-10 mx-4 overflow-y-auto max-h-[90vh]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Nexus</h1>
          <p className="text-indigo-200/60 font-medium tracking-widest uppercase text-[10px]">Encrypted Global Messaging</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-100 mb-2">Unique User ID</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Username..."
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-indigo-100 mb-2">Secret Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-3 py-2">
            <input 
              type="checkbox" 
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-5 h-5 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="rememberMe" className="text-sm text-indigo-100/70 cursor-pointer select-none">
              Remember identity locally
            </label>
          </div>

          {error && <p className="text-red-400 text-sm font-medium animate-pulse">{error}</p>}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : (isRegistering ? 'Generate ID' : 'Initialize Session')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-indigo-300 hover:text-white text-sm font-medium transition-colors"
          >
            {isRegistering ? 'Existing User? Log In' : "New User? Register Global ID"}
          </button>
        </div>

        {vault.length > 0 && !isRegistering && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h2 className="text-xs font-semibold text-indigo-200/40 uppercase tracking-widest mb-4">Local Access Vault</h2>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {vault.sort((a,b) => b.lastLogin - a.lastLogin).map((entry) => (
                <button
                  key={entry.username}
                  onClick={() => loginFromVault(entry)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                    </div>
                    <p className="text-sm font-semibold text-white">{entry.username}</p>
                  </div>
                  <svg className="w-5 h-5 text-white/10 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;
