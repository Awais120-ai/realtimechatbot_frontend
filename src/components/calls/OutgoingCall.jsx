import {
    PhoneFilled,
    VideoCameraFilled,
} from "@ant-design/icons";

import { Button } from "antd";

const OutgoingCall = ({
    callType,
    receiverName,
    onCancel,
}) => {
    return (
        <div
            style={{
                padding: 30,
                textAlign: "center",
            }}
        >
            <h2>
                {callType === "video"
                    ? "Video"
                    : "Audio"}{" "}
                Call
            </h2>

            <p>
                Calling{" "}
                {receiverName ||
                    "user"}...
            </p>

            <Button
                danger
                icon={
                    callType ===
                        "video"
                        ? (
                            <VideoCameraFilled />
                        )
                        : (
                            <PhoneFilled />
                        )
                }
                onClick={onCancel}
            >
                Cancel
            </Button>
        </div>
    );
};

export default OutgoingCall;