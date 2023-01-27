import WebSocketClient, { RawData } from 'ws';

export class WebSocketCallbacks {
    //RawData will be converted to string
    public message: (data: string) => void;
    public open: () => void;
    public close: (closeEventCode, reason) => void;
    public ping: () => void;
    public pong: () => void;
    public error: (error) => void;
}

class WebSocketUtils {
    public static subscribeSocket(
        url: string,
        callbacks: WebSocketCallbacks,
        reconnectDelay: number = 5000
    ): WebSocketClient {
        let closeInitiated = false;
        let ws: WebSocketClient;
        const initConnect = () => {
            ws = new WebSocketClient(url);

            ws.on('open', () => {
                console.log(`Connected to the Websocket Server: ${url}`);
                callbacks && callbacks.open && callbacks.open();
            });

            // handle data message. Pass the data to the call back method from user
            // It could be useful to store the original messages from server for debug
            ws.on('message', (data) => {
                callbacks &&
                    callbacks.message &&
                    callbacks.message(data.toString());
            });

            ws.on('ping', () => {
                // As ping pong is very important for maintaining the connection, log them as INFO level
                console.log(`Received PING from server ${url}`);
                callbacks && callbacks.ping && callbacks.ping();
                ws.pong();
                console.log("Responded PONG to server's PING message");
            });

            ws.on('pong', () => {
                console.log(`Received PONG from server ${url}`);
                callbacks && callbacks.pong && callbacks.pong();
            });

            ws.on('error', (err) => {
                console.log(`Received error from server ${url}`);
                callbacks && callbacks.error && callbacks.error(err);
                console.log(err);
            });

            ws.on('close', (closeEventCode, reason) => {
                if (!closeInitiated) {
                    console.error(
                        `Connection close due to ${closeEventCode}: ${reason}.`
                    );
                    closeInitiated = true;
                    setTimeout(() => {
                        console.log(`Reconnect to the server ${url}`);
                        initConnect();
                    }, reconnectDelay);
                } else {
                    closeInitiated = false;
                }
            });
        };
        console.log(`Connecting to: ${url}`);
        initConnect();
        return ws;
    }
}

export default WebSocketUtils;
