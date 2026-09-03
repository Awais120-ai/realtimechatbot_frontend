import {
    PhoneFilled,
    VideoCameraFilled,
} from "@ant-design/icons";

import { Button, Space } from "antd";

const IncomingCall = ({
    callType,
    callerName,
    onAccept,
    onReject,
}) => {
    return (
        <div
            style={{
                padding: 30,
                textAlign: "center",
            }}
        >
            <h2>
                Incoming{" "}
                {callType === "video"
                    ? "Video"
                    : "Audio"}{" "}
                Call
            </h2>

            <p>
                {callerName ||
                    "Someone"}{" "}
                is calling you...
            </p>

            <Space>
                <Button
                    danger
                    onClick={onReject}
                >
                    Reject
                </Button>

                <Button
                    type="primary"
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
                    onClick={onAccept}
                >
                    Accept
                </Button>
            </Space>
        </div>
    );
};

export default IncomingCall;