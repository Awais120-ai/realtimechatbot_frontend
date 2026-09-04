import {
    AudioOutlined,
    AudioMutedOutlined,
    CameraOutlined,
    PhoneFilled,
} from "@ant-design/icons";

import { Button } from "antd";
import styles from "./CallControls.module.css";

const CallControls = ({
    microphoneEnabled,
    cameraEnabled,
    callType,
    onToggleMicrophone,
    onToggleCamera,
    onEnd,
}) => {
    const isVideo = callType === "video";

    return (
        <div className={`${styles.controlsContainer} ${isVideo ? "videoCallControls" : ""}`}>
            <Button
                shape="circle"
                className={`${styles.controlBtn} ${!isVideo ? styles.controlBtnLight : ""} ${
                    !microphoneEnabled ? styles.mutedBtn : ""
                }`}
                icon={
                    microphoneEnabled ? (
                        <AudioOutlined />
                    ) : (
                        <AudioMutedOutlined />
                    )
                }
                onClick={onToggleMicrophone}
                aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
            />

            {callType === "video" && (
                <Button
                    shape="circle"
                    className={`${styles.controlBtn} ${
                        !cameraEnabled ? styles.mutedBtn : ""
                    }`}
                    icon={<CameraOutlined />}
                    onClick={onToggleCamera}
                    aria-label={cameraEnabled ? "Turn off camera" : "Turn on camera"}
                />
            )}

            <Button
                danger
                type="primary"
                shape="circle"
                className={styles.endBtn}
                icon={<PhoneFilled style={{ transform: "rotate(135deg)" }} />}
                onClick={onEnd}
                aria-label="End call"
            />
        </div>
    );
};

export default CallControls;