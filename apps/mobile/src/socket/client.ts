import { io, type Socket } from "socket.io-client";
import { apiBaseUrl } from "../api/client";

export function createLiveSocket(): Socket {
  return io(`${apiBaseUrl}/live`, {
    autoConnect: false,
    transports: ["websocket"],
  });
}
