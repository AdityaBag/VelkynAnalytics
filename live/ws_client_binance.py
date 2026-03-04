import json
import time
import threading
import websocket

class BinanceWebSocketClient:
    """
    Streams real-time crypto trades from Binance.
    No API key required.
    """

    def __init__(self, symbol, queue, stop_event):
        self.symbol = symbol.lower()  # binance requires lowercase
        self.queue = queue
        self.stop_event = stop_event
        self.ws = None

    def on_message(self, ws, message):
        try:
            data = json.loads(message)

            # Binance trade message format:
            # {
            #   "p": "68500.12",   # price
            #   "T": 1708530000000 # timestamp (ms)
            # }
            price = float(data["p"])
            ts = int(data["T"])

            self.queue.put({
                "symbol": self.symbol.upper(),
                "price": price,
                "timestamp": ts
            })

        except Exception:
            pass

    def on_open(self, ws):
        pass  # no subscription message needed; URL defines stream

    def on_close(self, ws):
        pass

    def run(self):
        url = f"wss://stream.binance.com:9443/ws/{self.symbol}@trade"

        self.ws = websocket.WebSocketApp(
            url,
            on_message=self.on_message,
            on_open=self.on_open,
            on_close=self.on_close
        )

        t = threading.Thread(target=self.ws.run_forever, daemon=True)
        t.start()

        while not self.stop_event.is_set():
            time.sleep(0.1)

        try:
            self.ws.close()
        except Exception:
            pass
