import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    messages: [],
    typingUsers: {}, // Structure: { [conversationId]: [userId1, userId2] }
};

const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        setUserTyping: (state, action) => {
            const { conversationId, userId } = action.payload;
            if (!conversationId || !userId) return;

            const strUserId = String(userId);

            if (!state.typingUsers[conversationId]) {
                state.typingUsers[conversationId] = [];
            }

            if (!state.typingUsers[conversationId].includes(strUserId)) {
                state.typingUsers[conversationId].push(strUserId);
            }
        },
        setUserStoppedTyping: (state, action) => {
            const { conversationId, userId } = action.payload;
            if (!conversationId || !userId) return;

            const strUserId = String(userId);

            if (state.typingUsers[conversationId]) {
                state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
                    (id) => String(id) !== strUserId
                );
            }
        },
    },
});

export const { setUserTyping, setUserStoppedTyping } = chatSlice.actions;
export default chatSlice.reducer;
