import {
    PhoneFilled,
    VideoCameraFilled,
} from "@ant-design/icons";

import { Button } from "antd";
import styles from "./IncomingCall.module.css";

const IncomingCall = ({
    callType,
    callerName,
    onAccept,
    onReject,
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
                Incoming{" "}
                {callType === "video"
                    ? "Video"
                    : "Audio"}{" "}
                Call
            </h2>

            <p className={styles.caller}>
                {callerName || "Someone"} is calling you...
            </p>

            <div className={styles.actions}>
                <Button
                    danger
                    className={styles.rejectBtn}
                    onClick={onReject}
                >
                    Reject
                </Button>

                <Button
                    type="primary"
                    className={styles.acceptBtn}
                    icon={
                        callType === "video" ? (
                            <VideoCameraFilled />
                        ) : (
                            <PhoneFilled />
                        )
                    }
                    onClick={onAccept}
                >
                    Accept
                </Button>
            </div>
        </div>
    );
};

export default IncomingCall;