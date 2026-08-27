import React, { useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { SOCKET_EVENTS } from '@/websocket/socketEvents';

export const MessageInput = ({ conversationId, currentUserId }) => {
    const socket = useSocket();
    const typingTimeoutRef = useRef(null);

    const handleInputChange = (e) => {
        if (!socket || !conversationId) return;

        // 1. Emit 'typing' socket event when user types
        socket.emit(SOCKET_EVENTS.TYPING, {
            conversationId,
            userId: currentUserId,
        });

        // 2. Clear previous timeout if user is still typing
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // 3. Emit 'stop_typing' after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit(SOCKET_EVENTS.STOP_TYPING, {
                conversationId,
                userId: currentUserId,
            });
        }, 2000);
    };

    return (
        <div className="message-input-container">
            <input
                type="text"
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="message-input"
            />
        </div>
    );
};

export default MessageInput;