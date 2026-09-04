import { getAccessToken } from "./token.service";

const WS_BASE_URL =
    import.meta.env.VITE_WS_URL ||
    "ws://192.168.18.83:8001/api/v1/ws";

/**
 * Create Native WebSocket connection
 */
export const createWebSocket = ({
    onOpen,
    onMessage,
    onClose,
    onError,
}) => {
    const token = getAccessToken();

    if (!token) {
        throw new Error("Access token not found.");
    }

    console.log("========== CREATING WEBSOCKET ==========");

    const websocket = new WebSocket(
        `${WS_BASE_URL}?token=${encodeURIComponent(token)}`
    );

    websocket.onopen = () => {
        console.log("========== WEBSOCKET CONNECTED ==========");
        console.log("WebSocket connected successfully.");

        onOpen?.();
    };

    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            console.log("========== WEBSOCKET EVENT ==========");
            console.log(data);
            console.log("======================================");

            onMessage?.(data);
        } catch (error) {
            console.error(
                "WEBSOCKET MESSAGE PARSE ERROR:",
                error
            );
        }
    };

    websocket.onerror = (error) => {
        console.error(
            "========== WEBSOCKET ERROR ==========",
            error
        );

        onError?.(error);
    };

    websocket.onclose = (event) => {
        console.log(
            "========== WEBSOCKET DISCONNECTED =========="
        );

        console.log("Code:", event.code);
        console.log("Reason:", event.reason);
        console.log("Was clean:", event.wasClean);

        onClose?.(event);
    };

    return websocket;
};


/**
 * Send typing status
 *
 * isTyping = true  -> user_typing
 * isTyping = false -> user_stopped_typing
 */
export const sendTypingStatus = (
    websocket,
    conversationId,
    isTyping
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    if (!conversationId) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: isTyping
                ? "typing"
                : "stop_typing",
            conversation_id: Number(conversationId),
        })
    );
};


/**
 * Send chat message
 *
 * Supports:
 * - Normal text messages
 * - Images
 * - Files / attachments
 */
/**
 * Send chat message
 */
export const sendChatMessage = (
    websocket,
    conversationId,
    content = "",
    attachment = null
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        console.error("WebSocket is not connected.");
        return;
    }

    if (!conversationId) {
        console.error("Conversation ID is required.");
        return;
    }

    const payload = {
        type: "message",
        conversation_id: Number(conversationId),
    };

    // =====================================================
    // FILE / IMAGE MESSAGE
    // =====================================================

    if (attachment) {
        payload.content =
            content?.trim() ||
            attachment.file_name ||
            "Attachment";

        payload.message_type =
            attachment.message_type || "file";

        payload.file_url =
            attachment.file_url;

        payload.file_name =
            attachment.file_name || null;

        payload.file_size =
            attachment.file_size || null;

        payload.mime_type =
            attachment.mime_type || null;

        console.log(
            "========== OUTGOING FILE MESSAGE =========="
        );

        console.log(
            JSON.stringify(
                payload,
                null,
                2
            )
        );

        console.log(
            "============================================"
        );

        // Important: backend requires file_url
        if (!payload.file_url) {
            console.error(
                "FILE URL IS MISSING:",
                attachment
            );

            return;
        }
    }

    // =====================================================
    // NORMAL TEXT MESSAGE
    // =====================================================

    else {
        if (!content?.trim()) {
            return;
        }

        payload.content = content.trim();
        payload.message_type = "text";

        console.log(
            "========== OUTGOING TEXT MESSAGE =========="
        );

        console.log(
            JSON.stringify(
                payload,
                null,
                2
            )
        );

        console.log(
            "==========================================="
        );
    }

    websocket.send(
        JSON.stringify(payload)
    );
};

/**
 * =====================================================
 * WEBRTC CALL SIGNALING
 * =====================================================
 */

export const sendCallInvite = (
    websocket,
    targetUserId,
    conversationId,
    callType = "audio"
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "call_invite",
            target_user_id: Number(targetUserId),
            conversation_id: Number(conversationId),
            call_type: callType,
        })
    );
};

export const sendCallAccept = (
    websocket,
    targetUserId,
    conversationId,
    callType = "audio"
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "call_accept",
            target_user_id: Number(targetUserId),
            conversation_id: Number(conversationId),
            call_type: callType,
        })
    );
};

export const sendCallReject = (
    websocket,
    targetUserId,
    conversationId
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "call_reject",
            target_user_id: Number(targetUserId),
            conversation_id: Number(conversationId),
        })
    );
};

export const sendCallEnd = (
    websocket,
    targetUserId,
    conversationId,
    duration = 0,
    callType = "audio",
    callInitiatorId = null
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "call_end",
            target_user_id: Number(targetUserId),
            conversation_id: Number(conversationId),
            duration: Number(duration) || 0,
            call_type: callType || "audio",
            call_initiator_id:
                callInitiatorId != null
                    ? Number(callInitiatorId)
                    : null,
        })
    );
};

export const sendWebRTCOffer = (
    websocket,
    targetUserId,
    conversationId,
    offer,
    callType = "audio",
    callStartedAt = null
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "webrtc_offer",
            target_user_id: Number(targetUserId),
            conversation_id: Number(conversationId),
            offer,
            call_type: callType,
            call_started_at: callStartedAt,
        })
    );
};

export const sendWebRTCAnswer = (
    websocket,
    targetUserId,
    conversationId,
    answer
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "webrtc_answer",
            target_user_id: Number(targetUserId),
            conversation_id: Number(conversationId),
            answer,
        })
    );
};

export const sendICECandidate = (
    websocket,
    targetUserId,
    conversationId,
    candidate
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "webrtc_ice_candidate",
            target_user_id: Number(targetUserId),
            conversation_id: Number(conversationId),
            candidate,
        })
    );
};

/**
 * Mark a single message as read
 */
export const sendReadReceipt = (
    websocket,
    messageId
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    if (!messageId) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "message_read",
            message_id: Number(messageId),
        })
    );
};


/**
 * Mark all unread messages in a conversation as read
 */
export const sendConversationRead = (
    websocket,
    conversationId
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    if (!conversationId) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "conversation_read",
            conversation_id: Number(conversationId),
        })
    );
};


/**
 * Edit message
 */
export const sendEditMessage = (
    websocket,
    messageId,
    content
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    if (
        !messageId ||
        !content?.trim()
    ) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "message_edited",
            message_id: Number(messageId),
            content: content.trim(),
        })
    );
};


/**
 * Delete message
 */
export const sendDeleteMessage = (
    websocket,
    messageId
) => {
    if (
        !websocket ||
        websocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    if (!messageId) {
        return;
    }

    websocket.send(
        JSON.stringify({
            type: "message_deleted",
            message_id: Number(messageId),
        })
    );
};