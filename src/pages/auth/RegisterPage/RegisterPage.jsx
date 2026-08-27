import { useState } from "react";
import {
    Alert,
    Button,
    Card,
    Form,
    Input,
    Typography,
} from "antd";
import {
    LockOutlined,
    MailOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../../../api/auth.api";
import styles from "./RegisterPage.module.css";

const { Title, Text } = Typography;

const RegisterPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleRegister = async (values) => {
        try {
            setLoading(true);
            setError("");
            setSuccess("");

            await registerUser({
                username: values.username.trim(),
                email: values.email.trim(),
                password: values.password,
            });

            setSuccess(
                "Account created successfully. Please login."
            );

            setTimeout(() => {
                navigate("/login", { replace: true });
            }, 1000);
        } catch (err) {
            console.error("REGISTER ERROR:", err);

            const detail = err?.response?.data?.detail;

            let message =
                err?.response?.data?.message ||
                err?.message ||
                "Registration failed. Please try again.";

            if (Array.isArray(detail)) {
                message = detail
                    .map((item) => item.msg)
                    .join(", ");
            } else if (detail) {
                message = detail;
            }

            setError(String(message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <Card className={styles.card}>
                <div className={styles.header}>
                    <Title level={2}>
                        Create Account
                    </Title>

                    <Text type="secondary">
                        Create your realtime chat account
                    </Text>
                </div>

                {error && (
                    <Alert
                        title={error}
                        type="error"
                        showIcon
                        closable
                        className={styles.alert}
                        onClose={() => setError("")}
                    />
                )}

                {success && (
                    <Alert
                        title={success}
                        type="success"
                        showIcon
                        className={styles.alert}
                    />
                )}

                <Form
                    layout="vertical"
                    onFinish={handleRegister}
                    autoComplete="off"
                >
                    <Form.Item
                        label="Username"
                        name="username"
                        rules={[
                            {
                                required: true,
                                message:
                                    "Please enter your username",
                            },
                            {
                                min: 3,
                                message:
                                    "Username must be at least 3 characters",
                            },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<UserOutlined />}
                            placeholder="Enter your username"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                            {
                                required: true,
                                message:
                                    "Please enter your email",
                            },
                            {
                                type: "email",
                                message:
                                    "Please enter a valid email",
                            },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<MailOutlined />}
                            placeholder="Enter your email"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[
                            {
                                required: true,
                                message:
                                    "Please enter your password",
                            },
                            {
                                min: 6,
                                message:
                                    "Password must be at least 6 characters",
                            },
                        ]}
                    >
                        <Input.Password
                            size="large"
                            prefix={<LockOutlined />}
                            placeholder="Enter your password"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Confirm Password"
                        name="confirmPassword"
                        dependencies={["password"]}
                        rules={[
                            {
                                required: true,
                                message:
                                    "Please confirm your password",
                            },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (
                                        !value ||
                                        getFieldValue(
                                            "password"
                                        ) === value
                                    ) {
                                        return Promise.resolve();
                                    }

                                    return Promise.reject(
                                        new Error(
                                            "Passwords do not match"
                                        )
                                    );
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            size="large"
                            prefix={<LockOutlined />}
                            placeholder="Confirm your password"
                        />
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                    >
                        Create Account
                    </Button>
                </Form>

                <div className={styles.footer}>
                    <Text type="secondary">
                        Already have an account?
                    </Text>

                    <Button
                        type="link"
                        onClick={() =>
                            navigate("/login")
                        }
                    >
                        Login
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default RegisterPage;