
export interface User {
  id: string; 
  username: string; 
  passwordHash: string;
  bio: string;
  avatar: string | null;
  status: 'online' | 'offline';
  lastSeen: number; 
  typingTo?: string | null; // ID of the user they are currently typing to
}

export interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  isRead: boolean;
}

export interface LocalVaultEntry {
  username: string;
  passwordHash: string;
  lastLogin: number;
}
