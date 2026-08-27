import { store } from '@/store/store'; // or store location
import { setUserTyping, setUserStoppedTyping } from '@/features/chat/store/chatSlice';
import { SOCKET_EVENTS } from './socketEvents';

/**
 * Attaches Socket.IO event listeners for typing indicators and dispatches actions to Redux.
 * @param {import('socket.io-client').Socket} socket 
 */
export const registerSocketManager = (socket) => {
    if (!socket) return;

    // Remove pre-existing listeners to prevent duplicate triggers
    socket.off(SOCKET_EVENTS.USER_TYPING);
    socket.off(SOCKET_EVENTS.USER_STOPPED_TYPING);

    // Listen for incoming 'user_typing' from backend
    socket.on(SOCKET_EVENTS.USER_TYPING, (data) => {
        console.log('⚡ [Socket.IO] user_typing event:', data);
        store.dispatch(setUserTyping(data));
    });

    // Listen for incoming 'user_stopped_typing' from backend
    socket.on(SOCKET_EVENTS.USER_STOPPED_TYPING, (data) => {
        console.log('⚡ [Socket.IO] user_stopped_typing event:', data);
        store.dispatch(setUserStoppedTyping(data));
    });
};

export default registerSocketManager;
