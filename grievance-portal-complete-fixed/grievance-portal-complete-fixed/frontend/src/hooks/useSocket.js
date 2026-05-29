import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

let socketInstance = null;

/**
 * useSocket — singleton Socket.IO connection with auto-reconnect
 * Joins user room and authority room on connect
 */
export function useSocket() {
  const { user, isAuthenticated, token } = useAuthStore();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Reuse existing singleton
    if (socketInstance?.connected) {
      socketRef.current = socketInstance;
      return;
    }

    const socket = io(import.meta.env.VITE_SOCKET_URL || '', {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🟢 Socket connected:', socket.id);

      // Join personal notification room
      if (user?.id) socket.emit('join_user', user.id);

      // Join authority dashboard room
      if (user?.authorityId) socket.emit('join_authority', user.authorityId);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket error:', err.message);
    });

    // Global notification events
    socket.on('status_updated', (data) => {
      toast.success(`Complaint ${data.complaintId}: Status updated to ${data.status}`, {
        icon: '📋',
        duration: 5000,
      });
    });

    socket.on('escalation_alert', (data) => {
      toast.error(`⚡ Escalation Alert: ${data.message}`, {
        duration: 8000,
        id: `escalation-${data.complaintId}`,
      });
    });

    socket.on('new_complaint_assigned', (data) => {
      toast(`📥 New complaint assigned: ${data.complaintId}`, {
        duration: 6000,
        icon: '🔔',
      });
    });

    socketInstance = socket;
    socketRef.current = socket;

    return () => {
      // Don't disconnect on component unmount — keep singleton alive
      // Only clean up listeners specific to this hook instance
    };
  }, [isAuthenticated, token, user?.id, user?.authorityId]);

  const joinComplaintRoom = useCallback((complaintId) => {
    socketRef.current?.emit('join_complaint', complaintId);
  }, []);

  const leaveComplaintRoom = useCallback((complaintId) => {
    socketRef.current?.emit('leave_complaint', complaintId);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    joinComplaintRoom,
    leaveComplaintRoom,
    on,
  };
}

export default useSocket;
