import { configureStore } from '@reduxjs/toolkit';
import chatReducer from '@/features/chat/store/chatSlice';
import messageReducer from '@/features/message/store/messageSlice';

export const store = configureStore({
    reducer: {
        chat: chatReducer,
        message: messageReducer,
    },
});

export default store;
