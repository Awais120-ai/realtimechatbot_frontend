import axiosPrivate from "./axiosPrivate";

// List Conversations
export const getConversations = async () => {
    const response = await axiosPrivate.get("/chat/conversations");
    return response.data;
};

// Create New Conversation (Flexible for title / participant_id / is_group)
export const createConversation = async (payload) => {
    const response = await axiosPrivate.post("/chat/conversations", payload);
    return response.data;
};

// Get Messages for a Conversation
export const getConversationMessages = async (conversationId) => {
    const response = await axiosPrivate.get(`/chat/messages/${conversationId}`);
    return response.data;
};

// Get Members of a Conversation
export const getConversationMembers = async (conversationId) => {
    const response = await axiosPrivate.get(`/chat/conversations/${conversationId}/members`);
    return response.data;
};

// Mark Message as Read
export const markMessageAsRead = async (messageId) => {
    const response = await axiosPrivate.patch(`/chat/messages/${messageId}/read`);
    return response.data;
};

// Get All Users (New Chat start karne ke liye)
export const getUsers = async () => {
    const response = await axiosPrivate.get("/users/");
    return response.data;
};

// ==========================================
// NEW / MISSING ENDPOINTS (ADDITION ONLY)
// ==========================================

/**
 * Upload attachments (images/files) for real-time processing
 * @param {FormData} formData
 */
export const uploadChatFile = async (formData) => {
    const response = await axiosPrivate.post('/chat/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

/**
 * Fetch past chat room message history
 * @param {string} roomId
 * @param {number} page
 */
export const getChatHistory = async (roomId, page = 1) => {
    const response = await axiosPrivate.get(`/chat/history/${roomId}`, {
        params: { page },
    });
    return response.data;
};

/**
 * Clear or reset specific chat session
 * @param {string} roomId
 */
export const clearChatSession = async (conversationId) => {
    const response = await axiosPrivate.delete(`/chat/session/${conversationId}`);
    return response.data;
};


export const getUnreadCount = async (conversationId) => {
    const response = await axiosPrivate.get(
        `/chat/conversations/${conversationId}/unread-count`
    );

    return response.data;
};