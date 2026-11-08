from copy import deepcopy

from kaggle_environments import make
from kaggle_environments.envs.hungry_geese import hungry_geese


def wall_destination(position, action, columns, rows):
    row, column = hungry_geese.row_col(position, columns)
    row_offset, column_offset = action.to_row_col()
    row += row_offset
    column += column_offset
    if 0 <= row < rows and 0 <= column < columns:
        return row * columns + column
    return None


def wall_interpreter(state, env):
    if env.done:
        env.info["wall_hits"] = {}
        return hungry_geese.interpreter(state, env)

    columns, rows = env.configuration.columns, env.configuration.rows
    geese = state[0].observation.geese
    wall_hits = []
    for seat, player in enumerate(state):
        if player.status != "ACTIVE":
            continue
        action = hungry_geese.Action[player.action]
        if wall_destination(geese[seat][0], action, columns, rows) is None:
            player.status = "DONE"
            geese[seat] = []
            wall_hits.append(seat)
    if wall_hits:
        env.info["wall_hits"][len(env.steps)] = wall_hits

    # In-bounds moves produce the same coordinates in both modes.
    return hungry_geese.interpreter(state, env)


def make_wall_environment():
    last_actions = {}

    def wall_greedy(observation, configuration):
        columns, rows = configuration.columns, configuration.rows
        seat = observation.index
        geese = observation.geese
        previous = last_actions.get(seat) if observation.step else None
        reverse = previous.opposite() if previous is not None else None
        bodies = {position for goose in geese for position in goose}
        threatened = {
            wall_destination(goose[0], action, columns, rows)
            for index, goose in enumerate(geese)
            if index != seat and goose
            for action in hungry_geese.Action
        }

        candidates = {}
        for action in hungry_geese.Action:
            destination = wall_destination(geese[seat][0], action, columns, rows)
            if destination is None or action == reverse:
                continue
            distance = hungry_geese.min_distance(destination, observation.food, columns) if observation.food else 0
            candidates[action] = (destination in bodies, destination in threatened, distance)

        chosen = min(candidates, key=candidates.get)
        last_actions[seat] = chosen
        return chosen.name

    specification = deepcopy(hungry_geese.specification)
    specification["configuration"]["walls"] = {"type": "boolean", "default": True}
    return make(
        {
            "specification": specification,
            "interpreter": wall_interpreter,
            "renderer": hungry_geese.renderer,
            "html_renderer": hungry_geese.html_renderer,
            "agents": {"greedy": wall_greedy},
        },
        configuration={"min_food": 2},
    )
