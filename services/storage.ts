import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  updateDoc,
  orderBy,
  writeBatch,
  enableNetwork,
  disableNetwork
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { User, Message, FriendRequest, Friendship, LocalVaultEntry } from '../types';

/**
 * NEXUS FIREBASE SETUP INSTRUCTIONS:
 * 1. Create a project at https://console.firebase.google.com/
 * 2. Enable "Firestore Database" in the build menu.
 * 3. Go to "Rules" and set them to:
 * allow read, write: if true; // Only for development/testing!
 * 4. Add these keys as Environment Variables in Netlify (prefixed with VITE_).
 */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let firestore: any = null;
// Check if API Key exists to determine if we should use Mock mode
let useMock = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("Placeholder");

try {
  if (!useMock) {
    const app = initializeApp(firebaseConfig);
    firestore = getFirestore(app);
  }
} catch (e) {
  console.warn("Nexus: Firebase initialization failed. Falling back to Simulated Mode.", e);
  useMock = true;
}

// Real-time channel for tab-to-tab simulation
const nexusChannel = new BroadcastChannel('nexus_realtime');

export const vaultDb = {
  getVault: (): LocalVaultEntry[] => JSON.parse(localStorage.getItem('nexus_vault') || '[]'),
  saveVault: (vault: LocalVaultEntry[]) => localStorage.setItem('nexus_vault', JSON.stringify(vault)),
  getLastSessionId: (): string | null => localStorage.getItem('nexus_last_session'),
  setLastSessionId: (userId: string | null) => {
    if (userId) localStorage.setItem('nexus_last_session', userId);
    else localStorage.removeItem('nexus_last_session');
  }
};

// --- SIMULATED DATABASE LOGIC (Local Fallback) ---
const mockStore = {
  get: (key: string) => JSON.parse(localStorage.getItem(`mock_${key}`) || '[]'),
  set: (key: string, data: any) => {
    localStorage.setItem(`mock_${key}`, JSON.stringify(data));
    nexusChannel.postMessage({ type: 'sync', key });
  }
};

const mockDb = {
  async getUser(id: string): Promise<User | null> {
    return mockStore.get('users').find((u: User) => u.id === id) || null;
  },
  async getUserByUsername(username: string): Promise<User | null> {
    return mockStore.get('users').find((u: User) => u.username.toLowerCase() === username.toLowerCase()) || null;
  },
  async saveUser(user: User) {
    const users = mockStore.get('users');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx > -1) users[idx] = user;
    else users.push(user);
    mockStore.set('users', users);
  },
  async updateUserStatus(userId: string, updates: Partial<User>) {
    const users = mockStore.get('users');
    const idx = users.findIndex((u: User) => u.id === userId);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...updates };
      mockStore.set('users', users);
      nexusChannel.postMessage({ type: 'user_update', userId, updates });
    }
  },
  subscribeToUser(userId: string, callback: (user: User) => void) {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'user_update' && e.data.userId === userId) {
        this.getUser(userId).then(u => u && callback(u));
      }
      if (e.data.type === 'sync' && e.data.key === 'users') {
        this.getUser(userId).then(u => u && callback(u));
      }
    };
    nexusChannel.addEventListener('message', handler);
    this.getUser(userId).then(u => u && callback(u));
    return () => nexusChannel.removeEventListener('message', handler);
  },
  subscribeToFriends(userId: string, callback: (friends: User[]) => void) {
    const refresh = () => {
      const friendships = mockStore.get('friendships');
      const friendIds = friendships
        .filter((f: Friendship) => f.user1Id === userId || f.user2Id === userId)
        .map((f: Friendship) => f.user1Id === userId ? f.user2Id : f.user1Id);
      const allUsers = mockStore.get('users');
      callback(allUsers.filter((u: User) => friendIds.includes(u.id)));
    };
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'sync' && (e.data.key === 'friendships' || e.data.key === 'users')) refresh();
    };
    nexusChannel.addEventListener('message', handler);
    refresh();
    return () => nexusChannel.removeEventListener('message', handler);
  },
  async sendMessage(msg: Message) {
    const msgs = mockStore.get('messages');
    msgs.push(msg);
    mockStore.set('messages', msgs);
    nexusChannel.postMessage({ type: 'new_msg', msg });
  },
  subscribeToMessages(userId: string, friendId: string, callback: (messages: Message[]) => void) {
    const refresh = () => {
      const all = mockStore.get('messages');
      callback(all.filter((m: Message) => 
        (m.senderId === userId && m.receiverId === friendId) || 
        (m.senderId === friendId && m.receiverId === userId)
      ).sort((a: Message, b: Message) => a.timestamp - b.timestamp));
    };
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'new_msg' || (e.data.type === 'sync' && e.data.key === 'messages')) refresh();
    };
    nexusChannel.addEventListener('message', handler);
    refresh();
    return () => nexusChannel.removeEventListener('message', handler);
  },
  async markMessagesAsRead(userId: string, senderId: string) {
    const msgs = mockStore.get('messages');
    let changed = false;
    msgs.forEach((m: Message) => {
      if (m.receiverId === userId && m.senderId === senderId && !m.isRead) {
        m.isRead = true;
        changed = true;
      }
    });
    if (changed) mockStore.set('messages', msgs);
  },
  async sendFriendRequest(req: FriendRequest) {
    const reqs = mockStore.get('requests');
    reqs.push(req);
    mockStore.set('requests', reqs);
  },
  subscribeToIncomingRequests(userId: string, callback: (reqs: FriendRequest[]) => void) {
    const refresh = () => {
      const all = mockStore.get('requests');
      callback(all.filter((r: FriendRequest) => r.toId === userId && r.status === 'pending'));
    };
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'sync' && e.data.key === 'requests') refresh();
    };
    nexusChannel.addEventListener('message', handler);
    refresh();
    return () => nexusChannel.removeEventListener('message', handler);
  },
  async handleFriendRequest(requestId: string, status: 'accepted' | 'rejected') {
    const reqs = mockStore.get('requests');
    const idx = reqs.findIndex((r: FriendRequest) => r.id === requestId);
    if (idx === -1) return;
    const req = reqs[idx];
    req.status = status;
    mockStore.set('requests', reqs);
    if (status === 'accepted') {
      const friendships = mockStore.get('friendships');
      friendships.push({
        id: [req.fromId, req.toId].sort().join('_'),
        user1Id: req.fromId,
        user2Id: req.toId,
        createdAt: Date.now()
      });
      mockStore.set('friendships', friendships);
    }
  }
};

// --- EXPORTED HYBRID DB ---
export const db = {
  isSimulated: () => useMock,
  
  getUser: async (id: string) => {
    if (useMock) return mockDb.getUser(id);
    try {
      const docRef = doc(firestore, 'users', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as User : null;
    } catch { 
      useMock = true;
      return mockDb.getUser(id); 
    }
  },

  getUserByUsername: async (username: string) => {
    if (useMock) return mockDb.getUserByUsername(username);
    try {
      const q = query(collection(firestore, 'users'), where('username', '==', username));
      const snap = await getDocs(q);
      return snap.empty ? null : snap.docs[0].data() as User;
    } catch { 
      useMock = true;
      return mockDb.getUserByUsername(username); 
    }
  },

  saveUser: async (user: User) => {
    if (useMock) return mockDb.saveUser(user);
    try { await setDoc(doc(firestore, 'users', user.id), user); }
    catch { 
      useMock = true;
      await mockDb.saveUser(user); 
    }
  },

  updateUserStatus: async (userId: string, updates: Partial<User>) => {
    if (useMock) return mockDb.updateUserStatus(userId, updates);
    try { await updateDoc(doc(firestore, 'users', userId), updates); }
    catch { 
      useMock = true;
      await mockDb.updateUserStatus(userId, updates); 
    }
  },

  subscribeToUser: (userId: string, callback: (user: User) => void) => {
    if (useMock) return mockDb.subscribeToUser(userId, callback);
    try {
      return onSnapshot(doc(firestore, 'users', userId), (doc) => {
        if (doc.exists()) callback(doc.data() as User);
      }, (err) => {
        console.warn("Nexus Cloud Error:", err.message);
        useMock = true;
        mockDb.subscribeToUser(userId, callback);
      });
    } catch { return mockDb.subscribeToUser(userId, callback); }
  },

  subscribeToFriends: (userId: string, callback: (friends: User[]) => void) => {
    if (useMock) return mockDb.subscribeToFriends(userId, callback);
    try {
      const q1 = query(collection(firestore, 'friendships'), where('user1Id', '==', userId));
      const q2 = query(collection(firestore, 'friendships'), where('user2Id', '==', userId));
      return onSnapshot(collection(firestore, 'friendships'), async () => {
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const ids = [...s1.docs.map(d => d.data().user2Id), ...s2.docs.map(d => d.data().user1Id)];
        if (ids.length === 0) return callback([]);
        const uq = query(collection(firestore, 'users'), where('id', 'in', ids));
        const us = await getDocs(uq);
        callback(us.docs.map(d => d.data() as User));
      }, () => {
        useMock = true;
        mockDb.subscribeToFriends(userId, callback);
      });
    } catch { return mockDb.subscribeToFriends(userId, callback); }
  },

  sendMessage: async (msg: Message) => {
    if (useMock) return mockDb.sendMessage(msg);
    try { await setDoc(doc(firestore, 'messages', msg.id), msg); }
    catch { 
      useMock = true;
      await mockDb.sendMessage(msg); 
    }
  },

  subscribeToMessages: (userId: string, friendId: string, callback: (messages: Message[]) => void) => {
    if (useMock) return mockDb.subscribeToMessages(userId, friendId, callback);
    try {
      const q = query(collection(firestore, 'messages'), orderBy('timestamp', 'asc'));
      return onSnapshot(q, (snap) => {
        const msgs = snap.docs.map(d => d.data() as Message)
          .filter(m => (m.senderId === userId && m.receiverId === friendId) || (m.senderId === friendId && m.receiverId === userId));
        callback(msgs);
      }, () => {
        useMock = true;
        mockDb.subscribeToMessages(userId, friendId, callback);
      });
    } catch { return mockDb.subscribeToMessages(userId, friendId, callback); }
  },

  markMessagesAsRead: async (userId: string, senderId: string) => {
    if (useMock) return mockDb.markMessagesAsRead(userId, senderId);
    try {
      const q = query(collection(firestore, 'messages'), where('receiverId', '==', userId), where('senderId', '==', senderId), where('isRead', '==', false));
      const snap = await getDocs(q);
      const batch = writeBatch(firestore);
      snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
      await batch.commit();
    } catch { 
      useMock = true;
      await mockDb.markMessagesAsRead(userId, senderId); 
    }
  },

  sendFriendRequest: async (req: FriendRequest) => {
    if (useMock) return mockDb.sendFriendRequest(req);
    try { await setDoc(doc(firestore, 'requests', req.id), req); }
    catch { 
      useMock = true;
      await mockDb.sendFriendRequest(req); 
    }
  },

  subscribeToIncomingRequests: (userId: string, callback: (reqs: FriendRequest[]) => void) => {
    if (useMock) return mockDb.subscribeToIncomingRequests(userId, callback);
    try {
      const q = query(collection(firestore, 'requests'), where('toId', '==', userId), where('status', '==', 'pending'));
      return onSnapshot(q, (snap) => callback(snap.docs.map(d => d.data() as FriendRequest)), () => {
        useMock = true;
        mockDb.subscribeToIncomingRequests(userId, callback);
      });
    } catch { return mockDb.subscribeToIncomingRequests(userId, callback); }
  },

  handleFriendRequest: async (requestId: string, status: 'accepted' | 'rejected') => {
    if (useMock) return mockDb.handleFriendRequest(requestId, status);
    try {
      const ref = doc(firestore, 'requests', requestId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const req = snap.data() as FriendRequest;
      await updateDoc(ref, { status });
      if (status === 'accepted') {
        const fid = [req.fromId, req.toId].sort().join('_');
        await setDoc(doc(firestore, 'friendships', fid), { id: fid, user1Id: req.fromId, user2Id: req.toId, createdAt: Date.now() });
      }
    } catch { 
      useMock = true;
      await mockDb.handleFriendRequest(requestId, status); 
    }
  }
};

export const authService = {
  encryptPassword: (password: string) => btoa(`NexusSalt_${password}`),
  comparePassword: (password: string, hash: string) => btoa(`NexusSalt_${password}`) === hash,
};
      
