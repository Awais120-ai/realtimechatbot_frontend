import { useEffect, useRef, useState } from "react";

import {
    Avatar,
    Button,
    Input,
    Typography,
    Spin,
    Modal,
    message as antMessage,
} from "antd";

import {
    LogoutOutlined,
    PlusOutlined,
    SearchOutlined,
    SendOutlined,
    UserOutlined,
    CheckOutlined,
    PaperClipOutlined,
    DownloadOutlined,
    FileImageOutlined,
    BellOutlined,
    SunOutlined,
    MoonOutlined,
    ArrowLeftOutlined,
} from "@ant-design/icons";

import { useNavigate } from "react-router-dom";

import {
    getAccessToken,
    clearTokens,
} from "../../../services/token.service";

import {
    createWebSocket,
    sendTypingStatus,
    sendChatMessage,
    sendReadReceipt,
    sendConversationRead,
    sendEditMessage,
    sendDeleteMessage,
} from "../../../services/websocket.service";

import {
    getConversations,
    getConversationMessages,
    createConversation,
    getUnreadCount,
    getUsers,
    uploadChatFile,
} from "../../../api/chat.api";

import styles from "./ChatPage.module.css";

const { Text } = Typography;


/* ============================================================
   HELPERS
============================================================ */

const getCurrentUserId = (token) => {
    if (!token) {
        return null;
    }

    try {
        const payload = JSON.parse(
            atob(token.split(".")[1])
        );

        return (
            payload.user_id ||
            payload.id ||
            payload.sub ||
            null
        );
    } catch {
        return null;
    }
};


const getConversationTitle = (conversation) => {
    if (!conversation) {
        return "Conversation";
    }

    const otherUser =
        conversation.other_user ||
        conversation.partner_user ||
        conversation.partner ||
        null;

    return (
        otherUser?.username ||
        otherUser?.name ||
        otherUser?.full_name ||
        conversation.display_name ||
        conversation.title ||
        conversation.name ||
        conversation.username ||
        `Chat #${conversation.id}`
    );
};


const normalizeFileUrl = (fileUrl) => {
    if (!fileUrl) {
        return null;
    }

    const value = String(fileUrl);

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    return `http://192.168.18.83:8001${value.startsWith("/") ? value : `/${value}`
        }`;
};


const getNotificationConversationId = (notification) => {
    if (!notification) {
        return null;
    }

    try {
        if (!notification.data) {
            return null;
        }

        if (typeof notification.data === "object") {
            return (
                notification.data.conversation_id ||
                notification.data.conversationId ||
                null
            );
        }

        const parsed = JSON.parse(notification.data);

        return (
            parsed?.conversation_id ||
            parsed?.conversationId ||
            null
        );
    } catch {
        return null;
    }
};


/* ============================================================
   COMPONENT
============================================================ */

const ChatPage = () => {
    const navigate = useNavigate();

    const websocketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const selectedContactRef = useRef(null);

    const token = getAccessToken();
    const currentUserId = getCurrentUserId(token);



    /* ============================================================
        DARK MODE
    ============================================================ */

    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("chat-theme") === "dark";
    });


    /* ========================================================
       CONNECTION
    ======================================================== */

    const [connected, setConnected] = useState(false);


    /* ========================================================
       CONVERSATIONS
    ======================================================== */

    const [conversations, setConversations] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);

    const [loadingConversations, setLoadingConversations] =
        useState(true);

    const [loadingMessages, setLoadingMessages] =
        useState(false);


    /* ========================================================
       MESSAGES
    ======================================================== */

    const [messageText, setMessageText] = useState("");
    const [messages, setMessages] = useState([]);


    /* ========================================================
       FILES
    ======================================================== */

    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadingFile, setUploadingFile] = useState(false);

    const [downloadedFiles, setDownloadedFiles] =
        useState(new Set());


    /* ========================================================
       NOTIFICATIONS
    ======================================================== */

    const [notifications, setNotifications] = useState([]);
    const [notificationCount, setNotificationCount] =
        useState(0);

    const [notificationOpen, setNotificationOpen] =
        useState(false);


    /* ========================================================
       EDIT / DELETE
    ======================================================== */

    const [editingMessageId, setEditingMessageId] =
        useState(null);

    const EDIT_DELETE_LIMIT = 3 * 60 * 1000;

    const [currentTime, setCurrentTime] =
        useState(Date.now());


    /* ========================================================
       SEARCH
    ======================================================== */

    const [search, setSearch] = useState("");


    /* ========================================================
       TYPING
    ======================================================== */

    const [isPartnerTyping, setIsPartnerTyping] =
        useState(false);


    /* ========================================================
       CREATE CHAT MODAL
    ======================================================== */

    const [isModalOpen, setIsModalOpen] =
        useState(false);

    const [creatingChat, setCreatingChat] =
        useState(false);

    const [users, setUsers] = useState([]);

    const [loadingUsers, setLoadingUsers] =
        useState(false);

    const [usersMap, setUsersMap] = useState({});

    const [userSearch, setUserSearch] =
        useState("");

    const [selectedUser, setSelectedUser] =
        useState(null);


    const [conversationPartnerMap, setConversationPartnerMap] =
        useState(() => {
            try {
                const saved =
                    localStorage.getItem(
                        `conversation_partner_map_${currentUserId}`
                    );

                return saved
                    ? JSON.parse(saved)
                    : {};
            } catch {
                return {};
            }
        });




    /* ========================================================
       toggle function
    ======================================================== */

    const toggleTheme = () => {
        setDarkMode((prev) => {
            const next = !prev;

            localStorage.setItem(
                "chat-theme",
                next ? "dark" : "light"
            );

            return next;
        });
    };


    /* ========================================================
       KEEP SELECTED CONTACT REF UPDATED
    ======================================================== */

    useEffect(() => {
        selectedContactRef.current =
            selectedContact;
    }, [selectedContact]);


    /* ========================================================
       AUTO SCROLL
    ======================================================== */

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages, isPartnerTyping]);


    /* ========================================================
       EDIT / DELETE TIMER
    ======================================================== */

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []);


    /* ========================================================
       FETCH CONVERSATIONS
    ======================================================== */

    const fetchConversations = async () => {
        try {
            setLoadingConversations(true);

            const data = await getConversations();

            const list = Array.isArray(data)
                ? data
                : (
                    data?.data ||
                    data?.conversations ||
                    []
                );

            const conversationsWithUnread =
                await Promise.all(
                    list.map(async (conversation) => {
                        try {
                            const unread =
                                await getUnreadCount(
                                    conversation.id
                                );

                            return {
                                ...conversation,
                                unread_count:
                                    unread?.unread_count || 0,
                            };
                        } catch (error) {
                            console.error(
                                `Failed to get unread count for conversation ${conversation.id}:`,
                                error
                            );

                            return {
                                ...conversation,
                                unread_count: 0,
                            };
                        }
                    })
                );

            setConversations((prev) => {
                /*
                 * IMPORTANT:
                 * Existing sidebar conversations ko kabhi remove
                 * nahi karna sirf is wajah se ke woh current
                 * refresh response mein temporarily missing hain.
                 */

                const freshMap = new Map(
                    conversationsWithUnread.map(
                        (conversation) => [
                            String(conversation.id),
                            conversation,
                        ]
                    )
                );

                /*
                 * Existing conversations preserve karo.
                 * Agar fresh data available hai to uski latest
                 * information merge karo.
                 */

                const updatedExisting = prev.map(
                    (conversation) => {
                        const freshConversation =
                            freshMap.get(
                                String(conversation.id)
                            );

                        if (!freshConversation) {
                            return conversation;
                        }

                        return {
                            ...conversation,
                            ...freshConversation,
                        };
                    }
                );

                /*
                 * Backend se new conversations add karo.
                 */

                const existingIds = new Set(
                    prev.map(
                        (conversation) =>
                            String(conversation.id)
                    )
                );

                const newConversations =
                    conversationsWithUnread.filter(
                        (conversation) =>
                            !existingIds.has(
                                String(conversation.id)
                            )
                    );

                return [
                    ...updatedExisting,
                    ...newConversations,
                ];
            });

            // IMPORTANT:
            // NEW MESSAGE handler ko fresh conversations chahiye
            return conversationsWithUnread;

        } catch (error) {
            console.error(
                "Failed to load conversations:",
                error
            );

            antMessage.error(
                "Failed to load conversations list"
            );

            return [];
        } finally {
            setLoadingConversations(false);
        }
    };


    useEffect(() => {
        if (token) {
            fetchConversations();
        }
    }, [token]);


    /* ========================================================
       FETCH USERS
    ======================================================== */

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);

            const data = await getUsers();

            const list = Array.isArray(data)
                ? data
                : (
                    data?.data ||
                    data?.users ||
                    []
                );

            const currentId =
                String(currentUserId || "");

            /*
             * Save complete user list in map.
             *
             * Example:
             * {
             *   "1": { id: 1, username: "Awais" },
             *   "2": { id: 2, username: "phone" }
             * }
             */
            const map = {};

            list.forEach((user) => {
                if (user?.id) {
                    map[String(user.id)] = user;
                }
            });

            setUsersMap(map);

            /*
             * New Chat modal ke liye current user
             * ko list se remove karo.
             */
            setUsers(
                list.filter(
                    (user) =>
                        String(user.id) !== currentId
                )
            );

            return list;
        } catch (error) {
            console.error(
                "Failed to load users:",
                error
            );

            antMessage.error(
                "Failed to load registered users"
            );

            return [];
        } finally {
            setLoadingUsers(false);
        }
    };


    /* ========================================================
       OPEN NEW CHAT MODAL
    ======================================================== */

    const handleOpenNewChat = async () => {
        setIsModalOpen(true);

        setUserSearch("");
        setSelectedUser(null);

        await fetchUsers();
    };


    /* ========================================================
       BROWSER NOTIFICATION PERMISSION
    ======================================================== */

    useEffect(() => {
        if (
            "Notification" in window &&
            Notification.permission === "default"
        ) {
            Notification.requestPermission().catch(
                () => { }
            );
        }
    }, []);


    /* ========================================================
       LOAD NOTIFICATIONS
    ======================================================== */

    useEffect(() => {
        const loadNotifications = async () => {
            try {
                const {
                    getNotifications,
                    getUnreadNotificationCount,
                } = await import(
                    "../../../api/notification.api"
                );

                const [
                    notificationList,
                    unreadData,
                ] = await Promise.all([
                    getNotifications({
                        limit: 50,
                    }),
                    getUnreadNotificationCount(),
                ]);

                setNotifications(
                    Array.isArray(
                        notificationList
                    )
                        ? notificationList
                        : []
                );

                setNotificationCount(
                    unreadData?.unread_count || 0
                );
            } catch (error) {
                console.error(
                    "Failed to load notifications:",
                    error
                );
            }
        };

        if (token) {
            loadNotifications();
        }
    }, [token]);


    /* ========================================================
       FETCH MESSAGES
    ======================================================== */

    useEffect(() => {
        const fetchMessages = async () => {
            if (!selectedContact?.id) {
                return;
            }

            setIsPartnerTyping(false);

            try {
                setLoadingMessages(true);

                const data =
                    await getConversationMessages(
                        selectedContact.id
                    );

                const msgList =
                    Array.isArray(data)
                        ? data
                        : (
                            data?.data ||
                            data?.messages ||
                            []
                        );

                setMessages(msgList);

                if (
                    websocketRef.current &&
                    websocketRef.current.readyState ===
                    WebSocket.OPEN
                ) {
                    sendConversationRead(
                        websocketRef.current,
                        selectedContact.id
                    );
                }
            } catch (error) {
                console.error(
                    "Error fetching messages:",
                    error
                );

                antMessage.error(
                    "Failed to load messages for this chat."
                );

                setMessages([]);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();
    }, [selectedContact]);


    /* ========================================================
       MARK SELECTED CONVERSATION READ
    ======================================================== */

    useEffect(() => {
        if (!selectedContact?.id) {
            return;
        }

        if (
            websocketRef.current &&
            websocketRef.current.readyState ===
            WebSocket.OPEN
        ) {
            sendConversationRead(
                websocketRef.current,
                selectedContact.id
            );
        }
    }, [selectedContact]);


    /* ========================================================
       CAN MODIFY MESSAGE
    ======================================================== */

    const canModifyMessage = (item) => {
        if (!item?.created_at) {
            return false;
        }

        const createdAt =
            new Date(
                item.created_at
            ).getTime();

        if (Number.isNaN(createdAt)) {
            return false;
        }

        return (
            currentTime - createdAt <
            EDIT_DELETE_LIMIT
        );
    };


    /* ========================================================
       START EDIT
    ======================================================== */

    const handleStartEdit = (item) => {
        if (!item?.id) {
            return;
        }

        if (!canModifyMessage(item)) {
            antMessage.warning(
                "This message can no longer be edited. The 3-minute limit has expired."
            );

            return;
        }

        setEditingMessageId(item.id);

        setMessageText(
            item.content ||
            item.text ||
            item.message ||
            ""
        );
    };


    /* ========================================================
       CANCEL EDIT
    ======================================================== */

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setMessageText("");
    };


    /* ========================================================
       EDIT MESSAGE
    ======================================================== */

    const handleEditMessage = () => {
        const trimmedMessage =
            messageText.trim();

        if (!editingMessageId) {
            return;
        }

        if (!trimmedMessage) {
            antMessage.warning(
                "Message cannot be empty."
            );

            return;
        }

        if (
            !websocketRef.current ||
            websocketRef.current.readyState !==
            WebSocket.OPEN
        ) {
            antMessage.error(
                "WebSocket is not connected!"
            );

            return;
        }

        sendEditMessage(
            websocketRef.current,
            editingMessageId,
            trimmedMessage
        );
    };


    /* ========================================================
       DELETE MESSAGE
    ======================================================== */

    const handleDeleteMessage = (messageId) => {
        if (!messageId) {
            return;
        }

        const messageToDelete =
            messages.find(
                (item) =>
                    String(item.id) ===
                    String(messageId)
            );

        if (!messageToDelete) {
            antMessage.error(
                "Message not found."
            );

            return;
        }

        if (
            !canModifyMessage(
                messageToDelete
            )
        ) {
            antMessage.warning(
                "This message can no longer be deleted. The 3-minute limit has expired."
            );

            return;
        }

        Modal.confirm({
            title: "Delete message?",
            content:
                "This message will be removed for everyone.",
            okText: "Delete",
            cancelText: "Cancel",
            okButtonProps: {
                danger: true,
            },

            onOk: () => {
                if (
                    !websocketRef.current ||
                    websocketRef.current.readyState !==
                    WebSocket.OPEN
                ) {
                    antMessage.error(
                        "WebSocket is not connected!"
                    );

                    return;
                }

                sendDeleteMessage(
                    websocketRef.current,
                    messageId
                );
            },
        });
    };


    /* ========================================================
       CANCEL EDIT WHEN 3 MINUTES EXPIRE
    ======================================================== */

    useEffect(() => {
        if (!editingMessageId) {
            return;
        }

        const editingMessage =
            messages.find(
                (item) =>
                    String(item.id) ===
                    String(editingMessageId)
            );

        if (
            !editingMessage ||
            !canModifyMessage(
                editingMessage
            )
        ) {
            setEditingMessageId(null);
            setMessageText("");
        }
    }, [
        currentTime,
        editingMessageId,
        messages,
    ]);


    /* ========================================================
       WEBSOCKET
    ======================================================== */

    useEffect(() => {
        if (!token) {
            navigate("/login", {
                replace: true,
            });

            return;
        }

        const websocket =
            createWebSocket({
                onOpen: () => {
                    setConnected(true);

                    const activeContact =
                        selectedContactRef.current;

                    if (activeContact?.id) {
                        sendConversationRead(
                            websocket,
                            activeContact.id
                        );
                    }
                },


                onMessage: async (data) => {

                    /* =================================================
                       ERROR
                    ================================================= */

                    if (data?.type === "error") {
                        antMessage.error(
                            data.message ||
                            "WebSocket Error"
                        );

                        return;
                    }


                    /* =================================================
                       NEW NOTIFICATION
                    ================================================= */

                    if (
                        data?.type ===
                        "new_notification"
                    ) {
                        const notification =
                            data.notification;

                        if (!notification) {
                            return;
                        }

                        setNotifications(
                            (prev) => [
                                notification,
                                ...prev,
                            ]
                        );

                        if (
                            !notification.is_read
                        ) {
                            setNotificationCount(
                                (prev) =>
                                    prev + 1
                            );
                        }


                        /* ---------------------------------------------
                           IMPORTANT FIX:
                           Notification aate hi conversations refresh
                           karo. Isse new chat sidebar mein aa jayegi.
                        --------------------------------------------- */

                        try {
                            await fetchConversations();
                        } catch (error) {
                            console.error(
                                "Failed to refresh conversations after notification:",
                                error
                            );
                        }


                        /* ---------------------------------------------
                           IN-APP NOTIFICATION
                        --------------------------------------------- */

                        antMessage.info({
                            content:
                                notification.body ||
                                notification.title ||
                                "New notification",

                            duration: 4,
                        });


                        /* ---------------------------------------------
                           BROWSER NOTIFICATION
                        --------------------------------------------- */

                        if (
                            document.hidden &&
                            "Notification" in window &&
                            Notification.permission ===
                            "granted"
                        ) {
                            new Notification(
                                notification.title ||
                                "New notification",
                                {
                                    body:
                                        notification.body ||
                                        "You have a new notification.",
                                }
                            );
                        }

                        return;
                    }


                    /* =================================================
                       TYPING
                    ================================================= */

                    if (
                        data?.type ===
                        "user_typing" ||
                        data?.type ===
                        "user_stopped_typing"
                    ) {
                        const activeContact =
                            selectedContactRef.current;

                        const incomingConvId =
                            String(
                                data.conversation_id ||
                                data.conversationId ||
                                ""
                            );

                        const currentConvId =
                            String(
                                activeContact?.id ||
                                ""
                            );

                        if (
                            incomingConvId ===
                            currentConvId
                        ) {
                            if (
                                data.type ===
                                "user_typing"
                            ) {
                                setIsPartnerTyping(
                                    true
                                );
                            }

                            if (
                                data.type ===
                                "user_stopped_typing"
                            ) {
                                setIsPartnerTyping(
                                    false
                                );
                            }
                        }

                        return;
                    }


                    /* =================================================
                       MESSAGE DELIVERED
                    ================================================= */

                    if (
                        data?.type ===
                        "message_delivered"
                    ) {
                        const messageId =
                            String(
                                data.message_id
                            );

                        setMessages(
                            (prev) =>
                                prev.map(
                                    (message) =>
                                        String(
                                            message.id
                                        ) ===
                                            messageId
                                            ? {
                                                ...message,
                                                is_delivered:
                                                    true,
                                            }
                                            : message
                                )
                        );

                        return;
                    }


                    /* =================================================
                       SINGLE MESSAGE READ
                    ================================================= */

                    if (
                        data?.type ===
                        "message_read"
                    ) {
                        const messageId =
                            String(
                                data.message_id
                            );

                        setMessages(
                            (prev) =>
                                prev.map(
                                    (message) =>
                                        String(
                                            message.id
                                        ) ===
                                            messageId
                                            ? {
                                                ...message,
                                                is_read:
                                                    true,
                                            }
                                            : message
                                )
                        );

                        return;
                    }


                    /* =================================================
                       CONVERSATION READ
                    ================================================= */

                    if (
                        data?.type ===
                        "conversation_read"
                    ) {
                        const messageIds =
                            new Set(
                                (
                                    data.message_ids ||
                                    []
                                ).map(String)
                            );

                        setMessages(
                            (prev) =>
                                prev.map(
                                    (message) =>
                                        messageIds.has(
                                            String(
                                                message.id
                                            )
                                        )
                                            ? {
                                                ...message,
                                                is_read:
                                                    true,
                                            }
                                            : message
                                )
                        );

                        return;
                    }


                    /* =================================================
                       MESSAGE EDITED
                    ================================================= */

                    if (
                        data?.type ===
                        "message_edited"
                    ) {
                        const messageId =
                            String(
                                data.message_id
                            );

                        setMessages(
                            (prev) =>
                                prev.map(
                                    (message) =>
                                        String(
                                            message.id
                                        ) ===
                                            messageId
                                            ? {
                                                ...message,
                                                content:
                                                    data.content,
                                                is_edited:
                                                    true,
                                                edited_at:
                                                    data.edited_at ||
                                                    null,
                                            }
                                            : message
                                )
                        );

                        setEditingMessageId(
                            (currentId) =>
                                String(
                                    currentId
                                ) ===
                                    messageId
                                    ? null
                                    : currentId
                        );

                        setMessageText("");

                        return;
                    }


                    /* =================================================
                       MESSAGE DELETED
                    ================================================= */

                    if (
                        data?.type ===
                        "message_deleted"
                    ) {
                        const messageId =
                            String(
                                data.message_id
                            );

                        setMessages(
                            (prev) =>
                                prev.filter(
                                    (message) =>
                                        String(
                                            message.id
                                        ) !==
                                        messageId
                                )
                        );

                        setEditingMessageId(
                            (currentId) =>
                                String(
                                    currentId
                                ) ===
                                    messageId
                                    ? null
                                    : currentId
                        );

                        setMessageText("");

                        return;
                    }


                    // =====================================================
                    // NEW MESSAGE
                    // =====================================================

                    if (data?.type === "message") {
                        const activeContact =
                            selectedContactRef.current;

                        const incomingConvId = String(
                            data.conversation_id ||
                            data.conversationId ||
                            data.conversation ||
                            ""
                        );

                        const currentConvId = String(
                            activeContact?.id || ""
                        );

                        const senderId =
                            data.sender_id ||
                            data.senderId ||
                            data.user_id;

                        const isOwnMessage =
                            String(senderId || "") ===
                            String(currentUserId || "");

                        /*
 * =====================================================
 * RESOLVE MESSAGE SENDER USERNAME
 * =====================================================
 *
 * Receiver side par conversation ka title
 * sender ke username se hona chahiye.
 *
 * Example:
 *
 * Awais -> Phone
 *
 * Phone ko message mila:
 * sender_id = Awais
 *
 * Phone side title = Awais
 */
                        let incomingSenderUser =
                            usersMap[String(senderId)] || null;

                        if (
                            !isOwnMessage &&
                            senderId &&
                            !incomingSenderUser
                        ) {
                            try {
                                const usersData =
                                    await getUsers();

                                const usersList =
                                    Array.isArray(usersData)
                                        ? usersData
                                        : (
                                            usersData?.data ||
                                            usersData?.users ||
                                            []
                                        );

                                incomingSenderUser =
                                    usersList.find(
                                        (user) =>
                                            String(user.id) ===
                                            String(senderId)
                                    ) || null;

                                /*
                                 * Update users map so next message
                                 * does not need another API call.
                                 */
                                if (incomingSenderUser) {
                                    setUsersMap((prev) => ({
                                        ...prev,
                                        [String(senderId)]:
                                            incomingSenderUser,
                                    }));
                                }
                            } catch (error) {
                                console.error(
                                    "Failed to resolve message sender:",
                                    error
                                );
                            }
                        }

                        const incomingSenderName =
                            incomingSenderUser?.username ||
                            incomingSenderUser?.name ||
                            incomingSenderUser?.full_name ||
                            null;

                        // =====================================================
                        // UPDATE SIDEBAR
                        // WhatsApp style:
                        // jis conversation mein latest message aaye
                        // woh conversation TOP par chali jaye
                        // =====================================================

                        if (incomingConvId) {
                            const existingConversation =
                                conversations.find(
                                    (conversation) =>
                                        String(conversation.id) ===
                                        incomingConvId
                                );

                            const isCurrentConversation =
                                incomingConvId ===
                                currentConvId;

                            /*
                             * =====================================================
                             * CONVERSATION ALREADY EXISTS
                             * =====================================================
                             */

                            if (existingConversation) {
                                const updatedConversation = {
                                    ...conversation,

                                    /*
                                     * IMPORTANT:
                                     * Agar message doosre user ne bheja hai,
                                     * to receiver side par us sender ka naam show karo.
                                     *
                                     * Own message hone par existing recipient
                                     * ka naam change nahi hoga.
                                     */
                                    ...(incomingSenderName && !isOwnMessage
                                        ? {
                                            display_name:
                                                incomingSenderName,

                                            other_user:
                                                incomingSenderUser,

                                            partner_user:
                                                incomingSenderUser,
                                        }
                                        : {}),

                                    last_message:
                                        data.content ||
                                        data.message ||
                                        data.text ||
                                        "New message",

                                    last_message_at:
                                        data.created_at ||
                                        new Date().toISOString(),

                                    updated_at:
                                        data.created_at ||
                                        new Date().toISOString(),

                                    unread_count:
                                        !isOwnMessage &&
                                            !isCurrentConversation
                                            ? (
                                                conversation.unread_count ||
                                                0
                                            ) + 1
                                            : (
                                                conversation.unread_count ||
                                                0
                                            ),
                                };



                                if (
                                    !isOwnMessage &&
                                    incomingSenderName &&
                                    incomingConvId === currentConvId
                                ) {
                                    setSelectedContact(
                                        (currentContact) => ({
                                            ...currentContact,

                                            display_name:
                                                incomingSenderName,

                                            other_user:
                                                incomingSenderUser,

                                            partner_user:
                                                incomingSenderUser,
                                        })
                                    );
                                }

                                /*
                                 * WhatsApp style:
                                 * latest conversation TOP par.
                                 */
                                setConversations((prev) => [
                                    updatedConversation,

                                    ...prev.filter(
                                        (conversation) =>
                                            String(conversation.id) !==
                                            incomingConvId
                                    ),
                                ]);
                            }

                            /*
                             * =====================================================
                             * CONVERSATION SIDEBAR MEIN NAHI HAI
                             * =====================================================
                             */

                            else {
                                /*
                                 * IMPORTANT:
                                 * fetchConversations ko setState ke andar
                                 * call nahi karna.
                                 */
                                fetchConversations()
                                    .then((refreshedConversations) => {
                                        if (
                                            !Array.isArray(
                                                refreshedConversations
                                            )
                                        ) {
                                            return;
                                        }

                                        const found =
                                            refreshedConversations.find(
                                                (conversation) =>
                                                    String(
                                                        conversation.id
                                                    ) ===
                                                    incomingConvId
                                            );

                                        if (!found) {
                                            return;
                                        }

                                        const updatedConversation = {
                                            ...found,

                                            last_message:
                                                data.content ||
                                                data.message ||
                                                data.text ||
                                                "New message",

                                            last_message_at:
                                                data.created_at ||
                                                new Date().toISOString(),

                                            updated_at:
                                                data.created_at ||
                                                new Date().toISOString(),

                                            unread_count:
                                                !isOwnMessage &&
                                                    !isCurrentConversation
                                                    ? Math.max(
                                                        Number(
                                                            found.unread_count ||
                                                            0
                                                        ),
                                                        1
                                                    )
                                                    : Number(
                                                        found.unread_count ||
                                                        0
                                                    ),
                                        };

                                        setConversations((prev) => [
                                            updatedConversation,

                                            ...prev.filter(
                                                (conversation) =>
                                                    String(
                                                        conversation.id
                                                    ) !==
                                                    incomingConvId
                                            ),
                                        ]);
                                    })
                                    .catch((error) => {
                                        console.error(
                                            "Failed to refresh conversations after new message:",
                                            error
                                        );
                                    });
                            }
                        }

                        // =====================================================
                        // CURRENT / OPEN CONVERSATION
                        // =====================================================

                        if (
                            !incomingConvId ||
                            incomingConvId === currentConvId
                        ) {
                            setMessages((prev) => {
                                const exists = prev.some(
                                    (m) =>
                                        String(m.id) ===
                                        String(data.id)
                                );

                                if (exists) {
                                    return prev;
                                }

                                return [
                                    ...prev,
                                    data,
                                ];
                            });

                            setIsPartnerTyping(false);

                            if (
                                !isOwnMessage &&
                                data.id &&
                                websocketRef.current &&
                                websocketRef.current.readyState ===
                                WebSocket.OPEN
                            ) {
                                sendReadReceipt(
                                    websocketRef.current,
                                    data.id
                                );
                            }
                        }

                        return;
                    }
                },


                onError: (error) => {
                    console.error(
                        "WS Error:",
                        error
                    );
                },


                onClose: () => {
                    setConnected(false);
                    websocketRef.current =
                        null;
                },
            });


        websocketRef.current =
            websocket;


        return () => {
            if (
                typingTimeoutRef.current
            ) {
                clearTimeout(
                    typingTimeoutRef.current
                );

                typingTimeoutRef.current =
                    null;
            }


            if (
                websocketRef.current &&
                (
                    websocketRef.current
                        .readyState ===
                    WebSocket.OPEN ||
                    websocketRef.current
                        .readyState ===
                    WebSocket.CONNECTING
                )
            ) {
                websocketRef.current.close();
            }


            websocketRef.current =
                null;
        };
    }, [token, navigate]);


    /* ========================================================
       INPUT / TYPING
    ======================================================== */

    const handleInputChange = (e) => {
        const value =
            e.target.value;

        setMessageText(value);


        if (editingMessageId) {
            return;
        }


        if (!selectedContact) {
            return;
        }


        if (
            websocketRef.current &&
            websocketRef.current.readyState ===
            WebSocket.OPEN
        ) {
            sendTypingStatus(
                websocketRef.current,
                selectedContact.id,
                true
            );
        }


        if (
            typingTimeoutRef.current
        ) {
            clearTimeout(
                typingTimeoutRef.current
            );
        }


        typingTimeoutRef.current =
            setTimeout(() => {
                if (
                    websocketRef.current &&
                    websocketRef.current
                        .readyState ===
                    WebSocket.OPEN
                ) {
                    sendTypingStatus(
                        websocketRef.current,
                        selectedContact.id,
                        false
                    );
                }
            }, 1200);
    };


    /* ========================================================
       CREATE NEW CHAT
    ======================================================== */

    const handleCreateChat = async () => {
        if (!selectedUser?.id) {
            antMessage.warning(
                "Please select a user to start the chat."
            );

            return;
        }

        try {
            setCreatingChat(true);

            // IMPORTANT:
            // selectedUser ko clear karne se pehle save kar lo.
            const partnerUser = {
                id: selectedUser.id,
                username: selectedUser.username,
                name: selectedUser.name,
                full_name: selectedUser.full_name,
                email: selectedUser.email,
            };

            const partnerName =
                partnerUser.username ||
                partnerUser.name ||
                partnerUser.full_name ||
                `User #${partnerUser.id}`;

            const newConv =
                await createConversation({
                    title: null,

                    is_group: false,

                    participant_id:
                        Number(partnerUser.id),
                });

            antMessage.success(
                "Conversation created!"
            );

            /*
             * Conversation ID
             */
            const conversationId =
                newConv?.id;

            /*
             * Save partner locally.
             *
             * Isse sender side par conversation
             * hamesha receiver ka naam show karegi.
             */
            if (conversationId) {
                setConversationPartnerMap((prev) => {
                    const next = {
                        ...prev,
                        [String(conversationId)]:
                            partnerUser,
                    };

                    try {
                        localStorage.setItem(
                            `conversation_partner_map_${currentUserId}`,
                            JSON.stringify(next)
                        );
                    } catch {
                        // Ignore localStorage errors
                    }

                    return next;
                });
            }

            setIsModalOpen(false);
            setUserSearch("");
            setSelectedUser(null);

            /*
             * Refresh sidebar
             */
            const refreshed =
                await fetchConversations();

            /*
             * Find newly created conversation
             */
            let matching = null;

            if (conversationId) {
                matching =
                    refreshed.find(
                        (conversation) =>
                            String(
                                conversation.id
                            ) ===
                            String(
                                conversationId
                            )
                    );
            }

            /*
             * IMPORTANT:
             * Sender side conversation ko actual
             * receiver user ke naam ke saath store karo.
             */
            const selectedConversation = {
                ...(matching || newConv),

                title: null,

                display_name: partnerName,

                other_user: partnerUser,

                partner_user: partnerUser,
            };

            /*
             * Sidebar mein bhi correct username rakho.
             */
            if (conversationId) {
                setConversations((prev) =>
                    prev.map((conversation) =>
                        String(conversation.id) ===
                            String(conversationId)
                            ? {
                                ...conversation,

                                title: null,

                                display_name:
                                    partnerName,

                                other_user:
                                    partnerUser,

                                partner_user:
                                    partnerUser,
                            }
                            : conversation
                    )
                );
            }

            /*
             * Open selected conversation
             */
            setSelectedContact(
                selectedConversation
            );
        } catch (error) {
            console.error(
                "Failed to create conversation:",
                error
            );

            antMessage.error(
                error?.response?.data
                    ?.detail ||
                "Could not create conversation"
            );
        } finally {
            setCreatingChat(false);
        }
    };


    /* ========================================================
       LOGOUT
    ======================================================== */

    const handleLogout = () => {
        if (websocketRef.current) {
            websocketRef.current.close();
            websocketRef.current =
                null;
        }

        clearTokens();

        navigate("/login", {
            replace: true,
        });
    };


    /* ========================================================
       FILE SELECT
    ======================================================== */

    const handleFileSelect = (event) => {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }


        const MAX_FILE_SIZE =
            10 * 1024 * 1024;


        if (
            file.size >
            MAX_FILE_SIZE
        ) {
            antMessage.error(
                "File size cannot exceed 10 MB."
            );

            event.target.value =
                "";

            return;
        }


        setSelectedFile(file);

        /*
         * Same file ko dobara select karne allow karo.
         */

        event.target.value = "";
    };


    const removeSelectedFile = () => {
        setSelectedFile(null);
    };


    /* ========================================================
       FILE DOWNLOAD
    ======================================================== */

    const handleFileDownload = (
        event,
        messageId
    ) => {
        if (!messageId) {
            return;
        }


        /*
         * Browser ko normal link action karne do.
         * Sirf clicked file ka download icon hide hoga.
         */

        setDownloadedFiles(
            (prev) => {
                const next =
                    new Set(prev);

                next.add(
                    String(messageId)
                );

                return next;
            }
        );
    };


    /* ========================================================
       SEND MESSAGE
    ======================================================== */

    const handleSendMessage = async () => {
        const trimmedMessage = messageText.trim();

        if (!selectedContact) {
            return;
        }

        // =====================================================
        // EDIT MODE
        // =====================================================
        // Agar message edit ho raha hai to NEW message send
        // nahi hoga. Existing message hi update hoga.
        if (editingMessageId) {
            handleEditMessage();
            return;
        }

        // Normal message aur file dono empty hon to kuch nahi karna
        if (!trimmedMessage && !selectedFile) {
            return;
        }

        // WebSocket connection check
        if (
            !websocketRef.current ||
            websocketRef.current.readyState !== WebSocket.OPEN
        ) {
            antMessage.error("WebSocket is not connected!");
            return;
        }

        // Stop typing event
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        try {
            // =====================================================
            // FILE / IMAGE MESSAGE
            // =====================================================

            if (selectedFile) {
                setUploadingFile(true);

                const formData = new FormData();
                formData.append("file", selectedFile);

                const uploadResponse =
                    await uploadChatFile(formData);

                console.log(
                    "========== UPLOAD RESPONSE =========="
                );
                console.log(uploadResponse);
                console.log(
                    "======================================"
                );

                // Backend response normalize
                const uploadedFile =
                    uploadResponse?.data ||
                    uploadResponse?.file ||
                    uploadResponse?.attachment ||
                    uploadResponse;

                const fileUrl =
                    uploadedFile?.file_url ||
                    uploadedFile?.url ||
                    uploadedFile?.path ||
                    uploadedFile?.file_path ||
                    null;

                const fileName =
                    uploadedFile?.file_name ||
                    uploadedFile?.filename ||
                    selectedFile.name ||
                    "Attachment";

                const fileSize =
                    uploadedFile?.file_size ??
                    uploadedFile?.size ??
                    selectedFile.size ??
                    null;

                const mimeType =
                    uploadedFile?.mime_type ||
                    uploadedFile?.content_type ||
                    selectedFile.type ||
                    "application/octet-stream";

                const messageType =
                    uploadedFile?.message_type ||
                    (
                        mimeType.startsWith("image/")
                            ? "image"
                            : "file"
                    );

                console.log(
                    "========== NORMALIZED FILE =========="
                );

                console.log({
                    message_type: messageType,
                    file_url: fileUrl,
                    file_name: fileName,
                    file_size: fileSize,
                    mime_type: mimeType,
                });

                console.log(
                    "====================================="
                );

                // Backend ne URL return nahi ki
                if (!fileUrl) {
                    console.error(
                        "UPLOAD RESPONSE DOES NOT CONTAIN FILE URL:",
                        uploadResponse
                    );

                    antMessage.error(
                        "File upload succeeded, but server did not return file URL."
                    );

                    return;
                }

                // =====================================================
                // SEND FILE / IMAGE THROUGH WEBSOCKET
                // =====================================================

                sendChatMessage(
                    websocketRef.current,
                    selectedContact.id,
                    trimmedMessage || "Attachment",
                    {
                        message_type: messageType,
                        file_url: fileUrl,
                        file_name: fileName,
                        file_size: fileSize,
                        mime_type: mimeType,
                    }
                );

                // Clear attachment
                setSelectedFile(null);
                setMessageText("");

                // Stop typing
                sendTypingStatus(
                    websocketRef.current,
                    selectedContact.id,
                    false
                );

                return;
            }

            // =====================================================
            // NORMAL TEXT MESSAGE
            // =====================================================

            sendChatMessage(
                websocketRef.current,
                selectedContact.id,
                trimmedMessage
            );

            // =====================================================
            // MOVE CURRENT CONVERSATION TO TOP IMMEDIATELY
            // =====================================================
            //
            // Message send hote hi sidebar locally update hoga.
            // Kisi API refresh ka wait nahi hoga.
            // Page refresh nahi hoga.
            //

            setConversations((prev) => {

                const selectedConversationId =
                    String(selectedContact.id);

                const currentConversation =
                    prev.find(
                        (conversation) =>
                            String(conversation.id) ===
                            selectedConversationId
                    );

                // Conversation sidebar mein nahi mili
                if (!currentConversation) {
                    return prev;
                }

                // Current conversation ko purani position se remove karo
                const remainingConversations =
                    prev.filter(
                        (conversation) =>
                            String(conversation.id) !==
                            selectedConversationId
                    );

                // Current conversation ko TOP par rakho
                return [
                    {
                        ...currentConversation,

                        last_message:
                            trimmedMessage,

                        last_message_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString(),

                        // Sender ne khud message bheja hai,
                        // isliye unread count increase nahi hoga.
                        unread_count:
                            currentConversation.unread_count || 0,
                    },

                    ...remainingConversations,
                ];
            });

            setMessageText("");

            sendTypingStatus(
                websocketRef.current,
                selectedContact.id,
                false
            );

        } catch (error) {
            console.error(
                "File upload/send error:",
                error
            );

            antMessage.error(
                error?.response?.data?.detail ||
                "Could not send attachment."
            );
        } finally {
            setUploadingFile(false);
        }
    };

    /* ========================================================
       ENTER KEY
    ======================================================== */

    const handleKeyDown = (event) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            handleSendMessage();
        }
    };


    /* ========================================================
       FILTER SIDEBAR
    ======================================================== */

    const filteredContacts =
        conversations.filter(
            (contact) => {
                const title =
                    getConversationTitle(
                        contact
                    );

                return title
                    .toLowerCase()
                    .includes(
                        search.toLowerCase()
                    );
            }
        );


    /* ========================================================
       FILTER USERS
    ======================================================== */

    const filteredUsers =
        users.filter((user) => {
            const searchText =
                userSearch
                    .trim()
                    .toLowerCase();


            if (!searchText) {
                return true;
            }


            const username =
                String(
                    user.username || ""
                ).toLowerCase();

            const name =
                String(
                    user.name ||
                    ""
                ).toLowerCase();

            const fullName =
                String(
                    user.full_name ||
                    ""
                ).toLowerCase();

            const email =
                String(
                    user.email ||
                    ""
                ).toLowerCase();


            return (
                username.includes(
                    searchText
                ) ||
                name.includes(
                    searchText
                ) ||
                fullName.includes(
                    searchText
                ) ||
                email.includes(
                    searchText
                )
            );
        });


    /* ========================================================
       RENDER
    ======================================================== */

    return (
        <div
            className={`${styles.chatPage} ${darkMode ? styles.darkMode : ""
                }`}
        >

            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside
                className={`${styles.sidebar} ${selectedContact ? styles.sidebarHiddenMobile : styles.sidebarActiveMobile
                    }`}
            >

                <div className={styles.sidebarHeader}>

                    <div>
                        <h2 className={styles.logo}>
                            Realtime Chat
                        </h2>

                        <div className={styles.connectionStatus}>
                            <span
                                className={
                                    connected
                                        ? styles.onlineDot
                                        : styles.offlineDot
                                }
                            />

                            {connected
                                ? "Connected"
                                : "Disconnected"}
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        {/* DARK / LIGHT MODE */}
                        <Button
                            type="text"
                            icon={
                                darkMode ? (
                                    <SunOutlined />
                                ) : (
                                    <MoonOutlined />
                                )
                            }
                            onClick={toggleTheme}
                        >
                            {darkMode ? "Light" : "Dark"}
                        </Button>

                    </div>

                </div>

                {/* SEARCH */}

                <div
                    className={
                        styles.searchBox
                    }
                >

                    <Input
                        prefix={
                            <SearchOutlined />
                        }
                        placeholder="Search conversations..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                    />

                </div>


                {/* CONVERSATIONS HEADER */}

                <div
                    style={{
                        display: "flex",
                        justifyContent:
                            "space-between",
                        alignItems:
                            "center",
                        padding:
                            "10px 16px",
                    }}
                >

                    <div
                        className={
                            styles.contactsTitle
                        }
                    >
                        Conversations
                    </div>


                    <Button
                        type="primary"
                        size="small"
                        icon={
                            <PlusOutlined />
                        }
                        onClick={
                            handleOpenNewChat
                        }
                    >
                        New
                    </Button>

                </div>


                {/* CONVERSATIONS */}

                <div
                    className={
                        styles.contactsList
                    }
                >

                    {loadingConversations ? (

                        <div
                            style={{
                                textAlign:
                                    "center",
                                padding:
                                    "20px",
                            }}
                        >
                            <Spin />
                        </div>

                    ) : filteredContacts.length ===
                        0 ? (

                        <div
                            style={{
                                textAlign:
                                    "center",
                                padding:
                                    "10px",
                                color:
                                    "#888",
                            }}
                        >
                            No conversations
                            found
                        </div>

                    ) : (

                        filteredContacts.map(
                            (contact) => (

                                <button
                                    key={
                                        contact.id
                                    }
                                    className={`${styles.contactItem} ${String(
                                        selectedContact?.id
                                    ) ===
                                        String(
                                            contact.id
                                        )
                                        ? styles.selectedContact
                                        : ""
                                        }`}
                                    onClick={() => {

                                        setSelectedContact(
                                            contact
                                        );


                                        setConversations(
                                            (prev) =>
                                                prev.map(
                                                    (
                                                        item
                                                    ) =>
                                                        String(
                                                            item.id
                                                        ) ===
                                                            String(
                                                                contact.id
                                                            )
                                                            ? {
                                                                ...item,
                                                                unread_count:
                                                                    0,
                                                            }
                                                            : item
                                                )
                                        );


                                        if (
                                            websocketRef.current &&
                                            websocketRef.current
                                                .readyState ===
                                            WebSocket.OPEN
                                        ) {
                                            sendConversationRead(
                                                websocketRef.current,
                                                contact.id
                                            );
                                        }

                                    }}
                                >

                                    <div
                                        className={
                                            styles.avatarWrapper
                                        }
                                    >
                                        <Avatar
                                            size={52}
                                            src={
                                                conversations?.other_user?.profile_picture
                                                    ? normalizeFileUrl(
                                                        conversations.other_user.profile_picture
                                                    )
                                                    : undefined
                                            }
                                            icon={<UserOutlined />}
                                        />
                                    </div>


                                    <div
                                        className={
                                            styles.contactInfo
                                        }
                                    >

                                        <div
                                            style={{
                                                display:
                                                    "flex",
                                                alignItems:
                                                    "center",
                                                justifyContent:
                                                    "space-between",
                                                gap:
                                                    "8px",
                                            }}
                                        >

                                            <div
                                                className={
                                                    styles.contactName
                                                }
                                            >
                                                {
                                                    getConversationTitle(
                                                        contact,
                                                        conversationPartnerMap[
                                                        String(contact.id)
                                                        ]
                                                    )
                                                }
                                            </div>


                                            {contact.unread_count >
                                                0 && (

                                                    <span
                                                        style={{
                                                            minWidth:
                                                                "22px",
                                                            height:
                                                                "22px",
                                                            padding:
                                                                "0 6px",
                                                            borderRadius:
                                                                "11px",
                                                            background:
                                                                "#1677ff",
                                                            color:
                                                                "#fff",
                                                            fontSize:
                                                                "12px",
                                                            fontWeight:
                                                                600,
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                        }}
                                                    >
                                                        {contact.unread_count >
                                                            99
                                                            ? "99+"
                                                            : contact.unread_count}
                                                    </span>

                                                )}

                                        </div>


                                        <Text
                                            type="secondary"
                                            className={
                                                styles.contactEmail
                                            }
                                        >
                                            {contact.created_at
                                                ? new Date(
                                                    contact.created_at
                                                ).toLocaleDateString()
                                                : ""}
                                        </Text>

                                    </div>

                                </button>

                            )
                        )

                    )}

                </div>

                {/* =================================================
    PROFILE BUTTON
================================================= */}

                <div
                    className={
                        styles.profileFooter
                    }
                >

                    <Button
                        type="text"
                        className={
                            styles.profileButton
                        }
                        icon={
                            <UserOutlined />
                        }
                        onClick={() =>
                            navigate("/profile")
                        }
                    >
                        Profile
                    </Button>

                </div>

            </aside>


            {/* =================================================
                CHAT AREA
            ================================================= */}

            <main
                className={`${styles.chatArea} ${!selectedContact ? styles.chatAreaHiddenMobile : styles.chatAreaActiveMobile
                    }`}
            >

                {selectedContact ? (

                    <>

                        {/* CHAT HEADER */}

                        <header
                            className={
                                styles.chatHeader
                            }
                            style={{
                                position:
                                    "relative",
                            }}
                        >

                            <Button
                                type="text"
                                icon={<ArrowLeftOutlined />}
                                className={styles.mobileBackButton}
                                onClick={() => setSelectedContact(null)}
                            />

                            <div
                                className={
                                    styles.chatUserWrapper
                                }
                            >

                                <div
                                    className={
                                        styles.avatarWrapper
                                    }
                                >
                                    <Avatar
                                        size={48}
                                        icon={
                                            <UserOutlined />
                                        }
                                    />
                                </div>


                                <div>

                                    <h3
                                        className={
                                            styles.chatUserName
                                        }
                                    >
                                        {
                                            getConversationTitle(
                                                selectedContact,
                                                conversationPartnerMap[
                                                String(selectedContact.id)
                                                ]
                                            )
                                        }
                                    </h3>


                                    <Text
                                        type="secondary"
                                    >
                                        {isPartnerTyping ? (

                                            <span
                                                style={{
                                                    color:
                                                        "#1677ff",
                                                    fontWeight:
                                                        "bold",
                                                }}
                                            >
                                                typing...
                                            </span>

                                        ) : selectedContact.is_group ? (

                                            "Group Chat"

                                        ) : (

                                            "Direct Message"

                                        )}
                                    </Text>

                                </div>

                            </div>


                            {/* NOTIFICATION BUTTON */}

                            <div
                                style={{
                                    marginLeft:
                                        "auto",
                                    position:
                                        "relative",
                                }}
                            >

                                <Button
                                    type="text"
                                    icon={
                                        <BellOutlined />
                                    }
                                    onClick={() =>
                                        setNotificationOpen(
                                            (prev) =>
                                                !prev
                                        )
                                    }
                                />


                                {notificationCount >
                                    0 && (

                                        <span
                                            style={{
                                                position:
                                                    "absolute",
                                                top:
                                                    "0",
                                                right:
                                                    "0",
                                                minWidth:
                                                    "18px",
                                                height:
                                                    "18px",
                                                borderRadius:
                                                    "9px",
                                                background:
                                                    "#ff4d4f",
                                                color:
                                                    "#fff",
                                                fontSize:
                                                    "10px",
                                                fontWeight:
                                                    700,
                                                display:
                                                    "flex",
                                                alignItems:
                                                    "center",
                                                justifyContent:
                                                    "center",
                                                padding:
                                                    "0 4px",
                                            }}
                                        >
                                            {notificationCount >
                                                99
                                                ? "99+"
                                                : notificationCount}
                                        </span>

                                    )}

                            </div>


                            {/* NOTIFICATION PANEL */}

                            {notificationOpen && (

                                <div
                                    className={styles.notificationPopup}
                                    style={{
                                        position:
                                            "absolute",
                                        top:
                                            "60px",
                                        right:
                                            "20px",
                                        width:
                                            "340px",
                                        maxHeight:
                                            "420px",
                                        overflowY:
                                            "auto",
                                        background:
                                            "#fff",
                                        borderRadius:
                                            "10px",
                                        boxShadow:
                                            "0 8px 30px rgba(0,0,0,0.15)",
                                        zIndex:
                                            1000,
                                        padding:
                                            "10px",
                                    }}
                                >

                                    <div
                                        style={{
                                            display:
                                                "flex",
                                            justifyContent:
                                                "space-between",
                                            alignItems:
                                                "center",
                                            marginBottom:
                                                "8px",
                                            padding:
                                                "4px",
                                        }}
                                    >

                                        <strong>
                                            Notifications
                                        </strong>


                                        {notificationCount >
                                            0 && (

                                                <Button
                                                    type="link"
                                                    size="small"
                                                    onClick={async () => {
                                                        try {
                                                            const {
                                                                markAllNotificationsAsRead,
                                                            } =
                                                                await import(
                                                                    "../../../api/notification.api"
                                                                );

                                                            await markAllNotificationsAsRead();

                                                            setNotifications(
                                                                (
                                                                    prev
                                                                ) =>
                                                                    prev.map(
                                                                        (
                                                                            item
                                                                        ) => ({
                                                                            ...item,
                                                                            is_read:
                                                                                true,
                                                                        })
                                                                    )
                                                            );

                                                            setNotificationCount(
                                                                0
                                                            );
                                                        } catch (
                                                        error
                                                        ) {
                                                            console.error(
                                                                "Failed to mark notifications:",
                                                                error
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Mark all read
                                                </Button>

                                            )}

                                    </div>


                                    {notifications.length ===
                                        0 ? (

                                        <div
                                            style={{
                                                textAlign:
                                                    "center",
                                                padding:
                                                    "30px 10px",
                                                color:
                                                    "#888",
                                            }}
                                        >
                                            No notifications
                                        </div>

                                    ) : (

                                        notifications.map(
                                            (
                                                notification
                                            ) => (

                                                <div
                                                    key={
                                                        notification.id
                                                    }
                                                    onClick={async () => {

                                                        /* --------------------------------
                                                           MARK NOTIFICATION READ
                                                        -------------------------------- */

                                                        if (
                                                            !notification.is_read
                                                        ) {
                                                            try {
                                                                const {
                                                                    markNotificationAsRead,
                                                                } =
                                                                    await import(
                                                                        "../../../api/notification.api"
                                                                    );

                                                                await markNotificationAsRead(
                                                                    notification.id
                                                                );

                                                                setNotifications(
                                                                    (
                                                                        prev
                                                                    ) =>
                                                                        prev.map(
                                                                            (
                                                                                item
                                                                            ) =>
                                                                                item.id ===
                                                                                    notification.id
                                                                                    ? {
                                                                                        ...item,
                                                                                        is_read:
                                                                                            true,
                                                                                    }
                                                                                    : item
                                                                        )
                                                                );

                                                                setNotificationCount(
                                                                    (
                                                                        prev
                                                                    ) =>
                                                                        Math.max(
                                                                            0,
                                                                            prev -
                                                                            1
                                                                        )
                                                                );
                                                            } catch (
                                                            error
                                                            ) {
                                                                console.error(
                                                                    "Failed to mark notification:",
                                                                    error
                                                                );
                                                            }
                                                        }


                                                        /* --------------------------------
                                                           OPEN RELATED CONVERSATION
                                                        -------------------------------- */

                                                        const conversationId =
                                                            getNotificationConversationId(
                                                                notification
                                                            );


                                                        if (
                                                            conversationId
                                                        ) {
                                                            try {

                                                                /*
                                                                 * Pehle current sidebar
                                                                 * list mein search karo.
                                                                 */

                                                                let conversation =
                                                                    conversations.find(
                                                                        (
                                                                            item
                                                                        ) =>
                                                                            String(
                                                                                item.id
                                                                            ) ===
                                                                            String(
                                                                                conversationId
                                                                            )
                                                                    );


                                                                /*
                                                                 * Agar sidebar mein nahi
                                                                 * hai to backend se fresh
                                                                 * list lao.
                                                                 */

                                                                if (
                                                                    !conversation
                                                                ) {
                                                                    const refreshed =
                                                                        await fetchConversations();

                                                                    conversation =
                                                                        refreshed.find(
                                                                            (
                                                                                item
                                                                            ) =>
                                                                                String(
                                                                                    item.id
                                                                                ) ===
                                                                                String(
                                                                                    conversationId
                                                                                )
                                                                        );
                                                                }


                                                                if (
                                                                    conversation
                                                                ) {
                                                                    setSelectedContact(
                                                                        conversation
                                                                    );

                                                                    setConversations(
                                                                        (
                                                                            prev
                                                                        ) =>
                                                                            prev.map(
                                                                                (
                                                                                    item
                                                                                ) =>
                                                                                    String(
                                                                                        item.id
                                                                                    ) ===
                                                                                        String(
                                                                                            conversationId
                                                                                        )
                                                                                        ? {
                                                                                            ...item,
                                                                                            unread_count:
                                                                                                0,
                                                                                        }
                                                                                        : item
                                                                            )
                                                                    );
                                                                }

                                                            } catch (
                                                            error
                                                            ) {
                                                                console.error(
                                                                    "Failed to open notification conversation:",
                                                                    error
                                                                );
                                                            }
                                                        }


                                                        setNotificationOpen(
                                                            false
                                                        );

                                                    }}
                                                    style={{
                                                        padding:
                                                            "10px",
                                                        borderRadius:
                                                            "8px",
                                                        cursor:
                                                            "pointer",
                                                        background:
                                                            notification.is_read
                                                                ? "transparent"
                                                                : "#f0f7ff",
                                                        marginBottom:
                                                            "4px",
                                                    }}
                                                >

                                                    <div
                                                        style={{
                                                            fontWeight:
                                                                notification.is_read
                                                                    ? 400
                                                                    : 600,
                                                        }}
                                                    >
                                                        {
                                                            notification.title
                                                        }
                                                    </div>


                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "13px",
                                                            color:
                                                                "#666",
                                                            marginTop:
                                                                "3px",
                                                        }}
                                                    >
                                                        {
                                                            notification.body
                                                        }
                                                    </div>


                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "11px",
                                                            color:
                                                                "#999",
                                                            marginTop:
                                                                "5px",
                                                        }}
                                                    >
                                                        {notification.created_at
                                                            ? new Date(
                                                                notification.created_at
                                                            ).toLocaleString()
                                                            : ""}
                                                    </div>

                                                </div>

                                            )
                                        )

                                    )}

                                </div>

                            )}

                        </header>


                        {/* =================================================
                            MESSAGES
                        ================================================= */}

                        <section
                            className={
                                styles.messagesArea
                            }
                        >

                            {loadingMessages ? (

                                <div
                                    style={{
                                        textAlign:
                                            "center",
                                        padding:
                                            "30px",
                                    }}
                                >
                                    <Spin size="large" />
                                </div>

                            ) : messages.length ===
                                0 ? (

                                <div
                                    style={{
                                        textAlign:
                                            "center",
                                        padding:
                                            "20px",
                                        color:
                                            "#888",
                                    }}
                                >
                                    No messages in
                                    this chat yet.
                                </div>

                            ) : (

                                messages.map(
                                    (
                                        item,
                                        index
                                    ) => {

                                        const senderId =
                                            item.sender_id ||
                                            item.senderId ||
                                            item.user_id;


                                        const isOwnMessage =
                                            item.is_self ||
                                            (
                                                currentUserId &&
                                                String(
                                                    senderId
                                                ) ===
                                                String(
                                                    currentUserId
                                                )
                                            );


                                        const attachmentUrl =
                                            normalizeFileUrl(
                                                item.file_url
                                            );


                                        const isImage =
                                            !!attachmentUrl &&
                                            (
                                                item.message_type ===
                                                "image" ||
                                                String(
                                                    item.mime_type ||
                                                    ""
                                                ).startsWith(
                                                    "image/"
                                                )
                                            );


                                        const isFile =
                                            !!attachmentUrl &&
                                            !isImage;


                                        return (

                                            <div
                                                key={
                                                    item.id ||
                                                    index
                                                }
                                                className={`${styles.messageRow} ${isOwnMessage
                                                    ? styles.ownMessageRow
                                                    : styles.otherMessageRow
                                                    }`}
                                            >

                                                <div
                                                    className={`${styles.messageBubble} ${isOwnMessage
                                                        ? styles.ownMessage
                                                        : styles.otherMessage
                                                        }`}
                                                >
                                                    <div
                                                        style={{
                                                            width: attachmentUrl ? "fit-content" : "auto",
                                                            maxWidth: "100%",
                                                        }}
                                                    >
                                                        {/* =================================================
                                                        ATTACHMENT / CONTENT
                                                    ================================================= */}

                                                        <div>

                                                            {/* IMAGE */}

                                                            {isImage && (

                                                                <div
                                                                    style={{
                                                                        marginBottom:
                                                                            item.content &&
                                                                                item.content !==
                                                                                "Attachment"
                                                                                ? "8px"
                                                                                : "0",
                                                                    }}
                                                                >

                                                                    <a
                                                                        href={
                                                                            attachmentUrl
                                                                        }
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{
                                                                            display:
                                                                                "block",
                                                                        }}
                                                                    >

                                                                        <img
                                                                            src={attachmentUrl}
                                                                            alt={item.file_name || "Image"}
                                                                            className={styles.chatImage}
                                                                        />

                                                                    </a>

                                                                </div>

                                                            )}


                                                            {/* FILE */}

                                                            {isFile && (

                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        gap:
                                                                            "10px",
                                                                        padding:
                                                                            "10px",
                                                                        borderRadius:
                                                                            "8px",
                                                                        background:
                                                                            "rgba(0,0,0,0.05)",
                                                                        marginBottom:
                                                                            item.content &&
                                                                                item.content !==
                                                                                "Attachment"
                                                                                ? "8px"
                                                                                : "0",
                                                                    }}
                                                                >

                                                                    <FileImageOutlined
                                                                        style={{
                                                                            fontSize:
                                                                                "24px",
                                                                        }}
                                                                    />


                                                                    <div
                                                                        style={{
                                                                            flex:
                                                                                1,
                                                                            minWidth:
                                                                                0,
                                                                        }}
                                                                    >

                                                                        <div
                                                                            style={{
                                                                                fontWeight:
                                                                                    600,
                                                                                wordBreak:
                                                                                    "break-word",
                                                                            }}
                                                                        >
                                                                            {
                                                                                item.file_name ||
                                                                                "Attached file"
                                                                            }
                                                                        </div>


                                                                        {item.file_size && (

                                                                            <Text
                                                                                type="secondary"
                                                                            >
                                                                                {(
                                                                                    item.file_size /
                                                                                    1024 /
                                                                                    1024
                                                                                ).toFixed(
                                                                                    2
                                                                                )}{" "}
                                                                                MB
                                                                            </Text>

                                                                        )}

                                                                    </div>


                                                                    {/* DOWNLOAD BUTTON */}

                                                                    {!downloadedFiles.has(
                                                                        String(
                                                                            item.id
                                                                        )
                                                                    ) && (

                                                                            <a
                                                                                href={
                                                                                    attachmentUrl
                                                                                }
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                onClick={(
                                                                                    event
                                                                                ) =>
                                                                                    handleFileDownload(
                                                                                        event,
                                                                                        item.id
                                                                                    )
                                                                                }
                                                                            >

                                                                                <Button
                                                                                    type="text"
                                                                                    icon={
                                                                                        <DownloadOutlined />
                                                                                    }
                                                                                />

                                                                            </a>

                                                                        )}

                                                                </div>

                                                            )}


                                                            {/* TEXT */}

                                                            {item.content &&
                                                                item.content !==
                                                                "Attachment" && (

                                                                    <div>
                                                                        {
                                                                            item.content
                                                                        }
                                                                    </div>

                                                                )}

                                                        </div>


                                                        {/* =================================================
                                                        EDIT / DELETE
                                                    ================================================= */}

                                                        {isOwnMessage &&
                                                            canModifyMessage(
                                                                item
                                                            ) && (

                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        justifyContent:
                                                                            "flex-end",
                                                                        gap:
                                                                            "6px",
                                                                        marginTop:
                                                                            "6px",
                                                                    }}
                                                                >

                                                                    <Button
                                                                        type="link"
                                                                        size="small"
                                                                        onClick={() =>
                                                                            handleStartEdit(
                                                                                item
                                                                            )
                                                                        }
                                                                        style={{
                                                                            padding:
                                                                                0,
                                                                            height:
                                                                                "auto",
                                                                            fontSize:
                                                                                "11px",
                                                                        }}
                                                                    >
                                                                        Edit
                                                                    </Button>


                                                                    <Button
                                                                        type="link"
                                                                        danger
                                                                        size="small"
                                                                        onClick={() =>
                                                                            handleDeleteMessage(
                                                                                item.id
                                                                            )
                                                                        }
                                                                        style={{
                                                                            padding:
                                                                                0,
                                                                            height:
                                                                                "auto",
                                                                            fontSize:
                                                                                "11px",
                                                                        }}
                                                                    >
                                                                        Delete
                                                                    </Button>

                                                                </div>

                                                            )}


                                                        {/* =================================================
                                                        TIME + DELIVERY
                                                    ================================================= */}

                                                        <div
                                                            style={{
                                                                display:
                                                                    "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "flex-end",
                                                                gap:
                                                                    "4px",
                                                                marginTop:
                                                                    "2px",
                                                            }}
                                                        >

                                                            <span
                                                                className={
                                                                    styles.messageTime
                                                                }
                                                            >
                                                                {item.created_at
                                                                    ? new Date(
                                                                        item.created_at
                                                                    ).toLocaleTimeString(
                                                                        [],
                                                                        {
                                                                            hour:
                                                                                "2-digit",
                                                                            minute:
                                                                                "2-digit",
                                                                        }
                                                                    )
                                                                    : "Just now"}
                                                            </span>


                                                            {isOwnMessage && (

                                                                <span
                                                                    className={
                                                                        item.is_read
                                                                            ? styles.messageReadStatus
                                                                            : item.is_delivered
                                                                                ? styles.messageDeliveredStatus
                                                                                : styles.messageSentStatus
                                                                    }
                                                                >

                                                                    {item.is_delivered ||
                                                                        item.is_read ? (

                                                                        <>

                                                                            <CheckOutlined />

                                                                            <CheckOutlined
                                                                                style={{
                                                                                    marginLeft:
                                                                                        "-5px",
                                                                                }}
                                                                            />

                                                                        </>

                                                                    ) : (

                                                                        <CheckOutlined />

                                                                    )}

                                                                </span>

                                                            )}

                                                        </div>

                                                    </div>

                                                </div>

                                            </div>

                                        );
                                    }
                                                )

                            )}


                                                {/* TYPING */}

                                                {isPartnerTyping && (

                                                    <div
                                                        className={
                                                            styles.messageRow
                                                        }
                                                    >

                                                        <div
                                                            className={`${styles.messageBubble} ${styles.otherMessage}`}
                                                            style={{
                                                                fontStyle:
                                                                    "italic",
                                                                color:
                                                                    "#666",
                                                            }}
                                                        >
                                                            typing...
                                                        </div>

                                                    </div>

                                                )}


                                                <div
                                                    ref={
                                                        messagesEndRef
                                                    }
                                                />

                                            </section>


                        {/* =================================================
                            INPUT
                        ================================================= */}

                                        <footer
                                            className={
                                                styles.messageInputArea
                                            }
                                        >

                                            <input
                                                id="chat-file-input"
                                                type="file"
                                                accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
                                                style={{
                                                    display:
                                                        "none",
                                                }}
                                                onChange={
                                                    handleFileSelect
                                                }
                                            />


                                            <Button
                                                size="large"
                                                icon={
                                                    <PaperClipOutlined />
                                                }
                                                onClick={() =>
                                                    document
                                                        .getElementById(
                                                            "chat-file-input"
                                                        )
                                                        ?.click()
                                                }
                                                disabled={
                                                    uploadingFile
                                                }
                                            />


                                            <Input
                                                size="large"
                                                placeholder={
                                                    selectedFile
                                                        ? selectedFile.name
                                                        : editingMessageId
                                                            ? "Edit message..."
                                                            : "Type a message..."
                                                }
                                                value={
                                                    messageText
                                                }
                                                onChange={
                                                    handleInputChange
                                                }
                                                onKeyDown={
                                                    handleKeyDown
                                                }
                                                disabled={
                                                    uploadingFile
                                                }
                                            />


                                            {editingMessageId && (

                                                <Button
                                                    htmlType="button"
                                                    size="large"
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();

                                                        handleCancelEdit();
                                                    }}
                                                >
                                                    Cancel
                                                </Button>

                                            )}


                                            <Button
                                                htmlType="button"
                                                type="primary"
                                                size="large"
                                                icon={
                                                    <SendOutlined />
                                                }
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();

                                                    handleSendMessage();
                                                }}
                                                loading={
                                                    uploadingFile
                                                }
                                            >
                                                {editingMessageId
                                                    ? "Update"
                                                    : "Send"}
                                            </Button>

                                        </footer>

                    </>

                        ) : (

                        <div
                            style={{
                                display:
                                    "flex",
                                justifyContent:
                                    "center",
                                alignItems:
                                    "center",
                                height:
                                    "100%",
                                color:
                                    "#888",
                            }}
                        >
                            Select a conversation or
                            click "+ New" to start a chat
                        </div>

                )}

                    </main>


                {/* =================================================
                START NEW CHAT MODAL
            ================================================= */}

                <Modal
                    title="Start New Chat"
                    open={isModalOpen}
                    onOk={
                        handleCreateChat
                    }
                    confirmLoading={
                        creatingChat
                    }
                    okText="Start Chat"
                    cancelText="Cancel"
                    onCancel={() => {
                        setIsModalOpen(false);
                        setUserSearch("");
                        setSelectedUser(null);
                    }}
                >

                    {/* USER SEARCH */}

                    <Input
                        prefix={
                            <SearchOutlined />
                        }
                        placeholder="Search registered users..."
                        value={
                            userSearch
                        }
                        onChange={(e) =>
                            setUserSearch(
                                e.target.value
                            )
                        }
                        allowClear
                        style={{
                            marginBottom:
                                "12px",
                        }}
                    />


                    {/* USERS */}

                    {loadingUsers ? (

                        <div
                            style={{
                                textAlign:
                                    "center",
                                padding:
                                    "30px",
                            }}
                        >
                            <Spin />
                        </div>

                    ) : (

                        <div
                            style={{
                                maxHeight:
                                    "350px",
                                overflowY:
                                    "auto",
                                border:
                                    "1px solid #f0f0f0",
                                borderRadius:
                                    "8px",
                            }}
                        >

                            {filteredUsers.map(
                                (user) => {

                                    const isSelected =
                                        String(
                                            selectedUser?.id
                                        ) ===
                                        String(
                                            user.id
                                        );


                                    return (

                                        <button
                                            key={
                                                user.id
                                            }
                                            type="button"
                                            onClick={() =>
                                                setSelectedUser(
                                                    user
                                                )
                                            }
                                            style={{
                                                width:
                                                    "100%",
                                                border:
                                                    "none",
                                                background:
                                                    isSelected
                                                        ? "#e6f4ff"
                                                        : "#fff",
                                                padding:
                                                    "12px",
                                                display:
                                                    "flex",
                                                alignItems:
                                                    "center",
                                                gap:
                                                    "12px",
                                                cursor:
                                                    "pointer",
                                                textAlign:
                                                    "left",
                                                borderBottom:
                                                    "1px solid #f5f5f5",
                                            }}
                                        >

                                            <Avatar
                                                size={42}
                                                icon={
                                                    <UserOutlined />
                                                }
                                            />


                                            <div
                                                style={{
                                                    flex:
                                                        1,
                                                    minWidth:
                                                        0,
                                                }}
                                            >

                                                <div
                                                    style={{
                                                        fontWeight:
                                                            600,
                                                        color:
                                                            "#222",
                                                    }}
                                                >
                                                    {user.username ||
                                                        user.name ||
                                                        user.full_name ||
                                                        `User #${user.id}`}
                                                </div>


                                                {user.email && (

                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "12px",
                                                            color:
                                                                "#888",
                                                            marginTop:
                                                                "2px",
                                                        }}
                                                    >
                                                        {
                                                            user.email
                                                        }
                                                    </div>

                                                )}

                                            </div>


                                            {isSelected && (

                                                <CheckOutlined
                                                    style={{
                                                        color:
                                                            "#1677ff",
                                                        fontSize:
                                                            "18px",
                                                    }}
                                                />

                                            )}

                                        </button>

                                    );
                                }
                            )}


                            {filteredUsers.length ===
                                0 && (

                                    <div
                                        style={{
                                            textAlign:
                                                "center",
                                            padding:
                                                "30px",
                                            color:
                                                "#888",
                                        }}
                                    >
                                        No registered users found.
                                    </div>

                                )}

                        </div>

                    )}


                    {/* SELECTED USER */}

                    {selectedUser && (

                        <div
                            style={{
                                marginTop:
                                    "12px",
                                padding:
                                    "10px",
                                background:
                                    "#f6ffed",
                                border:
                                    "1px solid #b7eb8f",
                                borderRadius:
                                    "8px",
                            }}
                        >

                            <span
                                style={{
                                    color:
                                        "#389e0d",
                                }}
                            >
                                Selected:{" "}
                                <strong>
                                    {selectedUser.username ||
                                        selectedUser.name ||
                                        selectedUser.full_name ||
                                        `User #${selectedUser.id}`}
                                </strong>
                            </span>

                        </div>

                    )}

                </Modal>

        </div >
    );
};


export default ChatPage;