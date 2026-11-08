from __future__ import annotations

import argparse
import json
import os
import random
import secrets
import subprocess
import sys
import webbrowser
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = Path(os.environ.get("HUNGRY_GEESE_ENGINE", HERE.parent / "hungry-geese")).expanduser().resolve()
MODES = ("walls", "kaggle")
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/arena.css": ("arena.css", "text/css; charset=utf-8"),
    "/arena.js": ("arena.js", "text/javascript; charset=utf-8"),
}


def simulate(seed: int, mode: str = "walls") -> dict:
    sys.path.insert(0, str(GAME))
    from kaggle_environments import make

    custom_agent = HERE / "agent.py"
    players = ["greedy"] * 4
    if custom_agent.is_file():
        players[0] = str(custom_agent)

    random.seed(seed)
    if mode == "walls":
        from wall_rules import make_wall_environment

        env = make_wall_environment()
    else:
        env = make("hungry_geese")
    steps = env.run(players)
    wall_hits = env.info.get("wall_hits", {})
    baseline = "墙版 Greedy" if mode == "walls" else "官方 Greedy"
    return {
        "seed": seed,
        "mode": mode,
        "rows": env.configuration.rows,
        "columns": env.configuration.columns,
        "hungerRate": env.configuration.hunger_rate,
        "players": ["你的 agent.py" if players[0] != "greedy" else baseline] + [baseline] * 3,
        "frames": [
            {
                "snakes": turn[0].observation.geese,
                "food": turn[0].observation.food,
                "actions": [
                    player.get("action") if index and steps[index - 1][seat].status == "ACTIVE" else None
                    for seat, player in enumerate(turn)
                ],
                "scores": [player.reward for player in turn],
                "statuses": [player.status for player in turn],
                "wallHits": wall_hits.get(index, []),
            }
            for index, turn in enumerate(steps)
        ],
    }


class ArenaHandler(BaseHTTPRequestHandler):
    def send_content(self, status: int, content_type: str, payload: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, status: int, payload: dict) -> None:
        self.send_content(status, "application/json; charset=utf-8", json.dumps(payload, ensure_ascii=False).encode())

    def do_GET(self) -> None:
        asset = ASSETS.get(self.path)
        if asset is None:
            self.send_error(404)
            return
        filename, content_type = asset
        self.send_content(200, content_type, (HERE / filename).read_bytes())

    def do_POST(self) -> None:
        if self.path != "/api/match":
            self.send_error(404)
            return
        host = f"127.0.0.1:{self.server.server_port}"
        origin = self.headers.get("Origin")
        if self.headers.get("Host") != host or origin not in (None, f"http://{host}"):
            self.send_json(403, {"error": "请从本地对战页面开局。"})
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))
            if self.headers.get_content_type() != "application/json" or not 0 < size <= 1024:
                raise ValueError
            data = json.loads(self.rfile.read(size))
            mode = data.get("mode", "walls")
            if mode not in MODES:
                raise ValueError
            seed = data.get("seed")
            if seed is None:
                seed = secrets.randbits(32)
            if type(seed) is not int or not 0 <= seed < 2**32:
                raise ValueError
        except (ValueError, AttributeError):
            self.send_json(400, {"error": "开局参数无效。"})
            return

        try:
            worker = subprocess.run(
                [sys.executable, "-B", str(HERE / "arena.py"), "--simulate", str(seed), "--mode", mode],
                cwd=HERE,
                capture_output=True,
                timeout=20,
            )
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "对局超时。检查策略文件后可以重新开局。"})
            return
        if worker.returncode:
            details = worker.stderr.decode(errors="replace").strip().splitlines()
            message = details[-1] if details else "对局进程提前退出。"
            self.send_json(500, {"error": f"开局失败。{message}"})
            return
        self.send_content(200, "application/json; charset=utf-8", worker.stdout)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--open", action="store_true")
    parser.add_argument("--simulate", type=int, help=argparse.SUPPRESS)
    parser.add_argument("--mode", choices=MODES, default="walls", help=argparse.SUPPRESS)
    args = parser.parse_args()

    if args.simulate is not None:
        with redirect_stdout(sys.stderr):
            result = simulate(args.simulate, args.mode)
        print(json.dumps(result, ensure_ascii=False))
        return

    if not (GAME / "kaggle_environments").is_dir():
        parser.exit(1, f"找不到 Hungry Geese 项目。预期位置为 {GAME}\n")

    with ThreadingHTTPServer(("127.0.0.1", args.port), ArenaHandler) as server:
        url = f"http://127.0.0.1:{server.server_port}"
        print(f"蛇阵已启动。打开 {url}", flush=True)
        if args.open:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
