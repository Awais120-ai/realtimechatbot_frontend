import {
    useEffect,
    useRef,
} from "react";

import CallControls from "./CallControls";
import styles from "./VideoCall.module.css";

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
        <div className={styles.videoContainer}>
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={styles.remoteVideo}
            />

            <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={styles.localVideo}
            />

            <div className={styles.durationBadge}>
                {Math.floor(callDuration / 60)
                    .toString()
                    .padStart(2, "0")}
                :
                {(callDuration % 60)
                    .toString()
                    .padStart(2, "0")}
            </div>

            <div className={styles.controlsOverlay}>
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