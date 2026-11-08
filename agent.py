from kaggle_environments.envs.hungry_geese.hungry_geese import Action, min_distance, translate

from wall_rules import wall_destination


previous_turn = {}


def retained_body(snake, destination, food, max_length, shrinking):
    """Return the body left behind the new head, or None if this snake dies first."""
    body = snake if destination in food else snake[:-1]
    if destination in body:
        return None

    body = body[:max_length - 1]
    if shrinking:
        if not body:
            return None
        body = body[:-1]
    return body


def agent(obs, config):
    seat, step = obs["index"], obs["step"]
    snakes, food = obs["geese"], set(obs["food"])
    columns, rows = config["columns"], config["rows"]
    max_length = config["max_length"]
    shrinking = (step + 1) % config["hunger_rate"] == 0
    destination_at = wall_destination if config.get("walls") else translate

    last_step, last_heads = previous_turn.get(seat, (None, ()))
    if last_step != step - 1:
        last_heads = (None,) * len(snakes)
    previous_turn[seat] = (step, tuple(snake[0] if snake else None for snake in snakes))

    def moves(snake, index):
        # The neck shows the last direction. A one-cell snake needs the previous frame.
        reverse_cell = snake[1] if len(snake) > 1 else last_heads[index]
        for action in Action:
            destination = destination_at(snake[0], action, columns, rows)
            if destination is not None and destination != reverse_cell:
                yield action, destination

    opponent_bodies, opponent_heads = set(), set()
    for index, snake in enumerate(snakes):
        if index == seat or not snake:
            continue
        for _, destination in moves(snake, index):
            # Assume a reachable fruit is available. If someone else eats it first,
            # this snake retains less body, so the estimate stays conservative.
            body = retained_body(snake, destination, food, max_length, shrinking)
            if body is not None:
                opponent_bodies.update(body)
                opponent_heads.add(destination)

    scores = {}
    for action, destination in moves(snakes[seat], seat):
        body = retained_body(snakes[seat], destination, food, max_length, shrinking)
        scores[action] = (
            body is None or destination in opponent_bodies,
            destination in opponent_heads,
            min_distance(destination, food, columns) if food else 0,
        )
    return min(scores, key=scores.get).name
