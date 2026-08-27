import React from 'react';
import { useSelector } from 'react-redux';

export const TypingIndicator = ({ conversationId, currentUserId }) => {
    // Read typingUsers from Redux store for the active conversation
    const typingUsers = useSelector((state) => {
        return (
            state.chat?.typingUsers?.[conversationId] ||
            state.message?.typingUsers?.[conversationId] ||
            []
        );
    });

    // Exclude current user ID so user doesn't see their own typing status
    const activeTypingUsers = typingUsers.filter(
        (id) => String(id) !== String(currentUserId)
    );

    if (activeTypingUsers.length === 0) return null;

    const text = activeTypingUsers.length === 1
        ? `Someone is typing...`
        : `${activeTypingUsers.length} people are typing...`;

    return (
        <div className="typing-indicator" style={{ padding: '8px 12px', color: '#1677ff', fontSize: '13px', fontStyle: 'italic' }}>
            <span>{text}</span>
        </div>
    );
};

export default TypingIndicator;