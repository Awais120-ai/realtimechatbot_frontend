import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    messages: [],
    typingUsers: {}, // Structure: { [conversationId]: [userId1, userId2] }
};

const messageSlice = createSlice({
    name: 'message',
    initialState,
    reducers: {
        setUserTyping: (state, action) => {
            const { conversationId, userId } = action.payload;
            if (!conversationId || !userId) return;

            const stringUserId = String(userId);

            if (!state.typingUsers[conversationId]) {
                state.typingUsers[conversationId] = [];
            }

            if (!state.typingUsers[conversationId].includes(stringUserId)) {
                state.typingUsers[conversationId].push(stringUserId);
            }
        },
        setUserStoppedTyping: (state, action) => {
            const { conversationId, userId } = action.payload;
            if (!conversationId || !userId) return;

            const stringUserId = String(userId);

            if (state.typingUsers[conversationId]) {
                state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
                    (id) => String(id) !== stringUserId
                );
            }
        },
    },
});

export const { setUserTyping, setUserStoppedTyping } = messageSlice.actions;
export default messageSlice.reducer;