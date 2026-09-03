import { useEffect, useRef } from "react";

import CallControls from "./CallControls";

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
        <div
            style={{
                padding: "32px",
                textAlign: "center",
            }}
        >
            <audio
                ref={audioRef}
                autoPlay
                playsInline
            />

            <h3>Audio Call</h3>

            <p>
                Voice call is connected.
            </p>

            <p
                style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    marginTop: "8px",
                }}
            >
                {Math.floor(callDuration / 60)
                    .toString()
                    .padStart(2, "0")}
                :
                {(callDuration % 60)
                    .toString()
                    .padStart(2, "0")}
            </p>

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
    );
};

export default AudioCall;