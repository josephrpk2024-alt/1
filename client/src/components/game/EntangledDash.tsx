import { useEffect, useRef, useCallback, useState } from "react";

interface Obstacle {
  id: number;
  x: number;
  type: "high" | "low" | "both";
  passed: boolean;
}

interface GameState {
  phase: "menu" | "playing" | "gameover";
  score: number;
  highScore: number;
  qubitAY: number;
  qubitBY: number;
  qubitAState: "normal" | "jumping" | "ducking";
  qubitBState: "normal" | "jumping" | "ducking";
  obstacles: Obstacle[];
  gameSpeed: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const GROUND_Y = CANVAS_HEIGHT - 60;
const TRACK_A_Y = GROUND_Y - 120;
const TRACK_B_Y = GROUND_Y - 20;
const QUBIT_SIZE = 30;
const QUBIT_DUCK_HEIGHT = 15;
const JUMP_HEIGHT = 60;
const OBSTACLE_WIDTH = 20;
const OBSTACLE_HEIGHT = 40;
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 0.0005;

export function EntangledDash() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>({
    phase: "menu",
    score: 0,
    highScore: parseInt(localStorage.getItem("entangledDashHighScore") || "0"),
    qubitAY: TRACK_A_Y,
    qubitBY: TRACK_B_Y,
    qubitAState: "normal",
    qubitBState: "normal",
    obstacles: [],
    gameSpeed: INITIAL_SPEED,
  });
  const animationRef = useRef<number>(0);
  const lastObstacleRef = useRef<number>(0);
  const obstacleIdRef = useRef<number>(0);
  const jumpStartTimeRef = useRef<number>(0);
  const [, forceUpdate] = useState(0);

  const resetGame = useCallback(() => {
    const state = gameStateRef.current;
    state.score = 0;
    state.qubitAY = TRACK_A_Y;
    state.qubitBY = TRACK_B_Y;
    state.qubitAState = "normal";
    state.qubitBState = "normal";
    state.obstacles = [];
    state.gameSpeed = INITIAL_SPEED;
    lastObstacleRef.current = 0;
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    gameStateRef.current.phase = "playing";
    forceUpdate((n) => n + 1);
  }, [resetGame]);

  const endGame = useCallback(() => {
    const state = gameStateRef.current;
    state.phase = "gameover";
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem("entangledDashHighScore", state.highScore.toString());
    }
    forceUpdate((n) => n + 1);
  }, []);

  const performAction = useCallback(() => {
    const state = gameStateRef.current;
    if (state.phase !== "playing") return;
    if (state.qubitAState !== "normal" || state.qubitBState !== "normal") return;

    state.qubitAState = "jumping";
    state.qubitBState = "ducking";
    jumpStartTimeRef.current = performance.now();
  }, []);

  const spawnObstacle = useCallback(() => {
    const state = gameStateRef.current;
    const types: ("high" | "low" | "both")[] = ["high", "low", "both"];
    const randomType = types[Math.floor(Math.random() * types.length)];

    state.obstacles.push({
      id: obstacleIdRef.current++,
      x: CANVAS_WIDTH + OBSTACLE_WIDTH,
      type: randomType,
      passed: false,
    });
  }, []);

  const checkCollision = useCallback(
    (
      qubitX: number,
      qubitY: number,
      qubitHeight: number,
      obstacleX: number,
      obstacleY: number
    ): boolean => {
      const qubitLeft = qubitX;
      const qubitRight = qubitX + QUBIT_SIZE;
      const qubitTop = qubitY;
      const qubitBottom = qubitY + qubitHeight;

      const obsLeft = obstacleX;
      const obsRight = obstacleX + OBSTACLE_WIDTH;
      const obsTop = obstacleY;
      const obsBottom = obstacleY + OBSTACLE_HEIGHT;

      return (
        qubitRight > obsLeft &&
        qubitLeft < obsRight &&
        qubitBottom > obsTop &&
        qubitTop < obsBottom
      );
    },
    []
  );

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = gameStateRef.current;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, TRACK_A_Y + QUBIT_SIZE + 5);
    ctx.lineTo(CANVAS_WIDTH, TRACK_A_Y + QUBIT_SIZE + 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, TRACK_B_Y + QUBIT_SIZE + 5);
    ctx.lineTo(CANVAS_WIDTH, TRACK_B_Y + QUBIT_SIZE + 5);
    ctx.stroke();

    ctx.fillStyle = "#222";
    ctx.font = "bold 80px monospace";
    ctx.textAlign = "center";
    ctx.fillText("ENTANGLED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.fillText("DASH", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);

    if (state.phase === "playing") {
      state.gameSpeed += SPEED_INCREMENT;
      state.score++;

      if (state.qubitAState === "jumping") {
        const elapsed = performance.now() - jumpStartTimeRef.current;
        const jumpDuration = 400;
        const progress = Math.min(elapsed / jumpDuration, 1);
        const jumpCurve = Math.sin(progress * Math.PI);
        state.qubitAY = TRACK_A_Y - jumpCurve * JUMP_HEIGHT;

        if (progress >= 1) {
          state.qubitAState = "normal";
          state.qubitAY = TRACK_A_Y;
        }
      }

      if (state.qubitBState === "ducking") {
        const elapsed = performance.now() - jumpStartTimeRef.current;
        const duckDuration = 400;
        if (elapsed >= duckDuration) {
          state.qubitBState = "normal";
        }
      }

      const now = performance.now();
      const minInterval = Math.max(800, 2000 - state.score * 0.5);
      if (now - lastObstacleRef.current > minInterval) {
        spawnObstacle();
        lastObstacleRef.current = now;
      }

      const qubitX = 100;

      for (const obstacle of state.obstacles) {
        obstacle.x -= state.gameSpeed;

        const qubitAHeight =
          state.qubitAState === "ducking" ? QUBIT_DUCK_HEIGHT : QUBIT_SIZE;
        const qubitBHeight =
          state.qubitBState === "ducking" ? QUBIT_DUCK_HEIGHT : QUBIT_SIZE;

        if (obstacle.type === "high" || obstacle.type === "both") {
          const obsY = TRACK_A_Y + QUBIT_SIZE - OBSTACLE_HEIGHT;
          if (checkCollision(qubitX, state.qubitAY, qubitAHeight, obstacle.x, obsY)) {
            endGame();
            return;
          }
        }

        if (obstacle.type === "low" || obstacle.type === "both") {
          const obsY = TRACK_B_Y + QUBIT_SIZE - OBSTACLE_HEIGHT;
          if (checkCollision(qubitX, state.qubitBY, qubitBHeight, obstacle.x, obsY)) {
            endGame();
            return;
          }
        }

        if (!obstacle.passed && obstacle.x + OBSTACLE_WIDTH < qubitX) {
          obstacle.passed = true;
          state.score += 10;
        }
      }

      state.obstacles = state.obstacles.filter((o) => o.x > -OBSTACLE_WIDTH);
    }

    const qubitX = 100;

    const drawQubit = (
      x: number,
      y: number,
      label: string,
      state: "normal" | "jumping" | "ducking",
      color: string
    ) => {
      const height = state === "ducking" ? QUBIT_DUCK_HEIGHT : QUBIT_SIZE;
      const adjustedY = state === "ducking" ? y + (QUBIT_SIZE - QUBIT_DUCK_HEIGHT) : y;

      ctx.fillStyle = color;
      ctx.fillRect(x, adjustedY, QUBIT_SIZE, height);

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, adjustedY, QUBIT_SIZE, height);

      ctx.fillStyle = "#000";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, x + QUBIT_SIZE / 2, adjustedY + height / 2 + 4);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const glowSize = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.strokeRect(
        x - glowSize,
        adjustedY - glowSize,
        QUBIT_SIZE + glowSize * 2,
        height + glowSize * 2
      );
      ctx.setLineDash([]);
    };

    drawQubit(qubitX, gameStateRef.current.qubitAY, "A", gameStateRef.current.qubitAState, "#00ff88");
    drawQubit(qubitX, gameStateRef.current.qubitBY, "B", gameStateRef.current.qubitBState, "#ff6688");

    ctx.strokeStyle = "#ffffff33";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(qubitX + QUBIT_SIZE / 2, gameStateRef.current.qubitAY + QUBIT_SIZE);
    ctx.lineTo(qubitX + QUBIT_SIZE / 2, gameStateRef.current.qubitBY);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const obstacle of gameStateRef.current.obstacles) {
      ctx.fillStyle = "#ff3333";

      if (obstacle.type === "high" || obstacle.type === "both") {
        const obsY = TRACK_A_Y + QUBIT_SIZE - OBSTACLE_HEIGHT;
        ctx.fillRect(obstacle.x, obsY, OBSTACLE_WIDTH, OBSTACLE_HEIGHT);
        ctx.strokeStyle = "#ff6666";
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x, obsY, OBSTACLE_WIDTH, OBSTACLE_HEIGHT);
      }

      if (obstacle.type === "low" || obstacle.type === "both") {
        const obsY = TRACK_B_Y + QUBIT_SIZE - OBSTACLE_HEIGHT;
        ctx.fillRect(obstacle.x, obsY, OBSTACLE_WIDTH, OBSTACLE_HEIGHT);
        ctx.strokeStyle = "#ff6666";
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x, obsY, OBSTACLE_WIDTH, OBSTACLE_HEIGHT);
      }
    }

    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${Math.floor(gameStateRef.current.score)}`, 20, 40);
    ctx.fillText(`HIGH: ${gameStateRef.current.highScore}`, 20, 65);

    ctx.textAlign = "right";
    ctx.fillStyle = "#666";
    ctx.font = "14px monospace";
    ctx.fillText("QUANTUM ENTANGLEMENT", CANVAS_WIDTH - 20, 40);

    if (gameStateRef.current.phase === "menu") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 48px monospace";
      ctx.textAlign = "center";
      ctx.fillText("ENTANGLED DASH", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

      ctx.fillStyle = "#ff6688";
      ctx.font = "16px monospace";
      ctx.fillText(
        "Two qubits. One action. Infinite correlation.",
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 - 40
      );

      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px monospace";
      ctx.fillText("Press SPACE to begin", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

      ctx.fillStyle = "#666";
      ctx.font = "14px monospace";
      ctx.fillText(
        "SPACE = Qubit A jumps, Qubit B ducks (entangled!)",
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 70
      );
      ctx.fillText(
        "Avoid obstacles on BOTH tracks to survive",
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 95
      );

      ctx.fillStyle = "#444";
      ctx.font = "12px monospace";
      ctx.fillText(
        '"Spooky action at a distance" - Einstein',
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 140
      );
    }

    if (gameStateRef.current.phase === "gameover") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#ff3333";
      ctx.font = "bold 48px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DECOHERENCE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

      ctx.fillStyle = "#888";
      ctx.font = "16px monospace";
      ctx.fillText(
        "The quantum state has collapsed",
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 - 20
      );

      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px monospace";
      ctx.fillText(
        `SCORE: ${Math.floor(gameStateRef.current.score)}`,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 30
      );

      if (gameStateRef.current.score >= gameStateRef.current.highScore) {
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 20px monospace";
        ctx.fillText("NEW HIGH SCORE!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
      }

      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px monospace";
      ctx.fillText("Press SPACE to restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [spawnObstacle, checkCollision, endGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        const state = gameStateRef.current;
        if (state.phase === "menu") {
          startGame();
        } else if (state.phase === "playing") {
          performAction();
        } else if (state.phase === "gameover") {
          startGame();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startGame, performAction]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
        fontFamily: "monospace",
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          border: "2px solid #333",
          imageRendering: "pixelated",
        }}
      />
      <div
        style={{
          marginTop: "20px",
          color: "#666",
          fontSize: "14px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "5px 0" }}>
          When you press SPACE, Qubit A jumps while Qubit B automatically ducks.
        </p>
        <p style={{ margin: "5px 0", color: "#444" }}>
          This simulates quantum entanglement: measuring one particle instantly
          determines the state of the other.
        </p>
      </div>
    </div>
  );
}
