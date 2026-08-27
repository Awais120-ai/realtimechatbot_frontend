export const getFileUrl = (fileUrl) => {
    if (!fileUrl) {
        return null;
    }

    if (
        fileUrl.startsWith("http://") ||
        fileUrl.startsWith("https://")
    ) {
        return fileUrl;
    }

    const apiUrl = import.meta.env.VITE_API_URL || "";

    const backendUrl = apiUrl.replace("/api/v1", "");

    return `${backendUrl}${fileUrl}`;
};