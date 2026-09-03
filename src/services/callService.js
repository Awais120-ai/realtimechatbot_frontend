// =====================================================
// WEBRTC CALL SERVICE
// =====================================================

class CallService {
    constructor() {
        this.peerConnection = null;

        this.localStream = null;
        this.remoteStream = null;

        this.pendingIceCandidates = [];

        this.onRemoteStream = null;
        this.onConnectionStateChange = null;
        this.onIceCandidate = null;
    }

    // =====================================================
    // WEBRTC CONFIG
    // =====================================================

    getConfiguration() {
        return {
            iceServers: [
                {
                    urls: "stun:stun.relay.metered.ca:80",
                },
                {
                    urls: "turn:standard.relay.metered.ca:80",
                    username: "676d481fd4ee788a0d1bb399",
                    credential: "FXAowSqz9SN+JVZ2",
                },
                {
                    urls: "turn:standard.relay.metered.ca:80?transport=tcp",
                    username: "676d481fd4ee788a0d1bb399",
                    credential: "FXAowSqz9SN+JVZ2",
                },
                {
                    urls: "turn:standard.relay.metered.ca:443",
                    username: "676d481fd4ee788a0d1bb399",
                    credential: "FXAowSqz9SN+JVZ2",
                },
                {
                    urls: "turns:standard.relay.metered.ca:443?transport=tcp",
                    username: "676d481fd4ee788a0d1bb399",
                    credential: "FXAowSqz9SN+JVZ2",
                },
            ],
        };
    }
    // =====================================================
    // CREATE PEER CONNECTION
    // =====================================================

    createPeerConnection() {
        if (
            this.peerConnection &&
            this.peerConnection.signalingState !== "closed"
        ) {
            return this.peerConnection;
        }

        // Old/closed peer connection ko completely clear karo
        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            } catch (error) {
                console.debug(
                    "Old peer connection was already closed."
                );
            }

            this.peerConnection = null;
        }

        this.peerConnection =
            new RTCPeerConnection(
                this.getConfiguration()
            );

        this.remoteStream =
            new MediaStream();

        // -------------------------------------------------
        // REMOTE TRACK
        // -------------------------------------------------

        this.peerConnection.ontrack = (
            event
        ) => {
            event.streams?.[0]
                ?.getTracks()
                .forEach((track) => {
                    if (
                        !this.remoteStream
                            .getTracks()
                            .some(
                                (existing) =>
                                    existing.id ===
                                    track.id
                            )
                    ) {
                        this.remoteStream.addTrack(
                            track
                        );
                    }
                });

            if (this.onRemoteStream) {
                this.onRemoteStream(
                    this.remoteStream
                );
            }
        };

        // -------------------------------------------------
        // ICE
        // -------------------------------------------------

        this.peerConnection.onicecandidate = (
            event
        ) => {
            if (
                event.candidate &&
                this.onIceCandidate
            ) {
                this.onIceCandidate(
                    event.candidate
                );
            }
        };

        // -------------------------------------------------
        // CONNECTION STATE
        // -------------------------------------------------

        this.peerConnection.onconnectionstatechange =
            () => {
                const state =
                    this.peerConnection
                        ?.connectionState;

                console.log(
                    "WebRTC connection state:",
                    state
                );

                if (
                    this.onConnectionStateChange
                ) {
                    this.onConnectionStateChange(
                        state
                    );
                }
            };

        return this.peerConnection;
    }

    // =====================================================
    // GET LOCAL MEDIA
    // =====================================================

    async getLocalStream(video = false) {

        if (this.localStream) {
            const hasVideoTrack =
                this.localStream.getVideoTracks().length > 0;

            if (!video || hasVideoTrack) {
                return this.localStream;
            }
            this.localStream
                .getTracks()
                .forEach((track) => {
                    track.stop();
                });

            this.localStream = null;
        }

        this.localStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: video,
            });

        console.log(
            "LOCAL STREAM:",
            this.localStream
        );

        console.log(
            "CAMERA VIDEO TRACKS:",
            this.localStream.getVideoTracks()
        );

        return this.localStream;
    }

    // =====================================================
    // ADD LOCAL TRACKS
    // =====================================================

    addLocalTracks() {
        if (
            !this.peerConnection ||
            !this.localStream
        ) {
            return;
        }

        const existingTrackIds =
            this.peerConnection
                .getSenders()
                .map((sender) => sender.track?.id)
                .filter(Boolean);

        this.localStream
            .getTracks()
            .forEach((track) => {
                if (
                    existingTrackIds.includes(track.id)
                ) {
                    return;
                }

                this.peerConnection.addTrack(
                    track,
                    this.localStream
                );
            });
    }

    // =====================================================
    // CREATE OFFER
    // =====================================================

    async createOffer() {
        if (!this.peerConnection) {
            this.createPeerConnection();
        }

        const offer =
            await this.peerConnection.createOffer();

        await this.peerConnection.setLocalDescription(
            offer
        );

        return offer;
    }

    // =====================================================
    // SET REMOTE OFFER
    // =====================================================

    async setRemoteOffer(offer) {
        if (!this.peerConnection) {
            this.createPeerConnection();
        }

        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );

        await this.flushPendingIceCandidates();
    }

    // =====================================================
    // CREATE ANSWER
    // =====================================================

    async createAnswer() {
        if (!this.peerConnection) {
            this.createPeerConnection();
        }

        const answer =
            await this.peerConnection.createAnswer();

        await this.peerConnection.setLocalDescription(
            answer
        );

        return answer;
    }

    // =====================================================
    // SET REMOTE ANSWER
    // =====================================================

    async setRemoteAnswer(answer) {
        if (!this.peerConnection) {
            return;
        }

        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
        );

        await this.flushPendingIceCandidates();
    }

    // =====================================================
    // ADD ICE CANDIDATE
    // =====================================================

    async addIceCandidate(candidate) {
        if (!candidate) {
            return;
        }

        if (!this.peerConnection) {
            this.createPeerConnection();
        }

        // Remote description not ready yet
        if (
            !this.peerConnection.remoteDescription
        ) {
            this.pendingIceCandidates.push(
                candidate
            );

            return;
        }

        try {
            await this.peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } catch (error) {
            console.error(
                "Failed to add ICE candidate:",
                error
            );
        }
    }

    // =====================================================
    // FLUSH ICE QUEUE
    // =====================================================

    async flushPendingIceCandidates() {
        if (
            !this.peerConnection ||
            !this.peerConnection.remoteDescription
        ) {
            return;
        }

        const candidates = [
            ...this.pendingIceCandidates,
        ];

        this.pendingIceCandidates = [];

        for (const candidate of candidates) {
            try {
                await this.peerConnection.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
            } catch (error) {
                console.error(
                    "Failed to flush ICE candidate:",
                    error
                );
            }
        }
    }

    // =====================================================
    // MICROPHONE
    // =====================================================

    toggleMicrophone(enabled) {
        if (!this.localStream) {
            return false;
        }

        this.localStream
            .getAudioTracks()
            .forEach((track) => {
                track.enabled = enabled;
            });

        return enabled;
    }

    // =====================================================
    // CAMERA
    // =====================================================

    toggleCamera(enabled) {
        if (!this.localStream) {
            return false;
        }

        this.localStream
            .getVideoTracks()
            .forEach((track) => {
                track.enabled = enabled;
            });

        return enabled;
    }

    // =====================================================
    // END CALL
    // =====================================================

    endCall() {
        if (this.localStream) {
            this.localStream
                .getTracks()
                .forEach((track) => {
                    track.stop();
                });

            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.ontrack = null;
            this.peerConnection.onicecandidate = null;
            this.peerConnection.onconnectionstatechange =
                null;

            this.peerConnection.close();

            this.peerConnection = null;
        }

        this.remoteStream = null;
        this.pendingIceCandidates = [];

        this.onRemoteStream = null;
        this.onConnectionStateChange = null;
        this.onIceCandidate = null;
    }
}

const callService = new CallService();

export default callService;