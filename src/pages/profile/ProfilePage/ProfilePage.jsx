import {
    useEffect,
    useState,
} from "react";
import { getFileUrl } from "../../../utils/url.util";
import {
    Avatar,
    Button,
    Card,
    Divider,
    Form,
    Input,
    Typography,
    Upload,
    ConfigProvider,
    theme,
    message as antMessage,
} from "antd";

import {
    CameraOutlined,
    LockOutlined,
    LogoutOutlined,
    UserOutlined,
    SoundOutlined,
} from "@ant-design/icons";

import {
    getNotificationSounds,
    getSelectedNotificationSound,
    setSelectedNotificationSound,
    testNotificationSound,
} from "../../../services/notificationSound.service";

import {
    useNavigate,
} from "react-router-dom";

import {
    getMyProfile,
    updateProfile,
    changePassword,
    uploadProfilePicture,
} from "../../../api/user.api";

import {
    clearTokens,
} from "../../../services/token.service";

import styles from "./ProfilePage.module.css";


const {
    Title,
    Text,
} = Typography;


const ProfilePage = () => {

    const navigate =
        useNavigate();

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [uploadingPhoto, setUploadingPhoto] =
        useState(false);

    const [profile, setProfile] =
        useState(null);

    const [selectedNotificationSound, setSelectedNotificationSoundState] =
        useState(() => {
            return getSelectedNotificationSound();
        });


    const [username, setUsername] =
        useState("");


    const [currentPassword, setCurrentPassword] =
        useState("");

    const [newPassword, setNewPassword] =
        useState("");

    const [confirmPassword, setConfirmPassword] =
        useState("");


    // ====================================================
    // LOAD PROFILE
    // ====================================================

    useEffect(() => {

        const loadProfile = async () => {

            try {

                setLoading(true);

                const data =
                    await getMyProfile();

                setProfile(data);

                setUsername(
                    data.username || ""
                );

            } catch (error) {

                console.error(
                    "PROFILE LOAD ERROR:",
                    error
                );

                antMessage.error(
                    error?.response?.data?.detail ||
                    "Unable to load profile."
                );

            } finally {

                setLoading(false);

            }
        };


        loadProfile();

    }, []);


    // ====================================================
    // UPDATE USERNAME
    // ====================================================

    const handleSaveUsername =
        async () => {

            const cleanUsername =
                username.trim();

            if (!cleanUsername) {

                antMessage.warning(
                    "Username cannot be empty."
                );

                return;
            }

            try {

                setSaving(true);

                const updated =
                    await updateProfile({
                        username:
                            cleanUsername,
                    });

                setProfile(updated);

                setUsername(
                    updated.username
                );

                antMessage.success(
                    "Username updated successfully."
                );

            } catch (error) {

                console.error(
                    "PROFILE UPDATE ERROR:",
                    error
                );

                antMessage.error(
                    error?.response?.data?.detail ||
                    "Unable to update username."
                );

            } finally {

                setSaving(false);

            }
        };


    // ====================================================
    // CHANGE PASSWORD
    // ====================================================

    const handleChangePassword =
        async () => {

            if (
                !currentPassword ||
                !newPassword ||
                !confirmPassword
            ) {

                antMessage.warning(
                    "Please fill all password fields."
                );

                return;
            }


            if (
                newPassword !==
                confirmPassword
            ) {

                antMessage.error(
                    "New passwords do not match."
                );

                return;
            }


            if (
                newPassword.length < 6
            ) {

                antMessage.warning(
                    "New password must be at least 6 characters."
                );

                return;
            }


            try {

                setSaving(true);

                await changePassword({
                    current_password:
                        currentPassword,

                    new_password:
                        newPassword,
                });


                setCurrentPassword("");

                setNewPassword("");

                setConfirmPassword("");


                antMessage.success(
                    "Password changed successfully."
                );

            } catch (error) {

                console.error(
                    "PASSWORD CHANGE ERROR:",
                    error
                );

                antMessage.error(
                    error?.response?.data?.detail ||
                    "Unable to change password."
                );

            } finally {

                setSaving(false);

            }
        };


    // ====================================================
    // PROFILE PICTURE
    // ====================================================

    const handlePhotoChange = async ({ file }) => {
        console.log("PROFILE PHOTO HANDLER FIRED:", file);

        const selectedFile =
            file?.originFileObj || file;

        if (!selectedFile) {
            return;
        }

        if (!selectedFile.type?.startsWith("image/")) {
            antMessage.error(
                "Please select an image."
            );
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            antMessage.error(
                "Image must be smaller than 5 MB."
            );
            return;
        }

        try {

            setUploadingPhoto(true);

            const updated =
                await uploadProfilePicture(
                    selectedFile
                );

            if (!updated) {
                throw new Error(
                    "Profile picture upload returned no data."
                );
            }

            setProfile(updated);

            console.log("UPDATED PROFILE AFTER UPLOAD:", updated);

            antMessage.success(
                "Profile picture updated."
            );

        } catch (error) {

            console.error(
                "PROFILE PHOTO ERROR:",
                error
            );

            antMessage.error(
                error?.response?.data?.detail ||
                error?.message ||
                "Unable to upload profile picture."
            );

        } finally {

            setUploadingPhoto(false);

        }
    };



    const handleNotificationSoundChange = (
        event
    ) => {

        const soundKey =
            event.target.value;

        setSelectedNotificationSoundState(
            soundKey
        );

        setSelectedNotificationSound(
            soundKey
        );

        antMessage.success(
            "Notification sound updated."
        );
    };


    // ====================================================
    // LOGOUT
    // ====================================================

    const handleLogout = () => {

        clearTokens();

        navigate(
            "/login",
            {
                replace: true,
            }
        );
    };


    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("chat-theme") === "dark";
    });

    useEffect(() => {
        const handleStorage = () => {
            setDarkMode(localStorage.getItem("chat-theme") === "dark");
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

    useEffect(() => {
        document.body.classList.toggle("dark-mode", Boolean(darkMode));
        document.documentElement.setAttribute(
            "data-theme",
            darkMode ? "dark" : "light"
        );
    }, [darkMode]);

    const themeConfig = {
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
            colorPrimary: "#00a884",
            colorLink: darkMode ? "#00a884" : "#008069",
            borderRadius: 8,
            colorBgContainer: darkMode ? "#111b21" : "#ffffff",
            colorBgElevated: darkMode ? "#202c33" : "#ffffff",
            colorBorder: darkMode ? "#2a3942" : "#d9d9d9",
            colorText: darkMode ? "#e9edef" : "#111b21",
            colorTextSecondary: darkMode ? "#8696a0" : "#667781",
            colorTextHeading: darkMode ? "#e9edef" : "#111b21",
        },
    };

    if (loading) {
        return (
            <ConfigProvider theme={themeConfig}>
                <div
                    className={`${styles.page} ${darkMode ? styles.darkMode : ""
                        }`}
                >
                    <Card className={styles.card}>
                        Loading profile...
                    </Card>
                </div>
            </ConfigProvider>
        );
    }

    console.log(
        "CURRENT PROFILE PICTURE:",
        profile?.profile_picture
    );

    return (
        <ConfigProvider theme={themeConfig}>
            <div
                className={`${styles.page} ${darkMode ? styles.darkMode : ""
                    }`}
            >
                <Card className={styles.card}>

                    {/* HEADER */}

                    <div
                        className={
                            styles.header
                        }
                    >

                        <Button
                            type="link"
                            className={styles.backBtn}
                            onClick={() =>
                                navigate("/chat")
                            }
                        >
                            ← Back to Chat
                        </Button>

                    </div>


                    <div
                        className={
                            styles.titleSection
                        }
                    >

                        <Title level={2}>
                            Profile Settings
                        </Title>

                        <Text type="secondary">
                            Manage your account and profile
                        </Text>

                    </div>


                    {/* PROFILE PHOTO */}

                    <div
                        className={
                            styles.photoSection
                        }
                    >

                        <Avatar
                            key={profile?.profile_picture || "default-avatar"}
                            size={110}
                            src={
                                profile?.profile_picture
                                    ? `http://192.168.18.83:8001${profile.profile_picture}`
                                    : undefined
                            }
                            icon={
                                <UserOutlined />
                            }
                        />

                        <Upload
                            accept="image/*"
                            showUploadList={false}
                            customRequest={handlePhotoChange}
                        >

                            <Button
                                icon={
                                    <CameraOutlined />
                                }
                                loading={uploadingPhoto}
                            >
                                Change Profile Picture
                            </Button>

                        </Upload>

                    </div>


                    <Divider />


                    {/* USERNAME */}

                    <div
                        className={
                            styles.section
                        }
                    >

                        <Title level={4}>
                            Account Information
                        </Title>


                        <Form
                            layout="vertical"
                        >

                            <Form.Item
                                label="Email"
                            >

                                <Input
                                    value={
                                        profile?.email ||
                                        ""
                                    }
                                    disabled
                                    size="large"
                                />

                            </Form.Item>


                            <Form.Item
                                label="Username"
                            >

                                <Input
                                    value={
                                        username
                                    }
                                    onChange={(event) =>
                                        setUsername(
                                            event.target.value
                                        )
                                    }
                                    prefix={
                                        <UserOutlined />
                                    }
                                    size="large"
                                />

                            </Form.Item>


                            <Button
                                type="primary"
                                loading={saving}
                                onClick={
                                    handleSaveUsername
                                }
                            >
                                Save Username
                            </Button>

                        </Form>

                    </div>


                    <Divider />


                    {/* PASSWORD */}

                    <div
                        className={
                            styles.section
                        }
                    >

                        <Title level={4}>
                            Change Password
                        </Title>


                        <Form
                            layout="vertical"
                        >

                            <Form.Item
                                label="Current Password"
                            >

                                <Input.Password
                                    size="large"
                                    prefix={
                                        <LockOutlined />
                                    }
                                    value={
                                        currentPassword
                                    }
                                    onChange={(event) =>
                                        setCurrentPassword(
                                            event.target.value
                                        )
                                    }
                                />

                            </Form.Item>


                            <Form.Item
                                label="New Password"
                            >

                                <Input.Password
                                    size="large"
                                    prefix={
                                        <LockOutlined />
                                    }
                                    value={
                                        newPassword
                                    }
                                    onChange={(event) =>
                                        setNewPassword(
                                            event.target.value
                                        )
                                    }
                                />

                            </Form.Item>


                            <Form.Item
                                label="Confirm New Password"
                            >

                                <Input.Password
                                    size="large"
                                    prefix={
                                        <LockOutlined />
                                    }
                                    value={
                                        confirmPassword
                                    }
                                    onChange={(event) =>
                                        setConfirmPassword(
                                            event.target.value
                                        )
                                    }
                                />

                            </Form.Item>


                            <Button
                                type="primary"
                                loading={saving}
                                onClick={
                                    handleChangePassword
                                }
                            >
                                Change Password
                            </Button>

                        </Form>

                    </div>


                    <Divider />

                    {/* =====================================================
    NOTIFICATION SETTINGS
===================================================== */}

                    <div
                        className={
                            styles.section
                        }
                    >

                        <Title level={4}>
                            Notification Settings
                        </Title>

                        <Text type="secondary">
                            Choose the sound used for
                            new messages and incoming calls.
                        </Text>

                        <div
                            style={{
                                marginTop: 16,
                            }}
                        >

                            <select
                                value={
                                    selectedNotificationSound
                                }
                                onChange={
                                    handleNotificationSoundChange
                                }
                                className={styles.soundSelect}
                            >

                                <option value="notification">
                                    Notification Sound
                                </option>

                                <option value="message">
                                    Message Sound
                                </option>

                                <option value="whatsapp">
                                    Whatsapp Sound
                                </option>

                                <option value="cartoon">
                                    cartoon Sound
                                </option>

                                <option value="Crowd">
                                    Crowd Sound
                                </option>

                                <option value="paresh">
                                    paresh-rawal
                                </option>

                            </select>

                        </div>


                        <Button
                            icon={
                                <SoundOutlined />
                            }
                            style={{
                                marginTop: 12,
                            }}
                            onClick={
                                testNotificationSound
                            }
                        >
                            Test Sound
                        </Button>

                    </div>


                    {/* LOGOUT */}

                    <Button
                        danger
                        block
                        size="large"
                        icon={
                            <LogoutOutlined />
                        }
                        onClick={
                            handleLogout
                        }
                    >
                        Logout
                    </Button>

                </Card>

            </div>
        </ConfigProvider>
    );
};


export default ProfilePage;