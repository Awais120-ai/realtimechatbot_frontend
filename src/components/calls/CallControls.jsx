import {
    AudioOutlined,
    AudioMutedOutlined,
    CameraOutlined,
    CameraOutlined as CameraOffOutlined,
    PhoneFilled,
} from "@ant-design/icons";

import { Button, Space } from "antd";

const CallControls = ({
    microphoneEnabled,
    cameraEnabled,
    callType,
    onToggleMicrophone,
    onToggleCamera,
    onEnd,
}) => {
    return (
        <Space size="middle">
            <Button
                shape="circle"
                icon={
                    microphoneEnabled ? (
                        <AudioOutlined />
                    ) : (
                        <AudioMutedOutlined />
                    )
                }
                onClick={onToggleMicrophone}
            />

            {callType === "video" && (
                <Button
                    shape="circle"
                    icon={
                        <CameraOutlined />
                    }
                    onClick={onToggleCamera}
                />
            )}

            <Button
                danger
                type="primary"
                shape="circle"
                icon={<PhoneFilled />}
                onClick={onEnd}
            />
        </Space>
    );
};

export default CallControls;