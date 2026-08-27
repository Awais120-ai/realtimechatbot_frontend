import axiosPrivate from "./axiosPrivate";


// ========================================================
// GET CURRENT USER PROFILE
// ========================================================

export const getMyProfile = async () => {
    const response = await axiosPrivate.get(
        "/auth/me"
    );

    return response.data;
};


// ========================================================
// UPDATE PROFILE
// ========================================================

export const updateProfile = async (data) => {
    const response = await axiosPrivate.put(
        "/auth/profile",
        data
    );

    return response.data;
};


// ========================================================
// CHANGE PASSWORD
// ========================================================

export const changePassword = async ({
    current_password,
    new_password,
}) => {

    const response = await axiosPrivate.put(
        "/auth/change-password",
        {
            current_password,
            new_password,
        }
    );

    return response.data;
};


// ========================================================
// UPLOAD PROFILE PICTURE
// ========================================================

export const uploadProfilePicture = async (
    file
) => {

    const formData = new FormData();

    formData.append(
        "file",
        file
    );

    const response =
        await axiosPrivate.post(
            "/auth/profile-picture",
            formData,
            {
                headers: {
                    "Content-Type":
                        "multipart/form-data",
                },
            }
        );

    return response.data;
};