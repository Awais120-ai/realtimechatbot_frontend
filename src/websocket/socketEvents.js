export const SOCKET_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',

    // Client -> Server Typing Events
    TYPING: 'typing',
    STOP_TYPING: 'stop_typing',

    // Server -> Client Typing Broadcast Events
    USER_TYPING: 'user_typing',
    USER_STOPPED_TYPING: 'user_stopped_typing',

    // Message Events
    SEND_MESSAGE: 'send_message',
    RECEIVE_MESSAGE: 'receive_message',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
};

export default SOCKET_EVENTS;