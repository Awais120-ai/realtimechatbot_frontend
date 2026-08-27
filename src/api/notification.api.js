import axiosPrivate from "./axiosPrivate";

export const getNotifications = async ({
    skip = 0,
    limit = 50,
    unreadOnly = false,
} = {}) => {
    const response = await axiosPrivate.get(
        "/notifications/",
        {
            params: {
                skip,
                limit,
                unread_only: unreadOnly,
            },
        }
    );

    return response.data;
};

export const getUnreadNotificationCount = async () => {
    const response = await axiosPrivate.get(
        "/notifications/unread-count"
    );

    return response.data;
};

export const markNotificationAsRead = async (
    notificationId
) => {
    const response = await axiosPrivate.put(
        `/notifications/${notificationId}/read`
    );

    return response.data;
};

export const markAllNotificationsAsRead = async () => {
    const response = await axiosPrivate.put(
        "/notifications/read-all"
    );

    return response.data;
};

export const deleteNotification = async (
    notificationId
) => {
    const response = await axiosPrivate.delete(
        `/notifications/${notificationId}`
    );

    return response.data;
};