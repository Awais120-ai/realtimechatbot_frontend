import { useEffect, useRef, useState } from "react";

import {
    Avatar,
    Button,
    Input,
    Typography,
    Spin,
    Modal,
    Dropdown,
    ConfigProvider,
    theme,
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
    MoreOutlined,
    CloseOutlined,
    PhoneOutlined,
    VideoCameraOutlined,
    AudioMutedOutlined,
    AudioOutlined,
    DeleteOutlined,
    CaretRightOutlined,
    PauseOutlined,
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
    sendCallInvite,
    sendCallAccept,
    sendCallReject,
    sendCallEnd,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendICECandidate,
} from "../../../services/websocket.service";

import {
    getConversations,
    getConversationMessages,
    createConversation,
    getUnreadCount,
    getUsers,
    uploadChatFile,
    clearChatSession,
} from "../../../api/chat.api";

import {
    AudioCall,
    VideoCall,
    IncomingCall,
    OutgoingCall,
} from "../../../components/calls";

import callService from "../../../services/callService";

import {
    playMessageNotificationSound,
    startCallNotificationSound,
    stopCallNotificationSound,
} from "../../../services/notificationSound.service";

import styles from "./ChatPage.module.css";
import VoiceMessagePlayer from "../../../components/chat/VoiceMessagePlayer";






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

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);

    const callTargetRef = useRef(null);
    const callConversationRef = useRef(null);
    const callTypeRef = useRef(null);
    const callInitiatorRef = useRef(null);

    const [incomingCall, setIncomingCall] =
        useState(null);

    const [outgoingCall, setOutgoingCall] =
        useState(null);

    const [activeCall, setActiveCall] =
        useState(false);

    const [callType, setCallType] =
        useState(null);

    const [localStream, setLocalStream] =
        useState(null);

    const [remoteStream, setRemoteStream] =
        useState(null);

    const [callStatus, setCallStatus] =
        useState(null);

    const [microphoneEnabled, setMicrophoneEnabled] =
        useState(true);

    const [cameraEnabled, setCameraEnabled] =
        useState(true);

    /* ============================================================
       CALL DURATION TIMER
    ============================================================ */

    const [callDuration, setCallDuration] =
        useState(0);

    const callStartTimeRef =
        useRef(null);

    const callTimerRef =
        useRef(null);
    const startOutgoingCall = (
        targetUserId,
        conversationId,
        type = "audio"
    ) => {
        if (
            !websocketRef.current ||
            websocketRef.current.readyState !== WebSocket.OPEN
        ) {
            antMessage.error(
                "WebSocket is not connected."
            );

            return;
        }

        if (!targetUserId || !conversationId) {
            antMessage.error(
                "Call target or conversation is missing."
            );

            return;
        }

        callTargetRef.current =
            Number(targetUserId);

        callConversationRef.current =
            Number(conversationId);

        callTypeRef.current = type;

        callInitiatorRef.current =
            Number(currentUserId);

        setCallType(type);

        setOutgoingCall({
            targetUserId: Number(targetUserId),
            conversationId: Number(conversationId),
            callType: type,
        });

        setCallStatus("calling");

        sendCallInvite(
            websocketRef.current,
            Number(targetUserId),
            Number(conversationId),
            type
        );
    };


    const createCallerOffer = async (
        startedAt = null
    ) => {
        try {
            const targetUserId =
                callTargetRef.current;

            const conversationId =
                callConversationRef.current;

            if (
                !targetUserId ||
                !conversationId
            ) {
                return;
            }

            const activeCallType =
                callTypeRef.current ||
                callType ||
                "audio";

            const callStartedAt =
                startedAt ||
                callStartTimeRef.current ||
                Date.now();

            callStartTimeRef.current =
                callStartedAt;

            console.log(
                "CALL START TIMESTAMP:",
                callStartedAt
            );

            console.log(
                "CALLER CALL TYPE:",
                activeCallType
            );

            const stream =
                await callService.getLocalStream(
                    activeCallType === "video"
                );

            localStreamRef.current = stream;
            setLocalStream(stream);

            /*
             * Make sure an old/closed call
             * does not interfere with this call.
             */
            if (peerConnectionRef.current) {
                try {
                    peerConnectionRef.current.close();
                } catch (error) {
                    console.debug(
                        "Old peer connection was already closed."
                    );
                }

                peerConnectionRef.current = null;
            }

            const peerConnection =
                callService.createPeerConnection();

            peerConnectionRef.current =
                peerConnection;

            callService.onRemoteStream = (
                stream
            ) => {
                remoteStreamRef.current =
                    stream;

                setRemoteStream(stream);
            };

            callService.onConnectionStateChange = (
                state
            ) => {
                console.log(
                    "Caller WebRTC state:",
                    state
                );

                if (state === "connected") {
                    console.log(
                        "CALL CONNECTED - CALLER"
                    );

                    setCallStatus("connected");
                }

                if (
                    state === "failed" ||
                    state === "closed"
                ) {
                    endCurrentCall(false);
                }
            };

            callService.onIceCandidate = (
                candidate
            ) => {
                sendICECandidate(
                    websocketRef.current,
                    targetUserId,
                    conversationId,
                    candidate
                );
            };

            callService.addLocalTracks();

            if (
                !peerConnectionRef.current ||
                peerConnectionRef.current.signalingState ===
                "closed"
            ) {
                throw new Error(
                    "Peer connection was closed before creating the offer."
                );
            }

            const offer =
                await callService.createOffer();

            sendWebRTCOffer(
                websocketRef.current,
                targetUserId,
                conversationId,
                offer,
                activeCallType,
                callStartedAt
            );

            setOutgoingCall(null);
            setActiveCall(true);
            setCallStatus("connecting");

        } catch (error) {
            console.error(
                "Failed to create caller offer:",
                error
            );

            antMessage.error(
                "Could not start the call."
            );

            endCurrentCall(false);
        }
    };


    const acceptIncomingCall = () => {

        stopCallNotificationSound();
        if (!incomingCall) {
            return;
        }

        const {
            fromUserId,
            conversationId,
            callType: incomingCallType,
        } = incomingCall;

        callInitiatorRef.current =
            Number(fromUserId);

        callTargetRef.current =
            Number(fromUserId);

        callConversationRef.current =
            Number(conversationId);

        const activeIncomingCallType =
            incomingCallType === "video"
                ? "video"
                : "audio";

        callTypeRef.current =
            activeIncomingCallType;

        setCallType(
            activeIncomingCallType
        );

        const callStartedAt =
            Date.now();

        callStartTimeRef.current =
            callStartedAt;

        startCallTimer(
            callStartedAt
        );

        sendCallAccept(
            websocketRef.current,
            Number(fromUserId),
            Number(conversationId),
            activeIncomingCallType
        );

        setIncomingCall(null);

        setActiveCall(true);
        setCallStatus("connecting");
    };


    const rejectIncomingCall = () => {
        stopCallNotificationSound();
        if (!incomingCall) {
            return;
        }

        const {
            fromUserId,
            conversationId,
        } = incomingCall;

        sendCallReject(
            websocketRef.current,
            Number(fromUserId),
            Number(conversationId)
        );

        setIncomingCall(null);
        setCallType(null);
        setCallStatus(null);
    };


    /* ============================================================
      CALL TIMER FUNCTIONS
    ============================================================ */

    const startCallTimer = (
        startedAt = null
    ) => {
        //previous timer should be completely stop
        if (callTimerRef.current) {
            clearInterval(
                callTimerRef.current
            );

            callTimerRef.current = null;
        }
        callStartTimeRef.current =
            startedAt || Date.now();

        // ever new call timer should be on 0
        setCallDuration(0);

        const updateTimer = () => {
            if (!callStartTimeRef.current) {
                return;
            }

            const elapsedSeconds =
                Math.max(
                    0,
                    Math.floor(
                        (Date.now() -
                            callStartTimeRef.current) /
                        1000
                    )
                );

            setCallDuration(
                elapsedSeconds
            );
        };

        // Immediately timer calculate 
        updateTimer();

        callTimerRef.current =
            setInterval(
                updateTimer,
                1000
            );
    };

    const stopCallTimer = () => {
        if (callTimerRef.current) {
            clearInterval(
                callTimerRef.current
            );

            callTimerRef.current = null;
        }

        const duration =
            callStartTimeRef.current
                ? Math.max(
                    0,
                    Math.floor(
                        (Date.now() -
                            callStartTimeRef.current) /
                        1000
                    )
                )
                : 0;

        callStartTimeRef.current =
            null;

        setCallDuration(0);

        return duration;
    };


    const endCurrentCall = (
        notifyRemote = true
    ) => {
        stopCallNotificationSound();
        const endedCallDuration =
            stopCallTimer();

        const targetUserId =
            callTargetRef.current;

        const conversationId =
            callConversationRef.current;

        if (
            notifyRemote &&
            websocketRef.current &&
            websocketRef.current.readyState ===
            WebSocket.OPEN &&
            targetUserId &&
            conversationId
        ) {
            sendCallEnd(
                websocketRef.current,
                Number(targetUserId),
                Number(conversationId),
                endedCallDuration,
                callTypeRef.current,
                callInitiatorRef.current
            );
        }

        callService.endCall();

        peerConnectionRef.current = null;
        localStreamRef.current = null;
        remoteStreamRef.current = null;

        callTargetRef.current = null;
        callConversationRef.current = null;
        callTypeRef.current = null;
        callInitiatorRef.current = null;

        setLocalStream(null);
        setRemoteStream(null);

        setIncomingCall(null);
        setOutgoingCall(null);

        setActiveCall(false);
        setCallType(null);
        setCallStatus(null);

        setMicrophoneEnabled(true);
        setCameraEnabled(true);
    };




    const token = getAccessToken();
    const currentUserId = getCurrentUserId(token);

    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) {
            return;
        }

        if (Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.error(
                    "Notification permission error:",
                    error
                );
            }
        }
    };


    const initializeNotifications = async () => {
        try {
            if (
                "Notification" in window &&
                Notification.permission === "default"
            ) {
                await requestNotificationPermission();
            }

            unlockNotificationSound();
        } catch (error) {
            console.debug(
                "Notification initialization failed:",
                error
            );
        }
    };

    useEffect(() => {
        const handleFirstInteraction = () => {
            initializeNotifications();

            window.removeEventListener(
                "click",
                handleFirstInteraction
            );

            window.removeEventListener(
                "keydown",
                handleFirstInteraction
            );

            window.removeEventListener(
                "touchstart",
                handleFirstInteraction
            );
        };

        window.addEventListener(
            "click",
            handleFirstInteraction
        );

        window.addEventListener(
            "keydown",
            handleFirstInteraction
        );

        window.addEventListener(
            "touchstart",
            handleFirstInteraction
        );

        return () => {
            window.removeEventListener(
                "click",
                handleFirstInteraction
            );

            window.removeEventListener(
                "keydown",
                handleFirstInteraction
            );

            window.removeEventListener(
                "touchstart",
                handleFirstInteraction
            );
        };
    }, []);

    const unlockNotificationSound = () => {
        try {
            notificationAudio.muted = true;
            notificationAudio.currentTime = 0;

            const playPromise =
                notificationAudio.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        notificationAudio.pause();
                        notificationAudio.currentTime = 0;
                        notificationAudio.muted = false;
                    })
                    .catch(() => {
                        notificationAudio.muted = false;
                    });
            }
        } catch (error) {
            notificationAudio.muted = false;

            console.debug(
                "Notification sound could not be unlocked:",
                error
            );
        }
    };



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


    // =====================================================
    // VOICE MESSAGE
    // =====================================================

    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
    const [recordedVoice, setRecordedVoice] = useState(null); // { blob, url, duration, file }
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const voiceStreamRef = useRef(null);
    const voiceRecordingIntervalRef = useRef(null);
    const voiceRecordingDurationRef = useRef(0);
    const previewAudioRef = useRef(null);

    const getSupportedAudioMimeType = () => {
        if (typeof MediaRecorder === "undefined") return "";
        const types = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/ogg",
            "audio/mp4",
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return "";
    };

    const formatVoiceTime = (totalSeconds) => {
        if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
    };

    const cleanupVoiceStream = () => {
        if (voiceStreamRef.current) {
            voiceStreamRef.current.getTracks().forEach((track) => track.stop());
            voiceStreamRef.current = null;
        }
        if (voiceRecordingIntervalRef.current) {
            clearInterval(voiceRecordingIntervalRef.current);
            voiceRecordingIntervalRef.current = null;
        }
        setIsRecordingVoice(false);
    };

    const cancelVoiceRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.ondataavailable = null;
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.onerror = null;
            if (mediaRecorderRef.current.state !== "inactive") {
                try {
                    mediaRecorderRef.current.stop();
                } catch (e) {
                    // ignore
                }
            }
            mediaRecorderRef.current = null;
        }
        audioChunksRef.current = [];
        cleanupVoiceStream();
        setVoiceRecordingDuration(0);
        voiceRecordingDurationRef.current = 0;
    };

    const startVoiceRecording = async () => {
        try {
            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {
                antMessage.error(
                    "Microphone recording is not supported in this browser."
                );
                return;
            }

            if (typeof MediaRecorder === "undefined") {
                antMessage.error(
                    "MediaRecorder is not supported in this browser."
                );
                return;
            }

            // Pause any other playing audios
            window.dispatchEvent(
                new CustomEvent("app:pause-other-audios", {
                    detail: { id: "composer-recording" },
                })
            );

            // Discard any existing preview
            if (recordedVoice?.url) {
                URL.revokeObjectURL(recordedVoice.url);
                setRecordedVoice(null);
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            voiceStreamRef.current = stream;
            audioChunksRef.current = [];

            const mimeType = getSupportedAudioMimeType();
            const options = mimeType ? { mimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onerror = (err) => {
                console.error("MediaRecorder error:", err);
                antMessage.error("Voice recording encountered an error.");
                cancelVoiceRecording();
            };

            mediaRecorder.start(200);
            setIsRecordingVoice(true);
            setVoiceRecordingDuration(0);
            voiceRecordingDurationRef.current = 0;

            if (voiceRecordingIntervalRef.current) {
                clearInterval(voiceRecordingIntervalRef.current);
            }
            voiceRecordingIntervalRef.current = setInterval(() => {
                voiceRecordingDurationRef.current += 1;
                setVoiceRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Microphone access error:", error);
            if (
                error.name === "NotAllowedError" ||
                error.name === "PermissionDeniedError"
            ) {
                antMessage.error("Microphone permission was denied.");
            } else {
                antMessage.error(
                    "Microphone access error: " +
                    (error.message || "Failed to start recording")
                );
            }
            cleanupVoiceStream();
        }
    };

    const stopRecordingToPreview = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
            return;
        }

        const finalDuration = Math.max(1, voiceRecordingDurationRef.current || 1);

        mediaRecorderRef.current.onstop = () => {
            const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const ext = mimeType.includes("mp4")
                ? "mp4"
                : mimeType.includes("ogg")
                    ? "ogg"
                    : "webm";
            const audioFile = new File(
                [audioBlob],
                `voice-message-${Date.now()}.${ext}`,
                { type: mimeType }
            );
            const audioUrl = URL.createObjectURL(audioBlob);

            setRecordedVoice({
                blob: audioBlob,
                url: audioUrl,
                duration: finalDuration,
                file: audioFile,
            });

            cleanupVoiceStream();
            audioChunksRef.current = [];
        };

        try {
            mediaRecorderRef.current.stop();
        } catch (err) {
            console.error("Error stopping MediaRecorder:", err);
            cancelVoiceRecording();
        }
    };

    const discardVoicePreview = () => {
        if (recordedVoice?.url) {
            URL.revokeObjectURL(recordedVoice.url);
        }
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current.removeAttribute("src");
            previewAudioRef.current.load();
        }
        setRecordedVoice(null);
        setIsPreviewPlaying(false);
        setPreviewCurrentTime(0);
    };

    const stopRecordingAndSend = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
            return;
        }

        mediaRecorderRef.current.onstop = async () => {
            const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            if (!audioBlob || audioBlob.size === 0) {
                cleanupVoiceStream();
                audioChunksRef.current = [];
                antMessage.warning("Recording was too short.");
                return;
            }

            const ext = mimeType.includes("mp4")
                ? "mp4"
                : mimeType.includes("ogg")
                    ? "ogg"
                    : "webm";
            const audioFile = new File(
                [audioBlob],
                `voice-message-${Date.now()}.${ext}`,
                { type: mimeType }
            );

            cleanupVoiceStream();
            audioChunksRef.current = [];

            await uploadAndSendVoiceFile(audioFile);
        };

        try {
            mediaRecorderRef.current.stop();
        } catch (err) {
            console.error("Error stopping MediaRecorder:", err);
            cancelVoiceRecording();
        }
    };

    const sendRecordedVoice = async () => {
        if (!recordedVoice?.file) return;
        const fileToSend = recordedVoice.file;
        discardVoicePreview();
        await uploadAndSendVoiceFile(fileToSend);
    };

    const uploadAndSendVoiceFile = async (audioFile) => {
        if (!selectedContact?.id) {
            antMessage.error("No conversation selected!");
            return;
        }

        if (
            !websocketRef.current ||
            websocketRef.current.readyState !== WebSocket.OPEN
        ) {
            antMessage.error("WebSocket is not connected!");
            return;
        }

        try {
            setUploadingFile(true);

            const formData = new FormData();
            formData.append("file", audioFile);

            const uploadResponse = await uploadChatFile(formData);

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

            if (!fileUrl) {
                antMessage.error(
                    "Voice upload succeeded, but server did not return file URL."
                );
                return;
            }

            const fileName =
                uploadedFile?.file_name ||
                uploadedFile?.filename ||
                audioFile.name ||
                "voice-message.webm";

            const fileSize =
                uploadedFile?.file_size ??
                uploadedFile?.size ??
                audioFile.size ??
                null;

            const mimeType =
                uploadedFile?.mime_type ||
                uploadedFile?.content_type ||
                audioFile.type ||
                "audio/webm";

            sendChatMessage(
                websocketRef.current,
                selectedContact.id,
                "Voice message",
                {
                    message_type: "audio",
                    file_url: fileUrl,
                    file_name: fileName,
                    file_size: fileSize,
                    mime_type: mimeType,
                }
            );

            // Update conversation sidebar locally
            setConversations((prev) => {
                const selectedConversationId = String(selectedContact.id);
                const currentConversation = prev.find(
                    (conversation) =>
                        String(conversation.id) === selectedConversationId
                );

                if (!currentConversation) return prev;

                const remainingConversations = prev.filter(
                    (conversation) =>
                        String(conversation.id) !== selectedConversationId
                );

                return [
                    {
                        ...currentConversation,
                        last_message: "Voice message",
                        last_message_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        unread_count: currentConversation.unread_count || 0,
                    },
                    ...remainingConversations,
                ];
            });
        } catch (error) {
            console.error("Failed to upload/send voice message:", error);
            antMessage.error("Failed to send voice message. Please try again.");
        } finally {
            setUploadingFile(false);
        }
    };

    const togglePreviewPlayback = () => {
        const audio = previewAudioRef.current;
        if (!audio) return;
        if (isPreviewPlaying) {
            audio.pause();
            setIsPreviewPlaying(false);
        } else {
            // Pause any other voice messages in chat
            window.dispatchEvent(
                new CustomEvent("app:pause-other-audios", {
                    detail: { id: "composer-preview" },
                })
            );
            audio
                .play()
                .then(() => setIsPreviewPlaying(true))
                .catch((err) => {
                    console.warn("Preview playback error:", err);
                    setIsPreviewPlaying(false);
                });
        }
    };

    const seekPreviewPlayback = (e) => {
        const audio = previewAudioRef.current;
        if (!audio || !recordedVoice?.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width)
        );
        const newTime = ratio * recordedVoice.duration;
        audio.currentTime = newTime;
        setPreviewCurrentTime(newTime);
    };

    // Pause composer preview when any chat voice message starts playing
    useEffect(() => {
        const handlePauseOthers = (event) => {
            if (event.detail?.id !== "composer-preview") {
                if (previewAudioRef.current && !previewAudioRef.current.paused) {
                    previewAudioRef.current.pause();
                    setIsPreviewPlaying(false);
                }
            }
        };

        window.addEventListener("app:pause-other-audios", handlePauseOthers);
        return () => {
            window.removeEventListener("app:pause-other-audios", handlePauseOthers);
        };
    }, []);

    // Cleanup voice resources on unmount
    useEffect(() => {
        return () => {
            cleanupVoiceStream();
            if (recordedVoice?.url) {
                URL.revokeObjectURL(recordedVoice.url);
            }
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current.removeAttribute("src");
                previewAudioRef.current.load();
            }
        };
    }, []);

    // =====================================================
    // ATTACHMENT PREVIEW
    // =====================================================

    const [previewAttachment, setPreviewAttachment] = useState(null);

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

    const [incomingToast, setIncomingToast] = useState(null);
    const toastTimeoutRef = useRef(null);

    const showIncomingNotificationToast = (notification) => {

        if (toastTimeoutRef.current) {

            clearTimeout(toastTimeoutRef.current);

        }

        const toastNotification = {
            ...notification,
            body:
                notification?.body &&
                    String(notification.body).length > 15
                    ? `${String(notification.body).slice(0, 15)}...`
                    : notification?.body,
            isExiting: false,
        };

        setIncomingToast(toastNotification);

        toastTimeoutRef.current = setTimeout(() => {

            setIncomingToast((prev) => (
                prev
                    ? { ...prev, isExiting: true }
                    : null
            ));

            setTimeout(() => {

                setIncomingToast(null);

            }, 260);

        }, 4500);

    };

    const handleDismissToast = (e) => {
        if (e) {
            e.stopPropagation();
        }
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setIncomingToast((prev) => (prev ? { ...prev, isExiting: true } : null));
        setTimeout(() => {
            setIncomingToast(null);
        }, 260);
    };

    const handleToastClick = async () => {
        if (!incomingToast) return;
        const toastData = incomingToast;
        handleDismissToast();

        const conversationId = getNotificationConversationId(toastData);
        if (conversationId) {
            try {
                let conversation = conversations.find(
                    (item) => String(item.id) === String(conversationId)
                );
                if (!conversation) {
                    const refreshed = await fetchConversations();
                    conversation = refreshed.find(
                        (item) => String(item.id) === String(conversationId)
                    );
                }
                if (conversation) {
                    setSelectedContact(conversation);
                    setConversations((prev) =>
                        prev.map((item) =>
                            String(item.id) === String(conversationId)
                                ? { ...item, unread_count: 0 }
                                : item
                        )
                    );
                }
            } catch (error) {
                console.error("Failed to open notification conversation:", error);
            }
        }
    };

    const formatToastTime = (createdAt) => {
        if (!createdAt) return "Just now";
        try {
            const date = new Date(createdAt);
            if (isNaN(date.getTime())) return "Just now";
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "Just now";
        }
    };


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

    useEffect(() => {
        document.body.classList.toggle("dark-mode", Boolean(darkMode));
        document.documentElement.setAttribute(
            "data-theme",
            darkMode ? "dark" : "light"
        );
        return () => {
            document.body.classList.remove("dark-mode");
        };
    }, [darkMode]);


    /* ========================================================
       KEEP SELECTED CONTACT REF UPDATED
    ======================================================== */

    useEffect(() => {
        selectedContactRef.current =
            selectedContact;

        // Discard any in-progress recording or preview if user switches chats
        if (isRecordingVoice) {
            cancelVoiceRecording();
        }
        if (recordedVoice) {
            discardVoicePreview();
        }
    }, [selectedContact?.id]);



    /* ========================================================
   AUTO MARK OPEN CHAT NOTIFICATIONS AS READ
   ======================================================== */

    useEffect(() => {
        const activeConversationId =
            selectedContact?.id;

        if (
            !activeConversationId ||
            !Array.isArray(notifications) ||
            notifications.length === 0
        ) {
            return;
        }

        const unreadNotifications =
            notifications.filter((notification) => {
                if (notification.is_read) {
                    return false;
                }

                const notificationConversationId =
                    getNotificationConversationId(
                        notification
                    );

                return (
                    String(notificationConversationId) ===
                    String(activeConversationId)
                );
            });

        if (unreadNotifications.length === 0) {
            return;
        }

        let cancelled = false;

        const markOpenChatNotificationsRead =
            async () => {
                try {
                    const {
                        markNotificationAsRead,
                    } = await import(
                        "../../../api/notification.api"
                    );

                    const notificationIds =
                        unreadNotifications.map(
                            (notification) =>
                                notification.id
                        );

                    await Promise.all(
                        unreadNotifications.map(
                            (notification) =>
                                markNotificationAsRead(
                                    notification.id
                                )
                        )
                    );

                    if (cancelled) {
                        return;
                    }

                    /*
                     * Notification list ko locally read mark karo
                     */
                    setNotifications((prev) =>
                        prev.filter(
                            (notification) =>
                                !notificationIds.includes(
                                    notification.id
                                )
                        )
                    );

                    /*
                     * Bell counter ko instantly decrease karo
                     */
                    setNotificationCount((prev) =>
                        Math.max(
                            0,
                            prev -
                            unreadNotifications.length
                        )
                    );
                } catch (error) {
                    console.error(
                        "Failed to auto-mark open chat notifications as read:",
                        error
                    );
                }
            };

        markOpenChatNotificationsRead();

        return () => {
            cancelled = true;
        };
    }, [
        selectedContact?.id,
        notifications,
    ]);

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


    const formatCallDuration = (seconds) => {
        const totalSeconds =
            Number(seconds) || 0;

        const minutes =
            Math.floor(totalSeconds / 60);

        const remainingSeconds =
            totalSeconds % 60;

        return `${minutes
            .toString()
            .padStart(2, "0")}:${remainingSeconds
                .toString()
                .padStart(2, "0")}`;
    };


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


                    // =====================================================
                    // WEBRTC SIGNALING
                    // =====================================================

                    if (
                        data?.type === "call_invite"
                    ) {
                        console.log(
                            "========== INCOMING CALL =========="
                        );
                        console.log(data);
                        startCallNotificationSound();

                        setIncomingCall({
                            fromUserId:
                                data.from_user_id ||
                                data.fromUserId,
                            conversationId:
                                data.conversation_id ||
                                data.conversationId,
                            callType:
                                data.call_type ||
                                "audio",
                        });

                        setCallType(
                            data.call_type ||
                            "audio"
                        );

                        return;
                    }


                    if (data?.type === "call_reject") {
                        console.log("Call rejected by remote user.");

                        stopCallNotificationSound();

                        endCurrentCall(false);

                        antMessage.info("Call rejected.");

                        return;
                    }


                    if (data?.type === "call_accept") {
                        console.log(
                            "========== CALL ACCEPTED =========="
                        );

                        stopCallNotificationSound();

                        const callStartedAt =
                            Date.now();

                        callStartTimeRef.current =
                            callStartedAt;

                        startCallTimer(
                            callStartedAt
                        );

                        setActiveCall(true);
                        setOutgoingCall(null);
                        setCallStatus("connecting");

                        await createCallerOffer(
                            callStartedAt
                        );

                        return;
                    }


                    if (
                        data?.type === "call_reject"
                    ) {
                        console.log(
                            "========== CALL REJECTED =========="
                        );
                        console.log(data);

                        setActiveCall(false);
                        setIncomingCall(null);

                        return;
                    }


                    if (
                        data?.type === "call_end"
                    ) {
                        console.log(
                            "========== CALL ENDED =========="
                        );
                        console.log(data);
                        stopCallNotificationSound();

                        endCurrentCall(false);

                        return;
                    }


                    if (data?.type === "webrtc_offer") {
                        try {

                            const receiverCallStartedAt =
                                Number(data.call_started_at) ||
                                Date.now();

                            console.log(
                                "RECEIVER CALL STARTED AT:",
                                receiverCallStartedAt
                            );
                            const fromUserId =
                                data.from_user_id ||
                                data.fromUserId;

                            const conversationId =
                                data.conversation_id ||
                                data.conversationId;

                            const offer =
                                data.offer ||
                                data.payload?.offer;

                            if (!offer) {
                                console.error(
                                    "WebRTC offer missing."
                                );

                                return;
                            }

                            callTargetRef.current =
                                Number(fromUserId);

                            callConversationRef.current =
                                Number(conversationId);

                            const incomingCallType =
                                data.call_type ||
                                data.callType ||
                                callTypeRef.current ||
                                callType ||
                                "audio";

                            console.log(
                                "RECEIVER CALL TYPE:",
                                incomingCallType
                            );

                            callTypeRef.current =
                                incomingCallType;

                            setCallType(incomingCallType);

                            const stream =
                                await callService.getLocalStream(
                                    incomingCallType === "video"
                                );

                            localStreamRef.current = stream;
                            setLocalStream(stream);

                            const peerConnection =
                                callService.createPeerConnection();

                            peerConnectionRef.current =
                                peerConnection;

                            callService.onRemoteStream = (
                                stream
                            ) => {
                                remoteStreamRef.current =
                                    stream;

                                setRemoteStream(stream);
                            };

                            callService.onConnectionStateChange = (
                                state
                            ) => {
                                console.log(
                                    "Receiver WebRTC state:",
                                    state
                                );

                                if (state === "connected") {
                                    console.log(
                                        "CALL CONNECTED - RECEIVER"
                                    );

                                    setCallStatus("connected");
                                }

                                if (
                                    state === "failed" ||
                                    state === "closed"
                                ) {
                                    endCurrentCall(false);
                                }
                            };

                            callService.onIceCandidate = (
                                candidate
                            ) => {
                                sendICECandidate(
                                    websocketRef.current,
                                    Number(fromUserId),
                                    Number(conversationId),
                                    candidate
                                );
                            };

                            callService.addLocalTracks();

                            await callService.setRemoteOffer(
                                offer
                            );

                            const answer =
                                await callService.createAnswer();

                            sendWebRTCAnswer(
                                websocketRef.current,
                                Number(fromUserId),
                                Number(conversationId),
                                answer
                            );

                            setActiveCall(true);
                            setCallStatus("connecting");

                        } catch (error) {
                            console.error(
                                "Failed to handle WebRTC offer:",
                                error
                            );
                        }

                        return;
                    }


                    if (
                        data?.type === "webrtc_answer"
                    ) {
                        console.log(
                            "========== WEBRTC ANSWER =========="
                        );

                        console.log(
                            "Incoming WebRTC answer:",
                            data
                        );

                        try {
                            const answer =
                                data.answer ||
                                data.payload?.answer;

                            if (!answer) {
                                console.error(
                                    "WebRTC answer is missing:",
                                    data
                                );

                                return;
                            }

                            if (
                                !peerConnectionRef.current
                            ) {
                                console.error(
                                    "Peer connection is not available."
                                );

                                return;
                            }

                            await callService.setRemoteAnswer(
                                answer
                            );

                            console.log(
                                "Remote WebRTC answer applied successfully."
                            );

                            setActiveCall(true);

                        } catch (error) {
                            console.error(
                                "Failed to apply WebRTC answer:",
                                error
                            );
                        }

                        return;
                    }


                    if (
                        data?.type === "webrtc_ice_candidate"
                    ) {
                        console.log(
                            "========== WEBRTC ICE CANDIDATE =========="
                        );

                        console.log(
                            "Incoming ICE candidate:",
                            data
                        );

                        try {
                            const candidate =
                                data.candidate ||
                                data.payload?.candidate;

                            if (!candidate) {
                                console.error(
                                    "ICE candidate is missing:",
                                    data
                                );

                                return;
                            }

                            await callService.addIceCandidate(
                                candidate
                            );

                            console.log(
                                "ICE candidate added successfully."
                            );

                        } catch (error) {
                            console.error(
                                "Failed to handle ICE candidate:",
                                error
                            );
                        }

                        return;
                    }

                    /* =================================================
                       NEW NOTIFICATION
                    ================================================= */

                    if (data?.type === "new_notification") {

                        const notification = data?.notification;

                        // Safety check
                        if (!notification) {
                            return;
                        }

                        /* ---------------------------------------------
                           PLAY NOTIFICATION SOUND
                        --------------------------------------------- */

                        playMessageNotificationSound();

                        /* ---------------------------------------------
                           ADD NOTIFICATION
                        --------------------------------------------- */

                        setNotifications((prev) => [
                            notification,
                            ...prev,
                        ]);

                        /* ---------------------------------------------
                           UPDATE UNREAD NOTIFICATION COUNT
                        --------------------------------------------- */

                        if (!notification.is_read) {
                            setNotificationCount((prev) => prev + 1);
                        }

                        /* ---------------------------------------------
                           IN-APP NOTIFICATION
                        --------------------------------------------- */

                        showIncomingNotificationToast(notification);

                        /* ---------------------------------------------
                           BROWSER NOTIFICATION
                        --------------------------------------------- */



                        if (
                            "Notification" in window &&
                            Notification.permission === "granted"
                        ) {
                            const browserNotification = new Notification(
                                notification.title || "New message",
                                {
                                    body:
                                        notification.body
                                            ? `${String(notification.body).slice(0, 15)}...`
                                            : "You have a new message.",
                                }
                            );

                            browserNotification.onclick = async () => {
                                window.focus();

                                const conversationId =
                                    getNotificationConversationId(
                                        notification
                                    );

                                if (!conversationId) {
                                    return;
                                }

                                try {
                                    let conversation =
                                        conversations.find(
                                            (item) =>
                                                String(item.id) ===
                                                String(conversationId)
                                        );

                                    if (!conversation) {
                                        const refreshed =
                                            await fetchConversations();

                                        conversation =
                                            refreshed.find(
                                                (item) =>
                                                    String(item.id) ===
                                                    String(conversationId)
                                            );
                                    }

                                    if (conversation) {
                                        setSelectedContact(
                                            conversation
                                        );

                                        setConversations((prev) =>
                                            prev.map((item) =>
                                                String(item.id) ===
                                                    String(conversationId)
                                                    ? {
                                                        ...item,
                                                        unread_count: 0,
                                                    }
                                                    : item
                                            )
                                        );
                                    }

                                    browserNotification.close();
                                } catch (error) {
                                    console.error(
                                        "Failed to open notification conversation:",
                                        error
                                    );
                                }
                            };
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
                            const isCurrentConversation =
                                incomingConvId === currentConvId;

                            setConversations((prev) => {
                                const index = prev.findIndex(
                                    (conversation) =>
                                        String(conversation.id) ===
                                        incomingConvId
                                );

                                // ==========================================
                                // CONVERSATION ALREADY EXISTS
                                // ==========================================
                                if (index !== -1) {
                                    const conversation = prev[index];

                                    const updatedConversation = {
                                        ...conversation,

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

                                    // ==========================================
                                    // MOVE LATEST CHAT TO TOP
                                    // ==========================================
                                    return [
                                        updatedConversation,
                                        ...prev.filter(
                                            (_, i) => i !== index
                                        ),
                                    ];
                                }

                                // ==========================================
                                // CONVERSATION NOT IN SIDEBAR
                                // ==========================================
                                //
                                // IMPORTANT:
                                // DO NOT call fetchConversations().
                                //
                                // Existing sidebar ko refresh nahi karna.
                                //
                                return prev;
                            });
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
       clear chat
    ======================================================== */

    const handleClearChat = async () => {
        if (!selectedContact?.id) {
            return;
        }

        Modal.confirm({
            title: "Clear chat?",
            content:
                "Are you sure you want to clear all messages from this conversation?",
            okText: "Clear",
            cancelText: "Cancel",
            okButtonProps: {
                danger: true,
            },

            onOk: async () => {
                try {
                    await clearChatSession(
                        selectedContact.id
                    );

                    // Immediately clear UI
                    setMessages([]);

                    // Exit edit mode if active
                    setEditingMessageId(null);
                    setMessageText("");

                    // Close notification popup if open
                    setNotificationOpen(false);

                    antMessage.success(
                        "Chat cleared successfully."
                    );
                } catch (error) {
                    console.error(
                        "Failed to clear chat:",
                        error
                    );

                    antMessage.error(
                        error?.response?.data?.detail ||
                        "Failed to clear chat."
                    );
                }
            },
        });
    };

    /* ========================================================
       LOGOUT
    ======================================================== */

    const handleLogout = () => {
        stopCallNotificationSound();
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

    const openAttachmentPreview = (
        attachmentUrl,
        fileName,
        mimeType
    ) => {
        if (!attachmentUrl) {
            return;
        }

        setPreviewAttachment({
            url: attachmentUrl,
            fileName: fileName || "Attachment",
            mimeType: mimeType || "",
        });
    };

    // Close attachment preview on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && previewAttachment) {
                setPreviewAttachment(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [previewAttachment]);


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
                            : mimeType.startsWith("audio/")
                                ? "audio"
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
        <ConfigProvider
            theme={{
                algorithm: darkMode
                    ? theme.darkAlgorithm
                    : theme.defaultAlgorithm,
                token: {
                    colorPrimary: "#00a884",
                    colorLink: darkMode ? "#53bdeb" : "#027eb5",
                    borderRadius: 8,
                },
            }}
        >
            <div
                className={`${styles.chatPage} ${darkMode ? styles.darkMode : ""
                    }`}
            >

                {/* =================================================
                INCOMING MESSAGE TOAST NOTIFICATION
            ================================================= */}
                {incomingToast && (() => {
                    const toastSenderId =
                        incomingToast?.data?.sender_id ||
                        incomingToast?.data?.senderId ||
                        incomingToast?.sender_id;
                    const toastSenderUser = toastSenderId
                        ? usersMap[String(toastSenderId)]
                        : null;
                    const toastAvatarUrl =
                        toastSenderUser?.avatar_url ||
                        incomingToast?.avatar_url ||
                        null;
                    const toastSenderName =
                        incomingToast?.title ||
                        toastSenderUser?.username ||
                        toastSenderUser?.name ||
                        "New Message";
                    const toastInitial = toastSenderName.charAt(0).toUpperCase();

                    return (
                        <div
                            className={`${styles.incomingToast} ${incomingToast.isExiting ? styles.incomingToastExit : ""
                                }`}
                            onClick={handleToastClick}
                            role="alert"
                            aria-live="polite"
                        >
                            <div className={styles.toastAvatarWrapper}>
                                {toastAvatarUrl ? (
                                    <Avatar
                                        src={toastAvatarUrl}
                                        size={38}
                                        className={styles.toastAvatar}
                                    />
                                ) : (
                                    <Avatar
                                        size={38}
                                        className={styles.toastAvatar}
                                        style={{
                                            backgroundColor: "#00a884",
                                            color: "#ffffff",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {toastInitial || <UserOutlined />}
                                    </Avatar>
                                )}
                                <span className={styles.toastUnreadDot} />
                            </div>

                            <div className={styles.toastContent}>
                                <div className={styles.toastHeader}>
                                    <span className={styles.toastSenderName}>
                                        {toastSenderName}
                                    </span>
                                    <span className={styles.toastTime}>
                                        {formatToastTime(incomingToast.created_at)}
                                    </span>
                                </div>
                                <p className={styles.toastMessagePreview}>
                                    {incomingToast.body || "You have a new message"}
                                </p>
                            </div>

                            <button
                                type="button"
                                className={styles.toastCloseBtn}
                                onClick={handleDismissToast}
                                aria-label="Dismiss notification"
                            >
                                <CloseOutlined />
                            </button>
                        </div>
                    );
                })()}

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
                                                    contact?.other_user?.profile_picture
                                                        ? normalizeFileUrl(
                                                            contact.other_user.profile_picture
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
                                                                    "#25d366",
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
                                            key={
                                                selectedContact?.other_user?.profile_picture ||
                                                selectedContact?.partner_user?.profile_picture ||
                                                "default-avatar"
                                            }
                                            size={48}
                                            src={
                                                selectedContact?.other_user?.profile_picture
                                                    ? normalizeFileUrl(
                                                        selectedContact.other_user.profile_picture
                                                    )
                                                    : selectedContact?.partner_user?.profile_picture
                                                        ? normalizeFileUrl(
                                                            selectedContact.partner_user.profile_picture
                                                        )
                                                        : undefined
                                            }
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
                                                            "#00a884",
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


                                <Button
                                    type="text"
                                    icon={<PhoneOutlined />}
                                    aria-label="Audio call"
                                    onClick={() => {
                                        const targetUserId =
                                            selectedContact?.other_user?.id;

                                        if (!targetUserId) {
                                            antMessage.error(
                                                "User information is missing."
                                            );

                                            return;
                                        }

                                        startOutgoingCall(
                                            targetUserId,
                                            selectedContact.id,
                                            "audio"
                                        );
                                    }}
                                />

                                <Button
                                    type="text"
                                    icon={<VideoCameraOutlined />}
                                    aria-label="Video call"
                                    onClick={() => {
                                        const targetUserId =
                                            selectedContact?.other_user?.id;

                                        if (!targetUserId) {
                                            antMessage.error(
                                                "User information is missing."
                                            );

                                            return;
                                        }

                                        startOutgoingCall(
                                            targetUserId,
                                            selectedContact.id,
                                            "video"
                                        );
                                    }}
                                />


                                {/* NOTIFICATION BUTTON */}

                                <div
                                    style={{
                                        marginLeft: "auto",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                    }}
                                >
                                    {/* NOTIFICATION */}

                                    <div
                                        style={{
                                            position: "relative",
                                        }}
                                    >
                                        <Button
                                            type="text"
                                            icon={<BellOutlined />}
                                            onClick={() =>
                                                setNotificationOpen(
                                                    (prev) => !prev
                                                )
                                            }
                                        />

                                        {notificationCount > 0 && (
                                            <span
                                                style={{
                                                    position: "absolute",
                                                    top: "0",
                                                    right: "0",
                                                    minWidth: "18px",
                                                    height: "18px",
                                                    borderRadius: "9px",
                                                    background: "#ff4d4f",
                                                    color: "#fff",
                                                    fontSize: "10px",
                                                    fontWeight: 700,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    padding: "0 4px",
                                                }}
                                            >
                                                {notificationCount > 99
                                                    ? "99+"
                                                    : notificationCount}
                                            </span>
                                        )}
                                    </div>

                                    {/* THREE DOTS MENU */}

                                    <Dropdown
                                        trigger={["click"]}
                                        placement="bottomRight"
                                        menu={{
                                            items: [
                                                {
                                                    key: "clear-chat",
                                                    label: (
                                                        <span
                                                            style={{
                                                                color: "#ff4d4f",
                                                            }}
                                                        >
                                                            Clear chat
                                                        </span>
                                                    ),
                                                },
                                            ],

                                            onClick: ({ key }) => {
                                                if (key === "clear-chat") {
                                                    handleClearChat();
                                                }
                                            },
                                        }}
                                    >
                                        <Button
                                            type="text"
                                            icon={<MoreOutlined />}
                                            aria-label="Chat options"
                                        />
                                    </Dropdown>
                                </div>


                                {/* NOTIFICATION PANEL */}

                                {notificationOpen && (

                                    <div
                                        className={styles.notificationPopup}
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

                                                                setNotifications([]);

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
                                                    color: darkMode
                                                        ? "#8696a0"
                                                        : "#888",
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

                                                                    setNotifications((prev) =>
                                                                        prev.filter(
                                                                            (item) =>
                                                                                item.id !== notification.id
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
                                                                    : darkMode
                                                                        ? "#202c33"
                                                                        : "#e7fce3",
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
                                                                color: darkMode
                                                                    ? "#e9edef"
                                                                    : "#111b21",
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
                                                                color: darkMode
                                                                    ? "#aebac1"
                                                                    : "#667781",
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
                                                                color: darkMode
                                                                    ? "#8696a0"
                                                                    : "#8696a0",
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


                                            const isCall =
                                                item.message_type === "call";


                                            let callData = {};

                                            if (isCall) {
                                                try {
                                                    callData =
                                                        typeof item.content === "string"
                                                            ? JSON.parse(item.content)
                                                            : item.content || {};
                                                } catch (error) {
                                                    callData = {};
                                                }
                                            }


                                            const isOwnMessage =
                                                isCall
                                                    ? (
                                                        currentUserId &&
                                                        String(
                                                            callData?.call_initiator_id ||
                                                            senderId
                                                        ) ===
                                                        String(
                                                            currentUserId
                                                        )
                                                    )
                                                    : (
                                                        item.is_self ||
                                                        (
                                                            currentUserId &&
                                                            String(
                                                                senderId
                                                            ) ===
                                                            String(
                                                                currentUserId
                                                            )
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

                                            const isAudio =
                                                !!attachmentUrl &&
                                                (
                                                    item.message_type ===
                                                    "audio" ||
                                                    String(
                                                        item.mime_type ||
                                                        ""
                                                    ).startsWith(
                                                        "audio/"
                                                    )
                                                );

                                            const isFile =
                                                !!attachmentUrl &&
                                                !isImage &&
                                                !isAudio;


                                            const callType =
                                                callData?.call_type === "video"
                                                    ? "video"
                                                    : "audio";

                                            const callDuration =
                                                Number(callData?.duration) || 0;


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

                                                                        <div
                                                                            onClick={() =>
                                                                                openAttachmentPreview(
                                                                                    attachmentUrl,
                                                                                    item.file_name,
                                                                                    item.mime_type
                                                                                )
                                                                            }
                                                                            style={{
                                                                                cursor: "pointer",
                                                                                display: "inline-block",
                                                                            }}
                                                                        >
                                                                            <img
                                                                                src={attachmentUrl}
                                                                                alt={item.file_name || "Image"}
                                                                                style={{
                                                                                    maxWidth: "280px",
                                                                                    maxHeight: "300px",
                                                                                    borderRadius: "10px",
                                                                                    display: "block",
                                                                                    objectFit: "contain",
                                                                                }}
                                                                            />
                                                                        </div>

                                                                    </div>

                                                                )}


                                                                {/* AUDIO / VOICE MESSAGE */}
                                                                {isAudio && (
                                                                    <VoiceMessagePlayer
                                                                        audioUrl={attachmentUrl}
                                                                        isOwnMessage={isOwnMessage}
                                                                        darkMode={darkMode}
                                                                        messageId={item.id}
                                                                    />
                                                                )}


                                                                {/* FILE */}

                                                                {isFile && (

                                                                    <div
                                                                        onClick={() =>
                                                                            openAttachmentPreview(
                                                                                attachmentUrl,
                                                                                item.file_name,
                                                                                item.mime_type
                                                                            )
                                                                        }
                                                                        style={{
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            gap: "10px",
                                                                            padding: "10px",
                                                                            borderRadius: "8px",
                                                                            background: "rgba(0,0,0,0.05)",
                                                                            cursor: "pointer",
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
                                                                                    download={
                                                                                        item.file_name ||
                                                                                        "attachment"
                                                                                    }
                                                                                    onClick={(
                                                                                        event
                                                                                    ) => {
                                                                                        event.stopPropagation();
                                                                                        handleFileDownload(
                                                                                            event,
                                                                                            item.id
                                                                                        );
                                                                                    }}
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


                                                                {/* CALL MESSAGE */}

                                                                {item.message_type === "call" && (() => {

                                                                    let callData = {};

                                                                    try {
                                                                        callData =
                                                                            typeof item.content === "string"
                                                                                ? JSON.parse(item.content)
                                                                                : item.content || {};
                                                                    } catch (error) {
                                                                        callData = {};
                                                                    }

                                                                    const callType =
                                                                        callData?.call_type === "video"
                                                                            ? "video"
                                                                            : "audio";

                                                                    const duration =
                                                                        Number(callData?.duration) || 0;

                                                                    return (
                                                                        <div
                                                                            style={{
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                                gap: "12px",
                                                                                minWidth: "180px",
                                                                                padding: "8px 4px",
                                                                            }}
                                                                        >

                                                                            <div
                                                                                style={{
                                                                                    fontSize: "28px",
                                                                                }}
                                                                            >
                                                                                {callType === "video"
                                                                                    ? "📹"
                                                                                    : "📞"}
                                                                            </div>

                                                                            <div>

                                                                                <div
                                                                                    style={{
                                                                                        fontWeight: "600",
                                                                                        fontSize: "14px",
                                                                                    }}
                                                                                >
                                                                                    {callType === "video"
                                                                                        ? "Video call"
                                                                                        : "Audio call"}
                                                                                </div>

                                                                                <div
                                                                                    style={{
                                                                                        fontSize: "13px",
                                                                                        opacity: 0.7,
                                                                                        marginTop: "2px",
                                                                                    }}
                                                                                >
                                                                                    {formatCallDuration(
                                                                                        duration
                                                                                    )}
                                                                                </div>

                                                                            </div>

                                                                        </div>
                                                                    );

                                                                })()}


                                                                {/* TEXT */}

                                                                {item.message_type !== "call" &&
                                                                    item.content &&
                                                                    item.content !==
                                                                    "Attachment" &&
                                                                    item.content !==
                                                                    "Voice message" && (

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
                                                                item.message_type !== "call" &&
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


                                <audio
                                    ref={previewAudioRef}
                                    src={recordedVoice?.url || ""}
                                    onTimeUpdate={() => {
                                        if (previewAudioRef.current) {
                                            setPreviewCurrentTime(
                                                previewAudioRef.current
                                                    .currentTime
                                            );
                                        }
                                    }}
                                    onEnded={() => {
                                        setIsPreviewPlaying(false);
                                        setPreviewCurrentTime(0);
                                    }}
                                    onPause={() => setIsPreviewPlaying(false)}
                                    onPlay={() => setIsPreviewPlaying(true)}
                                    style={{ display: "none" }}
                                />

                                {isRecordingVoice ? (
                                    /* =================================================
                                       WHATSAPP-STYLE RECORDING BAR
                                    ================================================= */
                                    <div className={styles.voiceRecordingBar}>
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            className={styles.voiceCancelBtn}
                                            onClick={cancelVoiceRecording}
                                            title="Discard recording"
                                            size="large"
                                        />

                                        <div className={styles.voiceRecordingIndicator}>
                                            <span className={styles.recordingPulseDot} />
                                            <span className={styles.recordingTimerText}>
                                                {formatVoiceTime(voiceRecordingDuration)}
                                            </span>
                                            <div className={styles.recordingWaves}>
                                                <span className={styles.waveBar} />
                                                <span className={styles.waveBar} />
                                                <span className={styles.waveBar} />
                                                <span className={styles.waveBar} />
                                            </div>
                                        </div>

                                        <div className={styles.voiceRecordingActions}>
                                            <Button
                                                type="default"
                                                className={styles.voiceStopPreviewBtn}
                                                onClick={stopRecordingToPreview}
                                                title="Preview voice message"
                                                size="large"
                                            >
                                                Stop
                                            </Button>

                                            <Button
                                                type="primary"
                                                icon={<SendOutlined />}
                                                className={styles.voiceSendBtn}
                                                onClick={stopRecordingAndSend}
                                                loading={uploadingFile}
                                                title="Send voice message"
                                                size="large"
                                            />
                                        </div>
                                    </div>
                                ) : recordedVoice ? (
                                    /* =================================================
                                       WHATSAPP-STYLE VOICE PREVIEW BAR
                                    ================================================= */
                                    <div className={styles.voicePreviewBar}>
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            className={styles.voiceCancelBtn}
                                            onClick={discardVoicePreview}
                                            title="Delete recording"
                                            size="large"
                                            disabled={uploadingFile}
                                        />

                                        <button
                                            type="button"
                                            className={styles.voicePreviewPlayBtn}
                                            onClick={togglePreviewPlayback}
                                            disabled={uploadingFile}
                                            aria-label={
                                                isPreviewPlaying
                                                    ? "Pause preview"
                                                    : "Play preview"
                                            }
                                        >
                                            {isPreviewPlaying ? (
                                                <PauseOutlined />
                                            ) : (
                                                <CaretRightOutlined />
                                            )}
                                        </button>

                                        <div
                                            className={styles.voicePreviewWaveformWrapper}
                                            onClick={seekPreviewPlayback}
                                            title="Seek preview"
                                        >
                                            <div
                                                className={styles.voicePreviewProgressBar}
                                                style={{
                                                    width: `${recordedVoice.duration > 0
                                                            ? Math.min(
                                                                100,
                                                                (previewCurrentTime /
                                                                    recordedVoice.duration) *
                                                                100
                                                            )
                                                            : 0
                                                        }%`,
                                                }}
                                            />
                                        </div>

                                        <span className={styles.voicePreviewTime}>
                                            {formatVoiceTime(previewCurrentTime)} /{" "}
                                            {formatVoiceTime(recordedVoice.duration)}
                                        </span>

                                        <Button
                                            type="primary"
                                            icon={<SendOutlined />}
                                            className={styles.voiceSendBtn}
                                            onClick={sendRecordedVoice}
                                            loading={uploadingFile}
                                            title="Send voice message"
                                            size="large"
                                        />
                                    </div>
                                ) : (
                                    /* =================================================
                                       NORMAL COMPOSER
                                    ================================================= */
                                    <>
                                        <Button
                                            size="large"
                                            icon={<PaperClipOutlined />}
                                            onClick={() =>
                                                document
                                                    .getElementById("chat-file-input")
                                                    ?.click()
                                            }
                                            disabled={uploadingFile}
                                        />

                                        <Button
                                            size="large"
                                            icon={<AudioOutlined />}
                                            className={styles.voiceMicBtn}
                                            onClick={startVoiceRecording}
                                            disabled={uploadingFile}
                                            title="Record voice message"
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
                                            value={messageText}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            disabled={uploadingFile}
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
                                            icon={<SendOutlined />}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                handleSendMessage();
                                            }}
                                            loading={uploadingFile}
                                        >
                                            {editingMessageId ? "Update" : "Send"}
                                        </Button>
                                    </>
                                )}

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
                ATTACHMENT PREVIEW MODAL
            ================================================= */}

                {previewAttachment && (() => {
                    const mime = String(
                        previewAttachment.mimeType || ""
                    ).toLowerCase();

                    const isPreviewImage =
                        mime.startsWith("image/");

                    const isPreviewPdf =
                        mime === "application/pdf" ||
                        previewAttachment.fileName
                            ?.toLowerCase()
                            .endsWith(".pdf");

                    // Files the browser can embed in an iframe
                    const isBrowserPreviewable =
                        isPreviewImage ||
                        isPreviewPdf ||
                        mime.startsWith("text/") ||
                        mime === "application/json";

                    return (
                        <div
                            style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 20000,
                                background: "rgba(0, 0, 0, 0.88)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            onClick={() =>
                                setPreviewAttachment(null)
                            }
                        >
                            {/* Header bar */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: "56px",
                                    background: "rgba(0,0,0,0.6)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "0 20px",
                                    zIndex: 1,
                                }}
                                onClick={(e) =>
                                    e.stopPropagation()
                                }
                            >
                                <span
                                    style={{
                                        color: "#e9edef",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        maxWidth: "60%",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {previewAttachment.fileName}
                                </span>

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    {/* Download button in viewer */}
                                    <a
                                        href={
                                            previewAttachment.url
                                        }
                                        download={
                                            previewAttachment.fileName ||
                                            "attachment"
                                        }
                                        onClick={(e) =>
                                            e.stopPropagation()
                                        }
                                        style={{
                                            color: "#e9edef",
                                            fontSize: "20px",
                                            lineHeight: 1,
                                            padding: "6px 10px",
                                            borderRadius: "8px",
                                            background:
                                                "rgba(255,255,255,0.1)",
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                        title="Download"
                                    >
                                        <DownloadOutlined />
                                    </a>

                                    {/* Close button */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPreviewAttachment(
                                                null
                                            )
                                        }
                                        style={{
                                            background:
                                                "rgba(255,255,255,0.1)",
                                            border: "none",
                                            borderRadius: "8px",
                                            color: "#e9edef",
                                            cursor: "pointer",
                                            fontSize: "18px",
                                            padding: "6px 10px",
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                        title="Close (Esc)"
                                    >
                                        <CloseOutlined />
                                    </button>
                                </div>
                            </div>

                            {/* Viewer body */}
                            <div
                                style={{
                                    marginTop: "56px",
                                    width: "100%",
                                    height: "calc(100vh - 56px)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                    padding: isPreviewImage
                                        ? "24px"
                                        : "0",
                                }}
                                onClick={(e) =>
                                    e.stopPropagation()
                                }
                            >
                                {isPreviewImage ? (
                                    <img
                                        src={
                                            previewAttachment.url
                                        }
                                        alt={
                                            previewAttachment.fileName
                                        }
                                        style={{
                                            maxWidth: "100%",
                                            maxHeight: "100%",
                                            objectFit: "contain",
                                            borderRadius: "6px",
                                            boxShadow:
                                                "0 8px 40px rgba(0,0,0,0.6)",
                                        }}
                                    />
                                ) : isBrowserPreviewable ? (
                                    <iframe
                                        src={
                                            previewAttachment.url
                                        }
                                        title={
                                            previewAttachment.fileName
                                        }
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            border: "none",
                                            background: "#fff",
                                        }}
                                    />
                                ) : (
                                    /* Unsupported type – show download prompt */
                                    <div
                                        style={{
                                            textAlign: "center",
                                            color: "#e9edef",
                                            padding: "40px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: "48px",
                                                marginBottom: "16px",
                                            }}
                                        >
                                            <FileImageOutlined />
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "16px",
                                                fontWeight: 600,
                                                marginBottom: "8px",
                                            }}
                                        >
                                            {
                                                previewAttachment.fileName
                                            }
                                        </div>
                                        <div
                                            style={{
                                                color: "#aebac1",
                                                marginBottom: "20px",
                                            }}
                                        >
                                            This file type cannot be
                                            previewed in the browser.
                                        </div>
                                        <a
                                            href={
                                                previewAttachment.url
                                            }
                                            download={
                                                previewAttachment.fileName ||
                                                "attachment"
                                            }
                                            style={{
                                                display:
                                                    "inline-flex",
                                                alignItems:
                                                    "center",
                                                gap: "8px",
                                                background:
                                                    "#00a884",
                                                color: "#fff",
                                                padding:
                                                    "10px 20px",
                                                borderRadius:
                                                    "8px",
                                                textDecoration:
                                                    "none",
                                                fontWeight: 600,
                                            }}
                                        >
                                            <DownloadOutlined />{" "}
                                            Download File
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}


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
                                border: `1px solid ${darkMode ? "#222d34" : "#f0f0f0"
                                    }`,
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
                                                        ? darkMode
                                                            ? "rgba(0, 168, 132, 0.2)"
                                                            : "#e6f4ff"
                                                        : darkMode
                                                            ? "#111b21"
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
                                                borderBottom: `1px solid ${darkMode
                                                    ? "#222d34"
                                                    : "#f5f5f5"
                                                    }`,
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
                                                        color: darkMode
                                                            ? "#e9edef"
                                                            : "#222",
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
                                                            color: darkMode
                                                                ? "#8696a0"
                                                                : "#888",
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
                                                            "#00a884",
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
                                            color: darkMode
                                                ? "#8696a0"
                                                : "#888",
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
                                background: darkMode
                                    ? "rgba(0, 168, 132, 0.15)"
                                    : "#f6ffed",
                                border: `1px solid ${darkMode
                                    ? "rgba(0, 168, 132, 0.4)"
                                    : "#b7eb8f"
                                    }`,
                                borderRadius:
                                    "8px",
                            }}
                        >

                            <span
                                style={{
                                    color: darkMode
                                        ? "#25d366"
                                        : "#389e0d",
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

                {/* =================================================
                WEBRTC CALL UI
            ================================================= */}

                {/* Incoming Call */}
                {
                    incomingCall && (
                        <Modal
                            open
                            footer={null}
                            closable={false}
                            centered
                            style={{ maxWidth: "92vw" }}
                        >
                            <IncomingCall
                                callType={incomingCall.callType}
                                onAccept={acceptIncomingCall}
                                onReject={rejectIncomingCall}
                            />
                        </Modal>
                    )
                }

                {/* Outgoing Call */}
                {
                    outgoingCall && (
                        <Modal
                            open
                            footer={null}
                            closable={false}
                            centered
                            style={{ maxWidth: "92vw" }}
                        >
                            <OutgoingCall
                                callType={outgoingCall.callType}
                                onCancel={() =>
                                    endCurrentCall(true)
                                }
                            />
                        </Modal>
                    )
                }

                {/* Active Audio Call */}
                {
                    activeCall &&
                    callType === "audio" && (
                        <Modal
                            open
                            footer={null}
                            closable={false}
                            centered
                            width={420}
                            style={{ maxWidth: "92vw" }}
                        >
                            <AudioCall
                                remoteStream={remoteStream}
                                microphoneEnabled={
                                    microphoneEnabled
                                }
                                cameraEnabled={
                                    cameraEnabled
                                }
                                onToggleMicrophone={() => {
                                    const next =
                                        !microphoneEnabled;

                                    callService.toggleMicrophone(
                                        next
                                    );

                                    setMicrophoneEnabled(
                                        next
                                    );
                                }}
                                onEnd={() =>
                                    endCurrentCall(true)
                                }

                                callDuration={callDuration}
                            />
                        </Modal>
                    )
                }

                {/* Active Video Call */}
                {
                    activeCall &&
                    callType === "video" && (
                        <Modal
                            open
                            footer={null}
                            closable={false}
                            centered
                            width={850}
                            style={{ maxWidth: "95vw" }}
                        >
                            <VideoCall
                                localStream={localStream}
                                remoteStream={remoteStream}
                                microphoneEnabled={
                                    microphoneEnabled
                                }
                                cameraEnabled={
                                    cameraEnabled
                                }
                                onToggleMicrophone={() => {
                                    const next =
                                        !microphoneEnabled;

                                    callService.toggleMicrophone(
                                        next
                                    );

                                    setMicrophoneEnabled(
                                        next
                                    );
                                }}
                                onToggleCamera={() => {
                                    const next =
                                        !cameraEnabled;

                                    callService.toggleCamera(
                                        next
                                    );

                                    setCameraEnabled(
                                        next
                                    );
                                }}
                                onEnd={() =>
                                    endCurrentCall(true)
                                }
                                callDuration={callDuration}
                            />
                        </Modal>
                    )
                }
            </div>
        </ConfigProvider>
    );
};


export default ChatPage;