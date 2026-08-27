import axiosPublic from "./axiosPublic";

export const loginUser = async ({ email, password }) => {
    const formData = new URLSearchParams();

    formData.append("username", email);
    formData.append("password", password);

    const response = await axiosPublic.post(
        "/auth/login",
        formData,
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    return response.data;
};

export const registerUser = async (userData) => {
    const response = await axiosPublic.post(
        "/auth/register",
        userData
    );

    return response.data;
};