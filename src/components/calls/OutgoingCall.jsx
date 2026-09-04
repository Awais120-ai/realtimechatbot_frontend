import {
    PhoneFilled,
    VideoCameraFilled,
} from "@ant-design/icons";

import { Button } from "antd";
import styles from "./OutgoingCall.module.css";

const OutgoingCall = ({
    callType,
    receiverName,
    onCancel,
}) => {
    return (
        <div className={styles.container}>
            <div className={styles.avatarPulse}>
                {callType === "video" ? (
                    <VideoCameraFilled />
                ) : (
                    <PhoneFilled />
                )}
            </div>

            <h2 className={styles.title}>
                {callType === "video"
                    ? "Video"
                    : "Audio"}{" "}
                Call
            </h2>

            <p className={styles.receiver}>
                Calling{" "}
                {receiverName || "user"}...
            </p>

            <Button
                danger
                type="primary"
                className={styles.cancelBtn}
                icon={
                    callType === "video" ? (
                        <VideoCameraFilled />
                    ) : (
                        <PhoneFilled />
                    )
                }
                onClick={onCancel}
            >
                Cancel Call
            </Button>
        </div>
    );
};

export default OutgoingCall;