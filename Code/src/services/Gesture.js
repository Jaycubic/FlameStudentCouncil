import { io } from "socket.io-client";

const socket = io('https://flamestudentcouncil.in:5050');

const emitGrabGesture = () => {
  console.log('Emitting grabGesture event with timestamp:', Date.now());
  socket.emit('grabGesture', { timestamp: Date.now() });
};

export { emitGrabGesture };
