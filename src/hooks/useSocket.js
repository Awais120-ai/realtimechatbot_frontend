import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '@/services/token.service';
import { registerSocketManager } from '@/websocket/socketManager';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const token = getAccessToken();
        const socketInstance = io(import.meta.env.VITE_WS_URL || 'http://localhost:8001', {
            auth: { token },
            autoConnect: true,
            transports: ['websocket'],
        });

        registerSocketManager(socketInstance);
        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    return useContext(SocketContext);
};

export default useSocket;
