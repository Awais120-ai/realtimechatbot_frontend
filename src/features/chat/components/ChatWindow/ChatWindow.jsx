import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSocket } from '@/hooks/useSocket';
import { SOCKET_EVENTS } from '@/websocket/socketEvents';
import TypingIndicator from '../../message/components/TypingIndicator/TypingIndicator';
import MessageInput from '../../message/components/MessageInput/MessageInput';

export const ChatWindow = ({ conversationId, currentUserId, activeContactName }) => {
    const socket = useSocket();

    // Read typingUsers from Redux store for the active conversation
    const typingUsers = useSelector((state) => {
        return (
            state.chat?.typingUsers?.[conversationId] ||
            state.message?.typingUsers?.[conversationId] ||
            []
        );
    });

    // Exclude current user from typing indicator display
    const otherUsersTyping = typingUsers.filter(
        (id) => String(id) !== String(currentUserId)
    );

    // Socket Room Join/Leave Logic
    useEffect(() => {
        if (socket && conversationId) {
            socket.emit(SOCKET_EVENTS.JOIN_ROOM, { conversationId, userId: currentUserId });

            return () => {
                socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { conversationId, userId: currentUserId });
            };
        }
    }, [socket, conversationId, currentUserId]);

    return (
        <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header section with active user/contact typing indicator */}
            <div className="chat-header" style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
                <h3 style={{ margin: 0 }}>{activeContactName || `Chat #${conversationId}`}</h3>
                {otherUsersTyping.length > 0 && (
                    <span className="typing-status-header" style={{ fontSize: '12px', color: '#1677ff', fontStyle: 'italic' }}>
                        {otherUsersTyping.length === 1
                            ? `${activeContactName || 'Someone'} is typing...`
                            : `${otherUsersTyping.length} people are typing...`}
                    </span>
                )}
            </div>

            {/* Messages Area */}
            <div className="messages-container" style={{ flex: 1, overflowY: 'auto' }}>
                {/* Messages List */}
            </div>

            {/* Typing Indicator UI in message area */}
            <TypingIndicator conversationId={conversationId} currentUserId={currentUserId} />

            {/* Message Input Field */}
            <MessageInput conversationId={conversationId} currentUserId={currentUserId} />
        </div>
    );
};

export default ChatWindow;