import { useEffect, useRef } from "react";
import { PhoneFilled } from "@ant-design/icons";
import CallControls from "./CallControls";
import styles from "./AudioCall.module.css";

const AudioCall = ({
    remoteStream,
    microphoneEnabled,
    cameraEnabled,
    onToggleMicrophone,
    onToggleCamera,
    onEnd,
    callDuration,
}) => {
    const audioRef = useRef(null);

    useEffect(() => {
        if (!audioRef.current) {
            return;
        }

        audioRef.current.srcObject =
            remoteStream || null;
    }, [remoteStream]);

    return (
        <div className={styles.container}>
            <audio
                ref={audioRef}
                autoPlay
                playsInline
            />

            <div className={styles.avatarPulse}>
                <PhoneFilled />
            </div>

            <h3 className={styles.title}>Audio Call</h3>

            <p className={styles.status}>
                Voice call is connected.
            </p>

            <p className={styles.duration}>
                {Math.floor(callDuration / 60)
                    .toString()
                    .padStart(2, "0")}
                :
                {(callDuration % 60)
                    .toString()
                    .padStart(2, "0")}
            </p>

            <div className={styles.controlsWrapper}>
                <CallControls
                    microphoneEnabled={
                        microphoneEnabled
                    }
                    cameraEnabled={
                        cameraEnabled
                    }
                    callType="audio"
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

export default AudioCall;