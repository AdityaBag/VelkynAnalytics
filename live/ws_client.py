import json
import time
import threading
import websocket

class LiveWebSocketClient:
    """
    Handles a WebSocket connection for live market data.
    - Connects to provider
    - Subscribes to a ticker
    - Streams ticks into a queue
    - Stops cleanly when requested
    """

    def __init__(self, api_key, symbol, queue, stop_event):
        self.api_key = api_key
        self.symbol = symbol
        self.queue = queue
        self.stop_event = stop_event
        self.ws = None

    def on_message(self, ws, message):
        try:
            data = json.loads(message)
            if data.get("type") == "trade":
                for t in data["data"]:
                    self.queue.put({
                        "symbol": t["s"],
                        "price": float(t["p"]),
                        "timestamp": int(t["t"])
                    })
        except Exception:
            pass

    def on_open(self, ws):
        sub_msg = json.dumps({"type": "subscribe", "symbol": self.symbol})
        ws.send(sub_msg)

    def on_close(self, ws):
        pass

    def run(self):
        url = f"wss://ws.finnhub.io?token={self.api_key}"
        self.ws = websocket.WebSocketApp(
            url,
            on_message=self.on_message,
            on_open=self.on_open,
            on_close=self.on_close
        )

        # Run WebSocket in its own thread
        wst = threading.Thread(target=self.ws.run_forever, daemon=True)
        wst.start()

        # Monitor stop event
        while not self.stop_event.is_set():
            time.sleep(0.1)

        try:
            self.ws.close()
        except Exception:
            pass
