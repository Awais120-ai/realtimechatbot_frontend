import {
    useEffect,
    useRef,
} from "react";

import CallControls from "./CallControls";

const VideoCall = ({
    localStream,
    remoteStream,
    microphoneEnabled,
    cameraEnabled,
    onToggleMicrophone,
    onToggleCamera,
    onEnd,
    callDuration,
}) => {
    const localVideoRef =
        useRef(null);

    const remoteVideoRef =
        useRef(null);

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject =
                localStream || null;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject =
                remoteStream || null;
        }
    }, [remoteStream]);

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                background: "#000",
            }}
        >
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                }}
            />

            <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                    position: "absolute",
                    right: 20,
                    bottom: 80,
                    width: 180,
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 10,
                }}
            />

            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    color: "#fff",
                    fontSize: "18px",
                    fontWeight: "600",
                    zIndex: 10,
                }}
            >
                {Math.floor(callDuration / 60)
                    .toString()
                    .padStart(2, "0")}
                :
                {(callDuration % 60)
                    .toString()
                    .padStart(2, "0")}
            </div>

            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <CallControls
                    microphoneEnabled={
                        microphoneEnabled
                    }
                    cameraEnabled={
                        cameraEnabled
                    }
                    callType="video"
                    onToggleMicrophone={
                        onToggleMicrophone
                    }
                    onToggleCamera={
                        onToggleCamera
                    }
                    onEnd={onEnd}
                />
            </div>
        </div>
    );
};

export default VideoCall;