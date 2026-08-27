import axiosInstance from "../../../api/axiosInstance";

export const getMyProfile = async () => {
    const response = await axiosInstance.get("/auth/me");
    return response.data;
};

export const updateMyProfile = async (data) => {
    const response = await axiosInstance.put(
        "/auth/profile",
        data
    );

    return response.data;
};

export const uploadProfilePicture = async (file) => {
    const formData = new FormData();

    formData.append("file", file);

    const response = await axiosInstance.post(
        "/chat/upload",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );

    return response.data;
};

export const changePassword = async ({
    current_password,
    new_password,
}) => {
    const response = await axiosInstance.put(
        "/auth/change-password",
        {
            current_password,
            new_password,
        }
    );

    return response.data;
};