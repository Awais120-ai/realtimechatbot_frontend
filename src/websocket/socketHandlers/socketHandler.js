import { store } from '@/config/store';
import { setUserTyping, setUserStoppedTyping } from '@/features/message/messageSlice';
import { SOCKET_EVENTS } from './events';

export const setupSocketListeners = (socket) => {
    if (!socket) return;

    // Pehle existing listeners cleanup karein (duplicate listeners se bachne ke liye)
    socket.off(SOCKET_EVENTS.USER_TYPING);
    socket.off(SOCKET_EVENTS.USER_STOPPED_TYPING);

    // Incoming events handle karein
    socket.on(SOCKET_EVENTS.USER_TYPING, (data) => {
        console.log('⚡ Socket event received: USER_TYPING', data);
        store.dispatch(setUserTyping(data));
    });

    socket.on(SOCKET_EVENTS.USER_STOPPED_TYPING, (data) => {
        console.log('⚡ Socket event received: USER_STOPPED_TYPING', data);
        store.dispatch(setUserStoppedTyping(data));
    });
};