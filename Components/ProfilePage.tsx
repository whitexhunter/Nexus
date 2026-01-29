
import React, { useState, useRef } from 'react';
import { User } from '../types';
import { db, authService, vaultDb } from '../services/storage';

interface ProfilePageProps {
  currentUser: User;
  onUpdateUser: (user: User) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser, onUpdateUser }) => {
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio);
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSimulated = db.isSimulated();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    // If username changed, check availability
    if (username !== currentUser.username) {
      const existing = await db.getUserByUsername(username);
      if (existing) {
        setStatus({ type: 'error', message: 'Username already claimed.' });
        return;
      }
    }

    const updates: Partial<User> = {
      username,
      bio,
      avatar,
      passwordHash: password ? authService.encryptPassword(password) : currentUser.passwordHash,
    };

    await db.updateUserStatus(currentUser.id, updates);
    
    // Sync local vault
    const vault = vaultDb.getVault();
    const vaultIdx = vault.findIndex(v => v.username === currentUser.username);
    if (vaultIdx > -1) {
      vault[vaultIdx] = {
        username,
        passwordHash: updates.passwordHash!,
        lastLogin: Date.now()
      };
      vaultDb.saveVault(vault);
    }

    onUpdateUser({ ...currentUser, ...updates });
    setStatus({ type: 'success', message: 'Nexus identity updated successfully.' });
    setPassword('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-12">
      <div className="max-w-2xl mx-auto space-y-12 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Identity</h1>
            <p className="text-indigo-200/40">Manage your global Nexus profile credentials.</p>
          </div>
          
          <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${isSimulated ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-green-500/10 border-green-500/30 text-green-500'}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isSimulated ? 'bg-amber-500' : 'bg-green-500'}`}></div>
            {isSimulated ? 'Local Sandbox' : 'Nexus Cloud Live'}
          </div>
        </header>

        {isSimulated && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl">
            <h3 className="text-indigo-300 font-bold mb-1 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Firebase Connection Required
            </h3>
            <p className="text-indigo-200/60 text-sm leading-relaxed">
              Nexus is currently running in <b>Simulated Mode</b>. This means your data is stored locally in this browser. To sync across devices, update <code>services/storage.ts</code> with your Firebase project keys.
            </p>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="relative group self-center md:self-start">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-3xl overflow-hidden border-2 border-indigo-500/50 shadow-2xl shadow-indigo-500/20 cursor-pointer relative"
              >
                <img src={avatar || ''} className="w-full h-full object-cover" alt="Avatar" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                  <span className="text-[10px] text-white font-bold uppercase">Change Image</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>

            <div className="flex-1 space-y-6 w-full">
              <div>
                <label className="block text-sm font-semibold text-indigo-200 mb-2 uppercase tracking-widest text-[10px]">Public User ID</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-indigo-200 mb-2 uppercase tracking-widest text-[10px]">Identity Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 resize-none" />
              </div>
              <div className="pt-6 border-t border-white/5">
                <label className="block text-sm font-semibold text-red-400 mb-2 uppercase tracking-widest text-[10px]">Identity Secret (Password)</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Keep empty to preserve secret" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" />
              </div>
              {status && (
                <div className={`p-4 rounded-xl text-sm font-medium ${status.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {status.message}
                </div>
              )}
              <button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-12 rounded-2xl shadow-xl transition-all">
                Update Profile
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
