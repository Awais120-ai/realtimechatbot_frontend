import { Navigate } from "react-router-dom";
import ChatPage from "../pages/chat/ChatPage/ChatPage";

const chatRoutes = [
    {
        path: "/chat",
        element: <ChatPage />,
    },
];

export default chatRoutes;