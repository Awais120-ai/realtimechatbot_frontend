import { useRef, useState } from "react";
import { Avatar, Button, message } from "antd";
import {
    CameraOutlined,
    UserOutlined,
} from "@ant-design/icons";

import {
    uploadProfilePicture,
    updateMyProfile,
} from "../../services/profile.service";

const AvatarUploader = ({
    avatarUrl,
    onUpdated,
}) => {
    const inputRef = useRef(null);
    const [loading, setLoading] = useState(false);

    const handleSelect = async (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            message.error(
                "Please select an image file."
            );

            event.target.value = "";
            return;
        }

        const MAX_SIZE = 5 * 1024 * 1024;

        if (file.size > MAX_SIZE) {
            message.error(
                "Profile picture cannot exceed 5 MB."
            );

            event.target.value = "";
            return;
        }

        try {
            setLoading(true);

            const uploadResponse =
                await uploadProfilePicture(file);

            const avatarPath =
                uploadResponse?.file_url ||
                uploadResponse?.url ||
                uploadResponse?.path;

            if (!avatarPath) {
                throw new Error(
                    "Server did not return image URL."
                );
            }

            await updateMyProfile({
                avatar_url: avatarPath,
            });

            message.success(
                "Profile picture updated successfully."
            );

            if (onUpdated) {
                onUpdated(avatarPath);
            }
        } catch (error) {
            console.error(
                "PROFILE PICTURE ERROR:",
                error
            );

            message.error(
                error?.response?.data?.detail ||
                error?.message ||
                "Could not update profile picture."
            );
        } finally {
            setLoading(false);

            event.target.value = "";
        }
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
            }}
        >
            <Avatar
                size={110}
                src={avatarUrl}
                icon={<UserOutlined />}
            />

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{
                    display: "none",
                }}
                onChange={handleSelect}
            />

            <Button
                icon={<CameraOutlined />}
                loading={loading}
                onClick={() =>
                    inputRef.current?.click()
                }
            >
                Change Picture
            </Button>
        </div>
    );
};

export default AvatarUploader;