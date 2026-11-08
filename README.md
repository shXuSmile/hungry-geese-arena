# 贪吃蛇策略实验场

用浏览器观看四条蛇对局，逐回合比较策略。棋盘上的编号与选手面板一致，绿色是 0 号蛇。

## 启动

需要 Python 3.11 或更新版本，以及独立的 Kaggle 官方源码。默认目录结构如下。

```text
code/
├── hungry-geese/       Kaggle 官方裁判
└── 贪吃蛇策略实验场/   本项目的网页和策略
```

如果还没有官方源码，在本项目目录中运行下面两条命令。

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Kaggle/kaggle-environments.git ../hungry-geese
git -C ../hungry-geese sparse-checkout set kaggle_environments/envs/hungry_geese
```

第一次在本项目目录里安装依赖。

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

在 macOS 的 Finder 双击 `启动蛇阵.command`。也可以在终端运行 `.venv/bin/python arena.py`，然后打开 [本地对战台](http://127.0.0.1:8766/)。

如果裁判源码在其他位置，可以在启动时设置 `HUNGRY_GEESE_ENGINE` 指向其目录。

## 开局和回放

点「开始新局」生成一场对局。点「复用开局」可以用同一个随机种子再打一场。回放支持暂停、逐步前进和后退、跳转与倍速。

- **实验场**默认使用墙版规则。蛇头越界立即淘汰，棋盘随机补果至 2 个，每 40 回合缩短一格。基线蛇按墙版规则选路。
- **Kaggle 原版**使用官方裁判和官方 Greedy。边界相通。切换模式时会沿用当前的开局种子。

以后把自己的 `agent.py` 放到本项目根目录，保存后点「开始新局」，它就会接管绿色 0 号蛇。策略函数接收 `obs` 和 `config`，返回 `NORTH`、`EAST`、`SOUTH`、`WEST` 之一。

墙版的边界判定在 `wall_rules.py`。进食、碰撞、缩短和计分沿用官方裁判。[Kaggle 源码](https://github.com/Kaggle/kaggle-environments/tree/master/kaggle_environments/envs/hungry_geese)
