"""Tkinter control panel for the Flask LAN game server."""
import socket
import threading
import tkinter as tk
import webbrowser
from tkinter import messagebox, ttk

from werkzeug.serving import make_server

from app import ROOMS, ROOMS_LOCK, app


BACKGROUND = "#10131d"
PANEL = "#191e2c"
TEXT = "#eef1ff"
MUTED = "#929ab2"
CYAN = "#49e6e0"
GREEN = "#b7ef55"


def local_ip_addresses():
    addresses = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 80))
            addresses.add(probe.getsockname()[0])
    except OSError:
        pass
    try:
        for address in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass
    return sorted(addresses)


class ServerWindow:
    def __init__(self, root):
        self.root = root
        self.server = None
        self.server_thread = None
        self.port = tk.StringVar(value="5000")
        self.status = tk.StringVar(value="服务器未启动")
        self.address_text = tk.StringVar(value="启动后显示访问地址")

        root.title("2D大击败 · 局域网服务器")
        root.geometry("650x470")
        root.minsize(600, 430)
        root.configure(bg=BACKGROUND)
        root.protocol("WM_DELETE_WINDOW", self.close)
        self.style = ttk.Style()
        self.style.theme_use("clam")
        self.style.configure("TFrame", background=BACKGROUND)
        self.style.configure("Panel.TFrame", background=PANEL)
        self.style.configure("TLabel", background=BACKGROUND, foreground=TEXT, font=("Microsoft YaHei UI", 10))
        self.style.configure("Panel.TLabel", background=PANEL, foreground=TEXT, font=("Microsoft YaHei UI", 10))
        self.style.configure("Title.TLabel", background=BACKGROUND, foreground=CYAN, font=("Microsoft YaHei UI", 19, "bold"))

        container = ttk.Frame(root, padding=24)
        container.pack(fill="both", expand=True)
        ttk.Label(container, text="2D大击败", style="Title.TLabel").pack(anchor="w")
        ttk.Label(container, text="局域网服务器控制台", foreground=MUTED).pack(anchor="w", pady=(3, 18))

        settings = ttk.Frame(container, style="Panel.TFrame", padding=16)
        settings.pack(fill="x")
        ttk.Label(settings, text="服务端口", style="Panel.TLabel").grid(row=0, column=0, sticky="w")
        self.port_entry = tk.Entry(settings, textvariable=self.port, width=10, bg="#0c1019", fg=TEXT, insertbackground=TEXT, relief="flat")
        self.port_entry.grid(row=0, column=1, padx=(12, 20), ipady=7)
        self.start_button = tk.Button(settings, text="启动服务器", command=self.start, bg=CYAN, fg="#071114", activebackground="#8afff7", relief="flat", font=("Microsoft YaHei UI", 10, "bold"), padx=16, pady=8)
        self.start_button.grid(row=0, column=2, padx=4)
        self.stop_button = tk.Button(settings, text="停止", command=self.stop, bg="#343a4d", fg=TEXT, activebackground="#454d65", relief="flat", padx=16, pady=8, state="disabled")
        self.stop_button.grid(row=0, column=3, padx=4)
        ttk.Label(settings, textvariable=self.status, style="Panel.TLabel").grid(row=1, column=0, columnspan=4, sticky="w", pady=(12, 0))

        address_panel = ttk.Frame(container, style="Panel.TFrame", padding=16)
        address_panel.pack(fill="x", pady=14)
        ttk.Label(address_panel, text="本机访问地址", style="Panel.TLabel").pack(anchor="w")
        self.local_address = tk.Label(address_panel, text="http://127.0.0.1:5000/multiplayer", bg=PANEL, fg=CYAN, font=("Consolas", 11), anchor="w")
        self.local_address.pack(fill="x", pady=(7, 10))
        ttk.Label(address_panel, text="局域网访问地址（让同一 Wi-Fi 下的玩家打开）", style="Panel.TLabel").pack(anchor="w")
        self.lan_address = tk.Label(address_panel, textvariable=self.address_text, bg=PANEL, fg=GREEN, font=("Consolas", 11), anchor="w", justify="left")
        self.lan_address.pack(fill="x", pady=(7, 12))
        self.open_button = tk.Button(address_panel, text="在本机打开联机大厅", command=lambda: webbrowser.open(f"http://127.0.0.1:{self.port.get()}/multiplayer"), bg="#2e354b", fg=TEXT, activebackground="#414a65", relief="flat", padx=13, pady=7, state="disabled")
        self.open_button.pack(anchor="w")

        note = "所有玩家需连接同一局域网，并使用本机防火墙允许的端口访问。房间数据保存在服务器内存中，服务器关闭后清空。"
        tk.Label(container, text=note, bg=BACKGROUND, fg=MUTED, wraplength=590, justify="left", font=("Microsoft YaHei UI", 9)).pack(anchor="w", pady=(4, 10))

    def start(self):
        if self.server is not None:
            return
        try:
            port = int(self.port.get())
            if not 1 <= port <= 65535:
                raise ValueError("端口范围应为 1 到 65535。")
            server = make_server("0.0.0.0", port, app, threaded=True)
        except (ValueError, OSError) as error:
            messagebox.showerror("无法启动服务器", str(error), parent=self.root)
            return

        self.server = server
        self.port.set(str(port))
        self.server_thread = threading.Thread(target=server.serve_forever, name="lan-flask-server", daemon=True)
        self.server_thread.start()
        addresses = local_ip_addresses()
        if addresses:
            self.address_text.set("\n".join(f"http://{address}:{port}/multiplayer" for address in addresses))
        else:
            self.address_text.set(f"未能自动探测 IP；请使用本机局域网地址访问端口 {port}")
        self.local_address.config(text=f"http://127.0.0.1:{port}/multiplayer")
        self.status.set(f"运行中 · 绑定所有网络接口 · 端口 {port}")
        self.start_button.config(state="disabled")
        self.stop_button.config(state="normal")
        self.port_entry.config(state="disabled")
        self.open_button.config(state="normal")

    def stop(self):
        server = self.server
        self.server = None
        if server is not None:
            threading.Thread(target=server.shutdown, name="lan-server-shutdown", daemon=True).start()
            server.server_close()
        with ROOMS_LOCK:
            ROOMS.clear()
        self.status.set("服务器未启动")
        self.address_text.set("启动后显示访问地址")
        self.start_button.config(state="normal")
        self.stop_button.config(state="disabled")
        self.port_entry.config(state="normal")
        self.open_button.config(state="disabled")

    def close(self):
        self.stop()
        self.root.destroy()


def main():
    root = tk.Tk()
    ServerWindow(root)
    root.mainloop()


if __name__ == "__main__":
    main()
