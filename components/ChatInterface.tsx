
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { db } from '../services/storage';

interface ChatInterfaceProps {
  currentUser: User;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser }) => {
  const [friends, setFriends] = useState<User[]>([]);
  const [activeFriend, setActiveFriend] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Load friends
  useEffect(() => {
    const unsubscribe = db.subscribeToFriends(currentUser.id, (friendList) => {
      setFriends(friendList);
    });
    return () => unsubscribe();
  }, [currentUser.id]);

  // Load messages & handle Read Receipts
  useEffect(() => {
    if (!activeFriend) return;

    const unsubscribe = db.subscribeToMessages(currentUser.id, activeFriend.id, (msgs) => {
      setMessages(msgs);
      // Mark as read if receiving unread messages
      if (msgs.some(m => m.receiverId === currentUser.id && !m.isRead)) {
        db.markMessagesAsRead(currentUser.id, activeFriend.id);
      }
    });

    // Listen to friend's typing status
    const unsubscribeStatus = db.subscribeToUser(activeFriend.id, (updatedFriend) => {
      setIsFriendTyping(updatedFriend.typingTo === currentUser.id);
      // Also update local friend object for online status
      setFriends(prev => prev.map(f => f.id === updatedFriend.id ? updatedFriend : f));
      if (activeFriend.id === updatedFriend.id) {
        setActiveFriend(updatedFriend);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [currentUser.id, activeFriend?.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isFriendTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFriend || !newMessage.trim()) return;

    const msg: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      receiverId: activeFriend.id,
      content: newMessage.trim(),
      timestamp: Date.now(),
      isRead: false
    };

    // Clear typing status immediately on send
    db.updateUserStatus(currentUser.id, { typingTo: null });
    await db.sendMessage(msg);
    setNewMessage('');
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    
    // Update Firestore typing status
    if (activeFriend) {
      db.updateUserStatus(currentUser.id, { typingTo: activeFriend.id });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        db.updateUserStatus(currentUser.id, { typingTo: null });
      }, 3000);
    }
  };

  const getStatusString = (user: User) => {
    const isOnline = (Date.now() - user.lastSeen) < 60000;
    if (isOnline) return 'Online';
    const mins = Math.floor((Date.now() - user.lastSeen) / 60000);
    if (mins < 1) return 'Last seen just now';
    if (mins < 60) return `Last seen ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Last seen ${hours}h ago`;
    return `Last seen long ago`;
  };

  const isUserOnline = (user: User) => (Date.now() - user.lastSeen) < 60000;

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Contact List */}
      <div className={`${activeFriend ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-white/5 bg-black/20 overflow-hidden`}>
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-bold">Secure Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          {friends.length === 0 ? (
            <div className="p-8 text-center text-white/30 italic text-sm">
              No contacts yet. Use ID to send requests.
            </div>
          ) : (
            friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => setActiveFriend(friend)}
                className={`w-full flex items-center gap-4 p-4 transition-all hover:bg-white/5 ${activeFriend?.id === friend.id ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
              >
                <div className="relative">
                  <img src={friend.avatar || ''} className={`w-12 h-12 rounded-full object-cover border-2 ${isUserOnline(friend) ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'border-white/10'}`} alt="" />
                  {isUserOnline(friend) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1e1b4b] rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <h3 className="font-semibold text-white truncate">{friend.username}</h3>
                  <p className="text-xs text-indigo-200/40 truncate">{getStatusString(friend)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${activeFriend ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white/5`}>
        {activeFriend ? (
          <>
            <div className="p-4 bg-indigo-950/20 backdrop-blur-sm border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveFriend(null)} className="md:hidden p-2 text-indigo-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <img src={activeFriend.avatar || ''} className="w-10 h-10 rounded-full border border-white/10" alt="" />
                <div>
                  <h3 className="font-bold">{activeFriend.username}</h3>
                  {isFriendTyping ? (
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest animate-pulse">Typing...</p>
                  ) : (
                    <p className={`text-[10px] uppercase tracking-widest ${isUserOnline(activeFriend) ? 'text-green-400' : 'text-white/30'}`}>
                      {getStatusString(activeFriend)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  </div>
                  <p className="text-center font-medium">Messages are peer-to-peer encrypted.<br/>No logs on central servers.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${msg.senderId === currentUser.id ? 'bg-indigo-600 rounded-tr-none shadow-lg shadow-indigo-600/10' : 'bg-white/10 rounded-tl-none border border-white/5'}`}>
                      <p className="text-sm">{msg.content}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className="text-[9px] text-white/40">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {msg.senderId === currentUser.id && (
                          <span className={`${msg.isRead ? 'text-blue-400' : 'text-white/20'}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7M5 13l4 4L19 7"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isFriendTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 px-4 py-2 rounded-2xl rounded-tl-none flex gap-1">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              <div ref={messageEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-black/20 border-t border-white/5 flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Type a secure message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 p-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-90"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
            <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-2xl">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-white">Nexus Unified Messaging</h2>
            <p className="text-lg max-w-sm">Peer-to-peer communication powered by Firebase. Select a contact to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
