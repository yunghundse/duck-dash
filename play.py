#!/usr/bin/env python3
"""Duck Dash - Terminal-Version (ASCII Endless Runner).

Gewaltfreier Mini-Runner: die Gummiente "Q" laeuft ueber WM-Etappen,
springt ueber Hindernisse "^" und sammelt Baelle "o". Boden "=".

Steuerung:  Leertaste / W = springen   ·   Q = beenden
Nur Python-3-Standardbibliothek. Ohne TTY laeuft eine kurze Auto-Demo.
"""

import os
import sys
import time
import select

# --- Spielfeld ---
WIDTH = 60
GROUND_ROW = 10          # Zeilenindex des Bodens
SKY_ROWS = GROUND_ROW    # spielbare Hoehe darueber
DUCK_X = 6
FRAME = 0.07             # Sekunden pro Frame

COUNTRIES = ["Brasilien", "Deutschland", "Japan", "USA", "Argentinien", "WM-Finale"]
STAGE_LEN = 90           # Frames pro Etappe


class Duck:
    def __init__(self):
        self.y = 0.0       # Hoehe ueber dem Boden (0 = am Boden)
        self.vy = 0.0
        self.on_ground = True
        self.jumps = 0

    def jump(self):
        if self.on_ground:
            self.vy = 2.6
            self.on_ground = False
            self.jumps = 1
        elif self.jumps < 2:        # ein Doppelsprung
            self.vy = 2.3
            self.jumps = 2

    def update(self):
        self.vy -= 0.55             # Gravitation
        self.y += self.vy
        if self.y <= 0:
            self.y = 0.0
            self.vy = 0.0
            self.on_ground = True
            self.jumps = 0

    @property
    def row(self):
        # Bildschirmzeile der Ente (oben = 0)
        return int(round(GROUND_ROW - 1 - self.y))


class Game:
    def __init__(self, auto=False):
        self.duck = Duck()
        self.obstacles = []     # Liste [x, kind]  kind: '^' oder 'o'
        self.lives = 3
        self.score = 0
        self.balls = 0
        self.frame = 0
        self.stage = 0
        self.stage_frame = 0
        self.spawn_cd = 8
        self.auto = auto
        self.alive = True
        self.won = False

    def spawn(self):
        # deterministisch-pseudozufaellig ohne random-Import-Pflicht
        seed = (self.frame * 73 + 17) % 100
        kind = "o" if seed < 35 else "^"
        self.obstacles.append([WIDTH - 1, kind])

    def step(self, jump_pressed):
        if jump_pressed:
            self.duck.jump()
        self.duck.update()
        self.frame += 1
        self.stage_frame += 1
        self.score += 1

        # Etappenwechsel
        if self.stage_frame >= STAGE_LEN:
            if self.stage >= len(COUNTRIES) - 1:
                self.won = True
                self.alive = False
                return
            self.stage += 1
            self.stage_frame = 0
            self.score += 50

        # Spawnen
        self.spawn_cd -= 1
        if self.spawn_cd <= 0:
            self.spawn()
            self.spawn_cd = 9 + (self.frame % 5)

        # Bewegen + Kollision/Sammeln
        new_obs = []
        for ob in self.obstacles:
            ob[0] -= 1
            if ob[0] == DUCK_X:
                if ob[1] == "^":
                    if self.duck.y < 1.2:            # nicht hoch genug -> Treffer
                        self.lives -= 1
                        if self.lives <= 0:
                            self.alive = False
                    else:
                        self.score += 10
                        continue
                else:  # Ball einsammeln, wenn auf gleicher Hoehe-naehe
                    self.balls += 1
                    self.score += 5
                    continue
            if ob[0] >= 0:
                new_obs.append(ob)
        self.obstacles = new_obs

    def auto_jump(self):
        # einfache Demo-KI: springen, wenn ein '^' nahe und am Boden
        for ob in self.obstacles:
            if ob[1] == "^" and DUCK_X < ob[0] <= DUCK_X + 3 and self.duck.on_ground:
                return True
        return False

    def render(self):
        grid = [[" "] * WIDTH for _ in range(GROUND_ROW + 1)]
        # Boden
        grid[GROUND_ROW] = ["="] * WIDTH
        # Hindernisse / Baelle
        for x, kind in self.obstacles:
            if kind == "^":
                grid[GROUND_ROW - 1][x] = "^"
            else:
                # Ball schwebt auf wechselnder Hoehe
                by = GROUND_ROW - 1 - ((x % 3) + 1)
                if 0 <= by < GROUND_ROW:
                    grid[by][x] = "o"
        # Ente
        r = max(0, min(GROUND_ROW - 1, self.duck.row))
        grid[r][DUCK_X] = "Q"

        hearts = "<3 " * self.lives
        head = " Duck Dash  |  {:<12} {}/6  |  {}|  Score {}  Baelle {}".format(
            COUNTRIES[self.stage], self.stage + 1, hearts, self.score, self.balls)
        lines = [head, "+" + "-" * WIDTH + "+"]
        for row in grid:
            lines.append("|" + "".join(row) + "|")
        lines.append("+" + "-" * WIDTH + "+")
        lines.append(" Leertaste/W = springen   Q = beenden")
        return "\n".join(lines)


def clear():
    sys.stdout.write("\033[H\033[J")


def run_interactive():
    import termios
    import tty
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    game = Game()
    try:
        tty.setcbreak(fd)
        sys.stdout.write("\033[2J")
        while game.alive:
            jump = False
            # Eingaben sammeln (non-blocking)
            while select.select([sys.stdin], [], [], 0)[0]:
                ch = sys.stdin.read(1)
                if ch in (" ", "w", "W"):
                    jump = True
                elif ch in ("q", "Q"):
                    game.alive = False
            if not game.alive:
                break
            game.step(jump)
            clear()
            sys.stdout.write(game.render() + "\n")
            sys.stdout.flush()
            time.sleep(FRAME)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
    print_result(game)


def run_demo(max_frames=240):
    game = Game(auto=True)
    print("Keine interaktive TTY erkannt - kurze Auto-Demo:\n")
    while game.alive and game.frame < max_frames:
        game.step(game.auto_jump())
        clear()
        sys.stdout.write(game.render() + "\n")
        sys.stdout.flush()
        time.sleep(FRAME)
    print_result(game)


def print_result(game):
    print()
    if game.won:
        print("WELTMEISTER! Du hast alle Etappen geschafft. Score:", game.score)
    elif game.lives <= 0:
        print("Game Over. Score:", game.score, " Baelle:", game.balls)
    else:
        print("Demo beendet. Score:", game.score, " Baelle:", game.balls)


def main():
    if sys.stdin.isatty() and sys.stdout.isatty():
        try:
            run_interactive()
        except (ImportError, Exception):
            run_demo()
    else:
        run_demo()


if __name__ == "__main__":
    main()
