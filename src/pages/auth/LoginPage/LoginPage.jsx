import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../../api/auth.api";
import styles from "./LoginPage.module.css";
import { setTokens } from "../../../services/token.service";

const { Title, Text } = Typography;

const LoginPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (values) => {
        try {
            setLoading(true);
            setError("");

            const response = await loginUser({
                email: values.email,
                password: values.password,
            });

            console.log("LOGIN RESPONSE:", response);



            setTokens(
                response.access_token,
                response.refresh_token
            );

            console.log("ACCESS TOKEN SAVED");
            console.log(
                "TOKEN EXISTS:",
                Boolean(localStorage.getItem("access_token"))
            );

            const accessToken =
                response.access_token || response.token;

            if (!accessToken) {
                throw new Error("Access token was not returned by the server.");
            }

            localStorage.setItem("access_token", accessToken);

            if (response.refresh_token) {
                localStorage.setItem(
                    "refresh_token",
                    response.refresh_token
                );
            }

            navigate("/chat");
        } catch (err) {
            console.error("LOGIN ERROR:", err);

            const message =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                "Login failed. Please check your credentials.";

            setError(
                Array.isArray(message)
                    ? message.map((item) => item.msg).join(", ")
                    : String(message)
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <Card className={styles.card}>
                <div className={styles.header}>
                    <Title level={2}>Welcome Back</Title>

                    <Text type="secondary">
                        Login to your realtime chat account
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

                <Form
                    layout="vertical"
                    onFinish={handleLogin}
                    autoComplete="off"
                >
                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                            {
                                required: true,
                                message: "Please enter your email",
                            },
                            {
                                type: "email",
                                message: "Please enter a valid email",
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
                                message: "Please enter your password",
                            },
                        ]}
                    >
                        <Input.Password
                            size="large"
                            prefix={<LockOutlined />}
                            placeholder="Enter your password"
                        />
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                    >
                        Login
                    </Button>
                </Form>

                <div className={styles.footer}>
                    <Text type="secondary">
                        Don't have an account?
                    </Text>

                    <Button
                        type="link"
                        onClick={() => navigate("/register")}
                    >
                        Create Account
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default LoginPage;