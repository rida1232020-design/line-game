import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { t, tf } from "./i18n.js";
import { loadSettings, recordWin, loadStats, addCoins, SKINS } from "./store.js";
import SettingsScreen from "./components/SettingsScreen.jsx";
import WinScreen from "./components/WinScreen.jsx";
import StatsScreen from "./components/StatsScreen.jsx";
import RewardsScreen from "./components/RewardsScreen.jsx";
import { Sounds } from "./sounds.js";

// ═══════════════════════════════════════════════════════
//  BOARD
// ═══════════════════════════════════════════════════════
const W = 700, H = 520;
const NODES = [
  { id:0,  x:85,  y:110 }, { id:1,  x:85,  y:260 }, { id:2,  x:85,  y:410 },
  { id:3,  x:350, y:128 }, { id:4,  x:233, y:260 }, { id:5,  x:350, y:260 },
  { id:6,  x:467, y:260 }, { id:7,  x:350, y:392 },
  { id:8,  x:615, y:110 }, { id:9,  x:615, y:260 }, { id:10, x:615, y:410 },
];
const EDGES = [
  [0,1],[1,2],[8,9],[9,10],
  [0,3],[3,8],[1,4],[4,5],[5,6],[6,9],[2,7],[7,10],
  [3,5],[5,7],[3,4],[3,6],[7,4],[7,6],[0,4],[2,4],[8,6],[10,6],
];
const DIAG_SET = new Set(["3-4","3-6","7-4","7-6","0-4","2-4","8-6","10-6",
                          "4-3","6-3","4-7","6-7","4-0","4-2","6-8","6-10"]);
const edgeKey = (a,b) => `${a}-${b}`;
const ADJ_MAP = {};
NODES.forEach(n => { ADJ_MAP[n.id] = []; });
EDGES.forEach(([a,b]) => { ADJ_MAP[a].push(b); ADJ_MAP[b].push(a); });

const GREEN_WIN = new Set([8,9,10]);
const RED_WIN   = new Set([0,1,2]);

const ECX=350, ECY=260, ERX=117, ERY=132;

// ── Logic ──
function getValidMoves(board, from) { return ADJ_MAP[from].filter(to => board[to] === null); }
function getAllMoves(board, color) {
  const moves = [];
  NODES.forEach(n => {
    if (board[n.id] !== color) return;
    ADJ_MAP[n.id].forEach(to => { if (board[to] === null) moves.push({ from: n.id, to }); });
  });
  return moves;
}
function checkWin(board, color) {
  const ws = color === "green" ? GREEN_WIN : RED_WIN;
  return NODES.filter(n => board[n.id] === color).every(n => ws.has(n.id));
}
function applyMove(board, from, to) {
  const b = { ...board }; b[to] = b[from]; b[from] = null; return b;
}
const initBoard = () => {
  const b = {}; NODES.forEach(n => (b[n.id] = null));
  b[0]="green"; b[1]="green"; b[2]="green";
  b[8]="red";   b[9]="red";   b[10]="red";
  return b;
};

// ── AI ──
function evaluate(board, aiColor) {
  const opp = aiColor === "green" ? "red" : "green";
  if (checkWin(board, aiColor)) return  2000;
  if (checkWin(board, opp))     return -2000;
  const myGoal  = aiColor === "green" ? GREEN_WIN : RED_WIN;
  const oppGoal = aiColor === "green" ? RED_WIN   : GREEN_WIN;
  let score = 0;
  NODES.forEach(n => {
    const v = board[n.id];
    if (v === aiColor) {
      score += myGoal.has(n.id) ? 60 : 0;
      score += aiColor === "green" ? Math.round(n.x / 70) : Math.round((W - n.x) / 70);
    }
    if (v === opp) {
      score -= oppGoal.has(n.id) ? 60 : 0;
      score -= opp === "green" ? Math.round(n.x / 70) : Math.round((W - n.x) / 70);
    }
  });
  score += getAllMoves(board, aiColor).length;
  score -= getAllMoves(board, opp).length;
  return score;
}
function minimax(board, depth, isMax, aiColor, alpha, beta) {
  const opp = aiColor === "green" ? "red" : "green";
  if (checkWin(board, aiColor)) return  2000 + depth;
  if (checkWin(board, opp))     return -2000 - depth;
  if (depth === 0)               return evaluate(board, aiColor);
  const cur = isMax ? aiColor : opp;
  const moves = getAllMoves(board, cur);
  if (!moves.length) return isMax ? -1999 : 1999;
  let best = isMax ? -Infinity : Infinity;
  for (const m of moves) {
    const val = minimax(applyMove(board, m.from, m.to), depth-1, !isMax, aiColor, alpha, beta);
    if (isMax) { best = Math.max(best, val); alpha = Math.max(alpha, best); }
    else        { best = Math.min(best, val); beta  = Math.min(beta,  best); }
    if (beta <= alpha) break;
  }
  return best;
}
function getBestMove(board, aiColor, depth = 3) {
  const moves = getAllMoves(board, aiColor);
  if (!moves.length) return null;
  // Easy: pick random move
  if (depth === 0) return moves[Math.floor(Math.random() * moves.length)];
  // Medium: depth 2 with slight randomness
  let bestVal = -Infinity, bestMove = moves[0];
  const shuffled = depth === 1 ? [...moves].sort(() => Math.random() - 0.5) : moves;
  for (const m of shuffled) {
    const val = minimax(applyMove(board, m.from, m.to), depth, false, aiColor, -Infinity, Infinity);
    if (val > bestVal) { bestVal = val; bestMove = m; }
  }
  return bestMove;
}

// ═══════════════════════════════════════════════════════
//  APP COMPONENT
// ═══════════════════════════════════════════════════════
export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [stats, setStats] = useState(loadStats);
  const [coinsAwarded, setCoinsAwarded] = useState(0);
  const lang = settings.lang;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const T = useCallback((key) => t(lang, key), [lang]);
  const Tf = useCallback((key, vars) => tf(lang, key, vars), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body.classList.toggle("lang-en", lang === "en");
  }, [lang, dir]);

  const [screen, setScreen] = useState("menu"); // menu, setup, setup-room, lobby, mm, game, difficulty, settings, stats
  const [mode, setMode] = useState("pvp");      // pvp, pvc-g, pvc-r, online, online-room
  const [board, setBoard] = useState(initBoard());
  const [turn, setTurn] = useState("green");
  const [selected, setSelected] = useState(null);
  const [valids, setValids] = useState([]);
  const [winner, setWinner] = useState(null);
  const [movesCount, setMovesCount] = useState(0);
  const [lastMove, setLastMove] = useState(null);
  const [thinking, setThinking] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef = useRef(null);

  // AI Difficulty
  const [difficulty, setDifficulty] = useState("medium"); // easy, medium, hard
  const diffDepth = { easy: 0, medium: 2, hard: 4 };

  // Repetition detection: store last N moves as [{from, to}]
  const moveHistoryRef = useRef([]);

  // Common User States
  const [myName, setMyName] = useState(() => localStorage.getItem("gr_name") || "");
  const [myId, setMyId] = useState("");
  const [myColor, setMyColor] = useState(null);

  // Pi Network state
  const [piUser, setPiUser] = useState(null);
  const [piAuth, setPiAuth] = useState(null);

  // Random Matchmaking States
  const [opName, setOpName] = useState(() => t(loadSettings().lang, "searching"));
  const [searching, setSearching] = useState(false);
  const [mmSecs, setMmSecs] = useState(0);

  // Private Room States (2v2 / 1v1)
  const [roomCode, setRoomCode] = useState("");
  const [joinCodeInp, setJoinCodeInp] = useState("");
  const [roomPlayers, setRoomPlayers] = useState([]); 
  const [gameOrder, setGameOrder] = useState([]); // [{ id, name, color }]
  const [turnIndex, setTurnIndex] = useState(0);

  // Communication & Media
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInp, setChatInp] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peerVoice, setPeerVoice] = useState(false); // for random 1v1
  const [peerSpeaking, setPeerSpeaking] = useState({}); // for rooms {id: boolean}
  const [voiceChannel, setVoiceChannel] = useState("all"); // 'all' or 'team'
  const [discoMsg, setDiscoMsg] = useState("");
  const [restartReqFrom, setRestartReqFrom] = useState(null);

  const matchChRef = useRef(null);
  const gameChRef = useRef(null);   // used for random 1v1
  const roomChRef = useRef(null);   // used for private rooms
  
  const pcRef = useRef(null);       // used for random 1v1
  const pcsMulti = useRef({});      // used for private rooms
  const streamRef = useRef(null);
  const mmInterval = useRef(null);
  const mmBcast = useRef(null);
  const msgsEndRef = useRef(null);

  const aiColor = mode === "pvc-g" ? "red" : mode === "pvc-r" ? "green" : null;
  const isAiTurn = !!aiColor && turn === aiColor && !winner;

  // ICE Servers
  const ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]};

  const validatePiTokenWithBackend = async (accessToken) => {
    try {
      const response = await fetch('https://api.minepi.com/v2/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to validate token on backend');
      }
      return await response.json();
    } catch (error) {
      console.warn("Direct Pi API validation failed or was blocked by CORS. Using simulated backend verification...", error);
      return { username: localStorage.getItem("gr_name") || "pi_user" };
    }
  };

  const handlePiAuth = async () => {
    if (!window.Pi) {
      console.warn("Pi SDK not found (make sure you are running inside Pi Browser).");
      return;
    }
    try {
      console.log("Initializing Pi SDK as Promise...");
      await new Promise((resolve, reject) => {
        try {
          const res = window.Pi.init({ version: "2.0", sandbox: true });
          if (res && typeof res.then === 'function') {
            res.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      });

      console.log("Pi SDK initialized. Authenticating...");
      const scopes = ["username"];
      const onIncompletePaymentFound = (payment) => {
        console.log("Incomplete payment found:", payment);
      };

      const auth = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
      console.log("Pi authenticated successfully. Access token:", auth.accessToken);

      console.log("Validating access token on backend...");
      const validationResult = await validatePiTokenWithBackend(auth.accessToken);
      console.log("Backend validation successful:", validationResult);

      setPiAuth(auth);
      setPiUser(auth.user);
      if (auth.user && auth.user.username) {
        setMyName(auth.user.username);
        localStorage.setItem("gr_name", auth.user.username);
      }
    } catch (err) {
      console.error("Pi authentication/validation failed:", err);
    }
  };

  // Trigger Pi authentication automatically when the app loads
  useEffect(() => {
    if (window.Pi) {
      handlePiAuth();
    }
  }, []);

  // ── Timer Logic ──
  const getTimerDuration = () => Math.max(4, 10 - Math.floor(movesCount / 6));

  const handleTurnTimeout = () => {
    setSelected(null);
    setValids([]);
    setTurn(t => t === "green" ? "red" : "green");
    if (mode === "online" && gameChRef.current) {
      gameChRef.current.send({ type: "broadcast", event: "timeout", payload: {} });
    } else if (mode === "online-room" && roomChRef.current) {
      roomChRef.current.send({ type: "broadcast", event: "timeout_room", payload: { from: myId, orderLength: gameOrder.length } });
      setTurnIndex(prev => (prev + 1) % gameOrder.length);
    }
  };

  const resetTimer = () => {
    clearInterval(timerRef.current);
    const dur = getTimerDuration();
    setTimeLeft(dur);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTurnTimeout();
          return getTimerDuration();
        }
        return prev - 1;
      });
    }, 1000);
  };

  const isMyTurnForTimer = () => {
    if (mode === "online") return turn === myColor;
    if (mode === "online-room") {
      const cp = gameOrder[turnIndex];
      return cp && cp.id === myId;
    }
    return !isAiTurn;
  };

  // Start/reset timer when turn changes and game is active
  useEffect(() => {
    if (screen !== "game" || winner || thinking) return;
    if (!isMyTurnForTimer()) { clearInterval(timerRef.current); return; }
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [turn, screen, winner, mode, isAiTurn, myColor, turnIndex, gameOrder, myId]);

  // Stop timer on winner
  useEffect(() => {
    if (winner) clearInterval(timerRef.current);
  }, [winner]);

  // Record stats and award coins on winner
  useEffect(() => {
    if (winner) {
      recordWin(winner, movesCount);
      
      // Calculate coins to award
      let coinsToAward = 0;
      if (mode === "pvc-g" || mode === "pvc-r") {
        // AI game
        const playerColor = mode === "pvc-g" ? "green" : "red";
        if (winner === playerColor) {
          // Player won
          if (difficulty === "easy") coinsToAward = 15;
          else if (difficulty === "medium") coinsToAward = 30;
          else if (difficulty === "hard") coinsToAward = 50;
        } else {
          // AI won (consolation prize)
          coinsToAward = 5;
        }
      } else if (mode === "pvp") {
        // Local 1v1
        coinsToAward = 10;
      } else if (mode === "online") {
        // Online 1v1
        if (winner === myColor) {
          coinsToAward = 40;
        } else {
          coinsToAward = 15;
        }
      } else if (mode === "online-room") {
        // Private room 1v1 or 2v2
        const myPlayer = gameOrder.find(p => p.id === myId);
        const myTeamColor = myPlayer ? myPlayer.color : null;
        if (winner === myTeamColor) {
          coinsToAward = 40;
        } else {
          coinsToAward = 15;
        }
      }

      if (coinsToAward > 0) {
        const updatedStats = addCoins(coinsToAward);
        setStats(updatedStats);
        setCoinsAwarded(coinsToAward);
      } else {
        setStats(loadStats());
      }

      // Play win or lose sound
      if (settings.sound) {
        if (mode === "pvc-g" || mode === "pvc-r") {
          const playerColor = mode === "pvc-g" ? "green" : "red";
          if (winner === playerColor) {
            Sounds.win();
          } else {
            Sounds.lose();
          }
        } else {
          // PvP or Online win
          Sounds.win();
        }
      }
    }
  }, [winner, movesCount]);

  // Stop timer when leaving game screen
  useEffect(() => {
    if (screen !== "game") clearInterval(timerRef.current);
  }, [screen]);

  useEffect(() => {
    if (!isAiTurn) return;
    setThinking(true);
    const depth = diffDepth[difficulty];
    const delay = difficulty === "hard" ? 800 : difficulty === "medium" ? 580 : 300;
    const t = setTimeout(() => {
      const mv = getBestMove(board, aiColor, depth);
      if (mv) {
        setBoard(prev => {
           const nb = applyMove(prev, mv.from, mv.to);
           if (checkWin(nb, aiColor)) setWinner(aiColor);
           else setTurn(aiColor === "green" ? "red" : "green");
           return nb;
        });
        setLastMove(mv);
        setMovesCount(c => c+1);
        moveHistoryRef.current = [...moveHistoryRef.current, { from: mv.from, to: mv.to, color: aiColor }].slice(-30);
      }
      setThinking(false);
    }, delay);
    return () => clearTimeout(t);
  }, [isAiTurn, board, aiColor, difficulty]);

  useEffect(() => {
    if (mode === "online-room") {
      const myPlayer = gameOrder.find(p => p.id === myId);
      const myTeamColor = myPlayer ? myPlayer.color : null;
      roomPlayers.forEach(p => {
        if (p.id === myId) return;
        const au = document.getElementById(`audio-${p.id}`);
        if (au) {
          if (voiceChannel === 'all') au.muted = false;
          else if (voiceChannel === 'team') {
            const isTeammate = gameOrder.find(go => go.id === p.id)?.color === myTeamColor;
            au.muted = !isTeammate;
          }
        }
      });
    }
  }, [voiceChannel, gameOrder, mode, roomPlayers, myId]);

  useEffect(() => {
    if (mode === "online-room" && screen === "game" && roomPlayers.length > 0 && roomPlayers.length < gameOrder.length) {
       setDiscoMsg(T("playerLeftRoom"));
    }
  }, [roomPlayers, mode, screen, gameOrder]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  // ── Repetition Detection ──
  // Returns true if this exact move (from→to) has been made 3+ times by this color
  const isRepetitiveMove = (from, to, color) => {
    const hist = moveHistoryRef.current.filter(m => m.color === color);
    const count = hist.filter(m => m.from === from && m.to === to).length;
    return count >= 3;
  };

  // ── Handlers ──
  const handleMove = (f, t) => {
    const colorMoving = board[f];
    moveHistoryRef.current = [...moveHistoryRef.current, { from: f, to: t, color: colorMoving }].slice(-30);
    setBoard(prev => {
      const nb = applyMove(prev, f, t);
      const pc = nb[t];
      if (checkWin(nb, pc)) setWinner(pc);
      else setTurn(prevTurn => prevTurn === "green" ? "red" : "green");
      return nb;
    });
    setLastMove({ from: f, to: t });
    setMovesCount(c => c+1);
    setSelected(null); setValids([]);
    if (settings.sound) Sounds.move();
  };

  const handleRestartLocal = () => {
    setBoard(initBoard()); setTurn("green"); setSelected(null); setValids([]);
    setWinner(null); setMovesCount(0); setLastMove(null); setThinking(false); setDiscoMsg("");
    setTurnIndex(0); moveHistoryRef.current = [];
    clearInterval(timerRef.current);
    setCoinsAwarded(0);
  };

  const handleRestart = () => {
    handleRestartLocal();
    addChatMsg(T("system"), T("gameRestarted"), "sys", "sys");
  };

  const handleClick = (nodeId) => {
    if (winner || thinking) return;

    if (mode === "online") {
      if (turn !== myColor) return;
    } else if (mode === "online-room") {
      const currentPlayer = gameOrder[turnIndex];
      if (!currentPlayer || currentPlayer.id !== myId) return; // Not your turn in the cycle
    } else {
      if (mode === "pvc-g" && turn === "red") return;
      if (mode === "pvc-r" && turn === "green") return;
    }

    const piece = board[nodeId];

    if (selected === null) {
      if (piece === turn) {
        setSelected(nodeId);
        setValids(getValidMoves(board, nodeId));
        if (settings.sound) Sounds.select();
      }
      return;
    }

    if (nodeId === selected) {
      setSelected(null);
      setValids([]);
      if (settings.sound) Sounds.deselect();
      return;
    }

    if (valids.includes(nodeId)) {
      if (isRepetitiveMove(selected, nodeId, turn)) {
        setValids(prev => [...prev]);
        setRepeatWarning(true);
        setTimeout(() => setRepeatWarning(false), 1000);
        return;
      }
      handleMove(selected, nodeId);
      
      if (mode === "online" && gameChRef.current) {
        gameChRef.current.send({ type: "broadcast", event: "mv", payload: { f: selected, t: nodeId } });
      } else if (mode === "online-room" && roomChRef.current) {
        roomChRef.current.send({ type: "broadcast", event: "mv_room", payload: { from: myId, f: selected, t: nodeId, orderLength: gameOrder.length } });
        setTurnIndex(prev => (prev + 1) % gameOrder.length);
      }
      return;
    }

    if (piece === turn) {
      setSelected(nodeId);
      setValids(getValidMoves(board, nodeId));
      if (settings.sound) Sounds.select();
      return;
    }

    setSelected(null);
    setValids([]);
    if (settings.sound) Sounds.deselect();
  };

  // Repeat warning state
  const [repeatWarning, setRepeatWarning] = useState(false);

  const startGameLocal = (m) => {
    setMode(m); handleRestartLocal(); setScreen("game");
  };

  const startPvcGame = (m) => {
    setMode(m); setScreen("difficulty");
  };

  const confirmDifficulty = (diff) => {
    setDifficulty(diff);
    handleRestartLocal();
    setScreen("game");
  };

  // ═══════════════════════════════════════════════════════
  //  ONLINE: RANDOM 1V1
  // ═══════════════════════════════════════════════════════
  const saveAndSearchRandom = async () => {
    const nm = myName.trim() || T("defaultPlayer");
    setMyName(nm); localStorage.setItem("gr_name", nm);
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setMyId(newId);
    setSearching(true); setMmSecs(0); setOpName(T("searching"));
    setScreen("mm");

    mmInterval.current = setInterval(() => setMmSecs(s => s + 1), 1000);

    const ch = supabase.channel('mm-pool', { config: { broadcast: { self: false } } });
    matchChRef.current = ch;

    ch.on('broadcast', { event: 'seek' }, (msg) => {
      const op = msg.payload;
      if (op.id === newId) return;
      const gid = 'g' + Date.now().toString(36);
      ch.send({ type: 'broadcast', event: 'accept', payload: {
        to: op.id, fromId: newId, fromName: nm, gameId: gid, opColor: 'red'
      }});
      finishSearch(op.name, 'red', gid, nm);
    }).on('broadcast', { event: 'accept' }, (msg) => {
      const d = msg.payload;
      if (d.to !== newId) return;
      finishSearch(d.fromName, 'green', d.gameId, nm);
    });

    await ch.subscribe(async (st) => {
      if (st === 'SUBSCRIBED') {
        const bcast = () => ch.send({ type: 'broadcast', event: 'seek', payload: { id: newId, name: nm } });
        bcast();
        mmBcast.current = setInterval(bcast, 2500);
      }
    });
  };

  const finishSearch = (opponentName, myCol, gid, localName) => {
    setOpName(opponentName);
    clearInterval(mmInterval.current);
    clearInterval(mmBcast.current);
    setSearching(false);
    setTimeout(() => joinSession(gid, myCol, opponentName, localName), 1400);
  };

  const cancelSearch = () => {
    setSearching(false);
    clearInterval(mmInterval.current); clearInterval(mmBcast.current);
    if (matchChRef.current) { matchChRef.current.unsubscribe(); matchChRef.current = null; }
    setScreen("menu");
  };

  const joinSession = async (gid, myCol, opponentName, localName) => {
    setMyColor(myCol); setOpName(opponentName); setMode("online");
    setDiscoMsg(""); setChatMsgs([]); handleRestartLocal();

    const ch = supabase.channel('gs-' + gid, { config: { broadcast: { self: false } } });
    gameChRef.current = ch;

    ch.on('broadcast', { event: 'mv' }, msg => handleMove(msg.payload.f, msg.payload.t))
      .on('broadcast', { event: 'timeout' }, () => {
        setSelected(null);
        setValids([]);
        setTurn(t => t === "green" ? "red" : "green");
      })
      .on('broadcast', { event: 'chat' }, msg => addChatMsg(msg.payload.name, msg.payload.text, msg.payload.color, 'theirs'))
      .on('broadcast', { event: 'rst' }, () => handleRestart())
      .on('broadcast', { event: 'webrtc' }, msg => onWebRTC(msg))
      .on('broadcast', { event: 'bye' }, msg => {
        const nm = msg.payload?.name || T("opponent");
        addChatMsg(T("system"), Tf("playerLeft", { name: nm }), "sys", "sys");
        setDiscoMsg(Tf("playerLeftShort", { name: nm }));
      })
      .on('broadcast', { event: 'rst_req' }, msg => setRestartReqFrom(msg.payload.name))
      .on('broadcast', { event: 'rst_ack' }, () => {
        handleRestart(); addChatMsg(T("system"), T("opponentAcceptedRestart"), "sys", "sys");
      });

    await ch.subscribe();
    addChatMsg(T("system"), Tf("gameStartMsg", {
      green: myCol === "green" ? localName : opponentName,
      red: myCol === "red" ? localName : opponentName,
    }), "sys", "sys");
    setScreen("game");
  };

  // ═══════════════════════════════════════════════════════
  //  ONLINE: PRIVATE ROOM (2v2 / 1v1)
  // ═══════════════════════════════════════════════════════
  const initPrivateRoom = async (code) => {
    const nm = myName.trim() || T("defaultPlayer");
    setMyName(nm); localStorage.setItem("gr_name", nm);
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setMyId(newId);
    setRoomCode(code);
    setRoomPlayers([]); setGameOrder([]); setChatMsgs([]);
    setScreen("lobby");

    const ch = supabase.channel(`room-${code}`, { config: { presence: { key: newId }, broadcast: { self: true } } });
    roomChRef.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const players = [];
      for (const id in state) {
        players.push({ id, name: state[id][0].name, joinedAt: state[id][0].joinedAt });
      }
      players.sort((a,b) => a.joinedAt - b.joinedAt);
      setRoomPlayers(players);
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
       leftPresences.forEach(p => {
          if (pcsMulti.current[p.key]) {
             pcsMulti.current[p.key].close();
             delete pcsMulti.current[p.key];
          }
          const au = document.getElementById(`audio-${p.key}`);
          if (au) au.remove();
          setPeerSpeaking(prev => { const n = {...prev}; delete n[p.key]; return n; });
       });
    })
    .on('broadcast', { event: 'start_game' }, msg => {
      setGameOrder(msg.payload.order);
      setMode("online-room");
      handleRestartLocal();
      setTurnIndex(0);
      setScreen("game");
      addChatMsg(T("system"), T("roomGameStarted"), "sys", "sys");
    })
    .on('broadcast', { event: 'mv_room' }, msg => {
      if (msg.payload.from !== newId) { // Apply move if not sender
         handleMove(msg.payload.f, msg.payload.t);
         setTurnIndex(prev => (prev + 1) % msg.payload.orderLength);
      }
    })
    .on('broadcast', { event: 'timeout_room' }, msg => {
      if (msg.payload.from === newId) return;
      setSelected(null);
      setValids([]);
      setTurn(t => t === "green" ? "red" : "green");
      setTurnIndex(prev => (prev + 1) % msg.payload.orderLength);
    })
    .on('broadcast', { event: 'chat_room' }, msg => {
      if (msg.payload.name !== nm) addChatMsg(msg.payload.name, msg.payload.text, msg.payload.color, 'theirs');
    })
    .on('broadcast', { event: 'webrtc_ping' }, msg => {
      const peerId = msg.payload.from;
      if (peerId !== newId && streamRef.current) {
        initRTCPeerMulti(peerId, streamRef.current, newId);
      }
    })
    .on('broadcast', { event: 'webrtc_room' }, msg => {
      if (msg.payload.to === newId) onWebRTCMulti(msg, newId);
    })
    .on('broadcast', { event: 'rst_req_room' }, msg => {
      if (msg.payload.name !== nm) setRestartReqFrom(msg.payload.name);
    })
    .on('broadcast', { event: 'rst_ack_room' }, () => {
      handleRestart(); addChatMsg(T("system"), T("restartAccepted"), "sys", "sys");
    });

    await ch.subscribe(async (st) => {
      if (st === 'SUBSCRIBED') {
        await ch.track({ name: nm, joinedAt: Date.now() });
      }
    });
  };

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    initPrivateRoom(code);
  };

  const joinRoom = () => {
    if (joinCodeInp.trim().length < 3) return alert(T("invalidCode"));
    initPrivateRoom(joinCodeInp.trim().toUpperCase());
  };

  const startRoomGame = () => {
    if (roomPlayers.length !== 2 && roomPlayers.length !== 4) {
      alert(T("need2or4Players"));
      return;
    }
    const order = [];
    if (roomPlayers.length === 2) {
      order.push({ ...roomPlayers[0], color: 'green' });
      order.push({ ...roomPlayers[1], color: 'red' });
    } else if (roomPlayers.length === 4) {
      // Team Green: P1, P3. Team Red: P2, P4.
      // Order of turns: Green, Red, Green, Red
      order.push({ ...roomPlayers[0], color: 'green' });
      order.push({ ...roomPlayers[1], color: 'red' });
      order.push({ ...roomPlayers[2], color: 'green' });
      order.push({ ...roomPlayers[3], color: 'red' });
    }
    roomChRef.current.send({ type: 'broadcast', event: 'start_game', payload: { order } });
  };


  // ═══════════════════════════════════════════════════════
  //  COMMON LOGIC
  // ═══════════════════════════════════════════════════════
  const leaveGame = () => {
    if (gameChRef.current) {
      gameChRef.current.send({ type: 'broadcast', event: 'bye', payload: { name: myName } });
      gameChRef.current.unsubscribe(); gameChRef.current = null;
    }
    if (roomChRef.current) {
      roomChRef.current.unsubscribe(); roomChRef.current = null;
    }
    if (matchChRef.current) { matchChRef.current.unsubscribe(); matchChRef.current = null; }
    stopVoice(); setSearching(false);
    clearInterval(mmInterval.current); clearInterval(mmBcast.current);
    setScreen("menu");
  };

  const reqRestart = () => {
    if (mode === 'online' && gameChRef.current) {
      gameChRef.current.send({ type: 'broadcast', event: 'rst_req', payload: { name: myName } });
      addChatMsg(T("system"), T("waitingOpponentRestart"), "sys", "sys");
    } else if (mode === 'online-room' && roomChRef.current) {
      roomChRef.current.send({ type: 'broadcast', event: 'rst_req_room', payload: { name: myName } });
      addChatMsg(T("system"), T("waitingAllRestart"), "sys", "sys");
    } else {
      handleRestart();
    }
  };

  const addChatMsg = (name, text, color, side) => {
    setChatMsgs(prev => [...prev, { id: Date.now()+Math.random(), name, text, color: color || '#aaa', side }]);
  };

  const sendChat = () => {
    if (!chatInp.trim()) return;
    const myCol = mode === 'online' ? myColor : (gameOrder.find(p=>p.id===myId)?.color || 'green');
    addChatMsg(myName, chatInp.trim(), myCol, 'mine');
    
    if (mode === 'online' && gameChRef.current) {
      gameChRef.current.send({ type: 'broadcast', event: 'chat', payload: { name: myName, text: chatInp.trim(), color: myCol } });
    } else if ((mode === 'online-room' || screen === 'lobby') && roomChRef.current) {
      roomChRef.current.send({ type: 'broadcast', event: 'chat_room', payload: { name: myName, text: chatInp.trim(), color: myCol } });
    }
    setChatInp("");
  };

  // ═══════════════════════════════════════════════════════
  //  WEBRTC VOICE CHAT
  // ═══════════════════════════════════════════════════════
  const toggleVoice = async () => {
    if (!voiceOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;
        setVoiceOn(true);
        
        if (mode === 'online-room' || screen === 'lobby') {
           // Multi-peer
           roomPlayers.forEach(p => {
             if (p.id !== myId) initRTCPeerMulti(p.id, stream);
           });
           roomChRef.current.send({ type: 'broadcast', event: 'webrtc_ping', payload: { from: myId } });
        } else {
           // Random 1v1
           await initRTC(stream);
           if (gameChRef.current) gameChRef.current.send({ type: 'broadcast', event: 'webrtc', payload: { t: 'req' } });
        }
      } catch (e) {
        alert(T('micDenied'));
      }
    } else {
      stopVoice();
    }
  };

  const stopVoice = () => {
    setVoiceOn(false); setMuted(false); setPeerVoice(false); setPeerSpeaking({});
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    // Clean up multi peers
    Object.values(pcsMulti.current).forEach(pc => pc.close());
    pcsMulti.current = {};
    document.querySelectorAll('.peer-audio').forEach(el => el.remove());
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (streamRef.current) { streamRef.current.getAudioTracks().forEach(t => t.enabled = !newMuted); }
  };

  // ── 1v1 Random Logic ──
  const initRTC = async (stream) => {
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      const au = document.getElementById('remote-audio');
      if (au) { au.srcObject = e.streams[0]; au.play().catch(()=>{}); }
      setPeerVoice(true);
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') setPeerVoice(false);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && gameChRef.current) gameChRef.current.send({ type: 'broadcast', event: 'webrtc', payload: { t: 'c', c: e.candidate } });
    };
    if (myColor === 'green') {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      gameChRef.current.send({ type: 'broadcast', event: 'webrtc', payload: { t: 'o', sdp: offer } });
    }
  };

  const onWebRTC = async (msg) => {
    const d = msg.payload;
    if (!pcRef.current) return;
    if (d.t === 'o') {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(d.sdp));
      const ans = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(ans);
      gameChRef.current.send({ type: 'broadcast', event: 'webrtc', payload: { t: 'a', sdp: ans } });
    } else if (d.t === 'a') {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(d.sdp));
    } else if (d.t === 'c') {
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(d.c)); } catch (e) {}
    } else if (d.t === 'req') {
      if (voiceOn && myColor === 'green' && pcRef.current) {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        gameChRef.current.send({ type: 'broadcast', event: 'webrtc', payload: { t: 'o', sdp: offer } });
      }
    }
  };

  // ── Multi-Peer (Rooms) Logic ──
  const initRTCPeerMulti = async (peerId, stream, currentMyId) => {
    const idToUse = currentMyId || myId;
    if (pcsMulti.current[peerId]) return;
    const pc = new RTCPeerConnection(ICE);
    pcsMulti.current[peerId] = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      let au = document.getElementById(`audio-${peerId}`);
      if (!au) {
        au = document.createElement('audio');
        au.id = `audio-${peerId}`;
        au.className = 'peer-audio';
        au.autoplay = true;
        document.body.appendChild(au);
      }
      au.srcObject = e.streams[0];
      au.play().catch(()=>{});
      setPeerSpeaking(prev => ({...prev, [peerId]: true}));
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setPeerSpeaking(prev => ({...prev, [peerId]: false}));
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && roomChRef.current) {
        roomChRef.current.send({ type: 'broadcast', event: 'webrtc_room', payload: { to: peerId, from: idToUse, t: 'c', c: e.candidate } });
      }
    };

    // Polite Peer logic for mesh (Higher ID always creates offer)
    if (idToUse > peerId) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      roomChRef.current.send({ type: 'broadcast', event: 'webrtc_room', payload: { to: peerId, from: idToUse, t: 'o', sdp: offer } });
    }
  };

  const onWebRTCMulti = async (msg, currentMyId) => {
    const d = msg.payload;
    const peerId = d.from;
    const idToUse = currentMyId || myId;
    let pc = pcsMulti.current[peerId];
    
    if (!pc) {
      // If we got an offer/candidate but pc doesn't exist, create it
      if (streamRef.current) {
        await initRTCPeerMulti(peerId, streamRef.current, idToUse);
        pc = pcsMulti.current[peerId];
      } else return;
    }

    if (d.t === 'o') {
      await pc.setRemoteDescription(new RTCSessionDescription(d.sdp));
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      roomChRef.current.send({ type: 'broadcast', event: 'webrtc_room', payload: { to: peerId, from: idToUse, t: 'a', sdp: ans } });
    } else if (d.t === 'a') {
      await pc.setRemoteDescription(new RTCSessionDescription(d.sdp));
    } else if (d.t === 'c') {
      try { await pc.addIceCandidate(new RTCIceCandidate(d.c)); } catch (e) {}
    }
  };

  const activeSkinId = stats.activeSkin || "classic";
  const activeSkin = SKINS.find(s => s.id === activeSkinId) || SKINS[0];

  // ══════════════════════════════════════════════════════
  //  RENDERS
  // ══════════════════════════════════════════════════════
  if (screen === "rewards") return (
    <RewardsScreen
      onBack={() => setScreen("menu")}
      T={T}
      lang={lang}
      stats={stats}
      onUpdateStats={setStats}
      sound={settings.sound}
    />
  );

  if (screen === "settings") return (
    <SettingsScreen
      settings={settings}
      onUpdate={setSettings}
      onBack={() => setScreen("menu")}
      T={T}
    />
  );

  if (screen === "stats") return (
    <StatsScreen onBack={() => setScreen("menu")} T={T} lang={lang} />
  );

  if (screen === "menu") return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={{ ...S.menuWrap, direction: dir }} className="fadeIn">
        {/* Gems Balance pill in top right/left of the menu */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          marginBottom: 14,
          padding: "0 4px"
        }}>
          <div style={{ color: "#666", fontSize: 11 }}>{piUser ? `@${piUser.username}` : ""}</div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255, 215, 0, 0.08)",
            border: "1px solid rgba(255, 215, 0, 0.2)",
            padding: "5px 12px",
            borderRadius: 20,
            boxShadow: "0 0 10px rgba(255,215,0,0.05)"
          }}>
            <span style={{ fontSize: 13 }}>💎</span>
            <span style={{ color: "#ffd700", fontWeight: 800, fontSize: 12 }}>{stats.coins || 0}</span>
          </div>
        </div>

        <div style={S.logo}>⚽</div>
        <h1 style={S.title}>{T("appName")}</h1>
        <p style={S.sub}>{T("appTagline")}</p>
        <p style={{color:"#4caf50", fontSize:11, fontWeight:700, marginBottom:18, letterSpacing:1}}>{T("developerCredit")}</p>



        <div style={S.card}>
          <div style={{ ...S.cardHint, direction: dir }}>{T("onlineModes")}</div>
          <button style={{...S.modeBtn, background:"linear-gradient(135deg,#0d47a1,#1565c0)"}} className="modeBtn" onClick={() => setScreen("setup")}>
            <span style={{fontSize:28}}>🌍</span>
            <div style={{ direction: dir }}><div style={{ ...S.mBtnT, direction: dir }}>{T("randomMatch")}</div><div style={{ ...S.mBtnS, direction: dir }}>{T("randomMatchSub")}</div></div>
          </button>
          <button style={{...S.modeBtn, background:"linear-gradient(135deg,#e65100,#ef6c00)"}} className="modeBtn" onClick={() => setScreen("setup-room")}>
            <span style={{fontSize:28}}>🏠</span>
            <div style={{ direction: dir }}><div style={{ ...S.mBtnT, direction: dir }}>{T("privateRoom")}</div><div style={{ ...S.mBtnS, direction: dir }}>{T("privateRoomSub")}</div></div>
          </button>
        </div>

        <div style={{...S.card, marginTop:0}}>
          <div style={{ ...S.cardHint, direction: dir }}>{T("offlineModes")}</div>
          <button style={{...S.modeBtn, background:"linear-gradient(135deg,#1b5e20,#2e7d32)"}} className="modeBtn" onClick={() => startGameLocal('pvp')}>
            <span style={{fontSize:24}}>👥</span>
            <div style={{ direction: dir }}><div style={{ ...S.mBtnT, direction: dir }}>{T("twoPlayersLocal")}</div></div>
          </button>
          <button style={{...S.modeBtn, background:"linear-gradient(135deg,#4a148c,#6a1b9a)"}} className="modeBtn" onClick={() => startPvcGame('pvc-g')}>
            <span style={{fontSize:24}}>🤖</span>
            <div style={{ direction: dir }}><div style={{ ...S.mBtnT, direction: dir }}>{T("vsComputer")}</div></div>
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 4 }}>
          <button className="btn-gray" style={{ flex: 1 }} onClick={() => setScreen("settings")}>⚙️ {T("settings")}</button>
          <button className="btn-gray" style={{ flex: 1 }} onClick={() => setScreen("rewards")}>🏆 {T("rewards")}</button>
          <button className="btn-gray" style={{ flex: 1 }} onClick={() => setScreen("stats")}>📊 {T("stats")}</button>
        </div>
      </div>
    </div>
  );

  // ── DIFFICULTY SELECTION SCREEN ──
  if (screen === "difficulty") return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={{ ...S.menuWrap, direction: dir }} className="fadeIn">
        <div style={{fontSize:52, marginBottom:8, filter:"drop-shadow(0 0 20px rgba(150,100,255,0.6))"}}>🤖</div>
        <h1 style={{color:"#fff", fontSize:"clamp(22px,5vw,32px)", fontWeight:900, margin:"0 0 6px", textShadow:"0 0 25px rgba(150,100,255,0.5)"}}>{T("chooseDifficulty")}</h1>
        <p style={{color:"#88a", fontSize:13, margin:"0 0 28px", textAlign:"center"}}>{T("difficultyHint")}</p>

        <div style={{...S.card, gap:16}}>
          <button style={{...S.modeBtn, background:"linear-gradient(135deg,#1b5e20,#388e3c)", border:"1px solid rgba(76,175,80,0.3)"}} className="modeBtn" onClick={() => confirmDifficulty("easy")}>
            <span style={{fontSize:30}}>😊</span>
            <div style={{ direction: dir }}>
              <div style={{ ...S.mBtnT, direction: dir }}>{T("easy")}</div>
              <div style={{ ...S.mBtnS, direction: dir }}>{T("easySub")}</div>
            </div>
            <span style={{marginInlineStart:"auto", fontSize:11, color:"#81c784", fontWeight:700, background:"rgba(76,175,80,0.15)", padding:"4px 10px", borderRadius:20}}>EASY</span>
          </button>

          <button style={{...S.modeBtn, background:"linear-gradient(135deg,#e65100,#f57c00)", border:"1px solid rgba(255,152,0,0.3)"}} className="modeBtn" onClick={() => confirmDifficulty("medium")}>
            <span style={{fontSize:30}}>🎯</span>
            <div style={{ direction: dir }}>
              <div style={{ ...S.mBtnT, direction: dir }}>{T("medium")}</div>
              <div style={{ ...S.mBtnS, direction: dir }}>{T("mediumSub")}</div>
            </div>
            <span style={{marginInlineStart:"auto", fontSize:11, color:"#ffb74d", fontWeight:700, background:"rgba(255,152,0,0.15)", padding:"4px 10px", borderRadius:20}}>MED</span>
          </button>

          <button style={{...S.modeBtn, background:"linear-gradient(135deg,#b71c1c,#c62828)", border:"1px solid rgba(244,67,54,0.3)"}} className="modeBtn" onClick={() => confirmDifficulty("hard")}>
            <span style={{fontSize:30}}>💀</span>
            <div style={{ direction: dir }}>
              <div style={{ ...S.mBtnT, direction: dir }}>{T("hard")}</div>
              <div style={{ ...S.mBtnS, direction: dir }}>{T("hardSub")}</div>
            </div>
            <span style={{marginInlineStart:"auto", fontSize:11, color:"#ef9a9a", fontWeight:700, background:"rgba(244,67,54,0.15)", padding:"4px 10px", borderRadius:20}}>HARD</span>
          </button>
        </div>

        <button className="btn-gray" onClick={() => setScreen("menu")}>{T("backToMenu")}</button>
      </div>
    </div>
  );

  if (screen === "setup") return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={{ ...S.menuWrap, direction: dir }} className="fadeIn">
        <div style={{fontSize:46,marginBottom:10}}>🌍</div>
        <h1 style={{fontSize:24,color:"#fff",fontWeight:900,marginBottom:6}}>{T("randomMatch")}</h1>
        <div style={S.card}>
          <label style={{ ...S.lbl, textAlign: dir === "rtl" ? "right" : "left" }}>{T("yourName")}</label>
          <input className="inp" value={myName} onChange={e=>setMyName(e.target.value)} placeholder={T("enterName")} maxLength="16"/>
          <div style={{display:"flex",gap:10,marginTop:14,justifyContent:"center"}}>
            <button className="btn-blue" onClick={saveAndSearchRandom}>{T("searchOpponent")}</button>
            <button className="btn-gray" onClick={()=>setScreen("menu")}>{T("back")}</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "setup-room") return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={{ ...S.menuWrap, direction: dir }} className="fadeIn">
        <div style={{fontSize:46,marginBottom:10}}>🏠</div>
        <h1 style={{fontSize:24,color:"#fff",fontWeight:900,marginBottom:6}}>{T("privateRooms")}</h1>
        <p style={{color:"#888",fontSize:12,marginBottom:20}}>{T("privateRoomsSub")}</p>

        <div style={S.card}>
          <label style={{ ...S.lbl, textAlign: dir === "rtl" ? "right" : "left" }}>{T("yourName")}</label>
          <input className="inp" value={myName} onChange={e=>setMyName(e.target.value)} placeholder={T("enterName")} maxLength="16" style={{marginBottom:15}}/>
          
          <button className="btn-blue" onClick={createRoom} style={{background:"linear-gradient(135deg,#e65100,#ef6c00)"}}>{T("createRoom")}</button>
          
          <div style={{textAlign:"center", color:"#666", margin:"10px 0", fontSize:12}}>{T("orJoinRoom")}</div>
          
          <div style={{display:"flex", gap:8}}>
            <input className="inp" value={joinCodeInp} onChange={e=>setJoinCodeInp(e.target.value)} placeholder={T("roomCodePlaceholder")} style={{flex:1, textAlign:'center', letterSpacing:2, textTransform:'uppercase'}} maxLength="6"/>
            <button className="btn-blue" onClick={joinRoom}>{T("join")}</button>
          </div>
        </div>
        <button className="btn-gray" onClick={()=>setScreen("menu")}>{T("backToMenu")}</button>
      </div>
    </div>
  );

  if (screen === "lobby") {
    const isHost = roomPlayers.length > 0 && roomPlayers[0].id === myId;
    const canStart = roomPlayers.length === 2 || roomPlayers.length === 4;
    return (
      <div style={S.root}>
        <style>{CSS}</style>
        <div style={{ ...S.menuWrap, direction: dir }} className="fadeIn">
          <div style={{background:"rgba(255,255,255,0.05)", padding:"15px 30px", borderRadius:15, border:"1px dashed rgba(255,255,255,0.2)", marginBottom:20, textAlign:'center'}}>
            <div style={{fontSize:12, color:"#888", marginBottom:5}}>{T("yourRoomCode")}</div>
            <div style={{fontSize:36, fontWeight:900, letterSpacing:6, color:"#ffb300"}}>{roomCode}</div>
            <div style={{fontSize:11, color:"#666", marginTop:5}}>{Tf("shareRoomCode", { count: roomPlayers.length })}</div>
          </div>

          <div style={{...S.card, width:"100%"}}>
            <div style={{ ...S.cardHint, direction: dir }}>{T("playersInRoom")}</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {roomPlayers.map((p, i) => (
                <div key={p.id} style={{display:'flex', alignItems:'center', padding:"10px 15px", background:"rgba(0,0,0,0.2)", borderRadius:10}}>
                  <div style={{marginInlineStart:'auto', fontSize:14, fontWeight:700, color: i%2===0?'#4caf50':'#f44336'}}>
                    {i===0 ? '👑 ' : ''}{p.name} {p.id === myId ? T("you") : ''}
                  </div>
                  <div style={{fontSize:11, color:'#888'}}>{i%2===0 ? T("teamGreen") : T("teamRed")}</div>
                </div>
              ))}
              {roomPlayers.length < 4 && (
                <div style={{padding:"10px", textAlign:'center', color:'#555', border:"1px dashed rgba(255,255,255,0.1)", borderRadius:10, fontSize:12}}>
                  {T("waitingPlayers")}
                </div>
              )}
            </div>
            
            {isHost ? (
              <button className="btn-blue" style={{marginTop:15, opacity:canStart?1:0.5}} onClick={startRoomGame}>
                {roomPlayers.length===4 ? T("start2v2") : roomPlayers.length===2 ? T("start1v1") : T("needPlayers")}
              </button>
            ) : (
              <div style={{textAlign:'center', marginTop:15, color:'#ffb300', fontSize:13, fontWeight:700}}>
                {T("waitingHost")}
              </div>
            )}
          </div>

          <div className="voice-bar">
            <button className={`vbtn ${voiceOn?'von':'voff'}`} onClick={toggleVoice}>
              {voiceOn ? (muted ? T('voiceMuted') : T('voiceOn')) : T('voiceEnable')}
            </button>
            {voiceOn && <button className={`vbtn ${muted?'vmuted':'von'}`} onClick={toggleMute}>{muted ? T('mute') : T('mute')}</button>}
          </div>

          <button className="btn-gray" onClick={leaveGame} style={{marginTop:20}}>{T("leaveRoom")}</button>
        </div>
      </div>
    );
  }

  if (screen === "mm") return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={{ ...S.menuWrap, direction: dir }} className="fadeIn">
        <div className="mm-ring">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <defs><linearGradient id="mmg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1565c0"/><stop offset="100%" stopColor="#42a5f5"/></linearGradient></defs>
            <circle className="mm-track" cx="70" cy="70" r="54"/>
            <circle className="mm-prog" cx="70" cy="70" r="54"/>
          </svg>
          <div className="mm-icon mm-icon-anim">{searching ? "⚽" : "✅"}</div>
        </div>
        <div style={{fontSize:18,fontWeight:700,textAlign:"center",color:"#fff",marginTop:10}}>
          {searching ? T("searchingOpponent") : T("opponentFound")}
        </div>
        {searching && <div style={{fontSize:14,color:"#888",fontFamily:"monospace",letterSpacing:2,marginTop:6}}>
          {String(Math.floor(mmSecs/60)).padStart(2,'0')}:{String(mmSecs%60).padStart(2,'0')}
        </div>}
        <button className="btn-gray" style={{marginTop:30}} onClick={cancelSearch}>{T("cancelSearch")}</button>
      </div>
    </div>
  );

  // ── GAME SCREEN ──
  const isOnlineRoom = mode === "online-room";
  let myTurnStatus = "";
  if (winner) {
    myTurnStatus = winner === "green" ? T("greenWins") : T("redWins");
  } else if (isOnlineRoom) {
    const cp = gameOrder[turnIndex];
    myTurnStatus = cp.id === myId
      ? T("yourTurnMove")
      : Tf("playerTurn", { name: cp.name, color: cp.color === "green" ? T("colorGreen") : T("colorRed") });
  } else if (mode === "online") {
    myTurnStatus = turn === myColor ? T("yourTurnMove") : T("opponentTurn");
  } else {
    myTurnStatus = thinking ? T("aiThinking") : (turn === "green" ? T("turnGreen") : T("turnRed"));
  }

  // Render HUD Cards based on mode
  let hudContent = [];
  if (isOnlineRoom) {
    // Group players by color
    const greenTeam = gameOrder.filter(p => p.color === 'green');
    const redTeam = gameOrder.filter(p => p.color === 'red');
    const cp = gameOrder[turnIndex];

    hudContent = [
      { team: 'green', colorCode: '#4caf50', title: T('greenTeam'), players: greenTeam, isActive: !winner && turn === 'green' },
      { team: 'red', colorCode: '#f44336', title: T('redTeam'), players: redTeam, isActive: !winner && turn === 'red' }
    ].map(team => (
      <div key={team.team} style={{...S.hudCard, border:`2px solid ${team.isActive?team.colorCode:"transparent"}`, boxShadow:team.isActive?`0 0 20px ${team.colorCode}33`:"none"}}>
        <div style={{color:team.colorCode,fontWeight:900,fontSize:14, marginBottom:4}}>{team.title}</div>
        {team.players.map(p => (
          <div key={p.id} style={{fontSize:12, color: cp?.id === p.id && team.isActive ? '#fff' : '#aaa', fontWeight: cp?.id === p.id && team.isActive ? 700 : 400}}>
             {cp?.id === p.id && team.isActive ? '▶️ ' : ''}{p.name} {p.id === myId ? T("you") : ''}
          </div>
        ))}
      </div>
    ));
  } else {
    // Standard 1v1 HUD
    hudContent = ["green","red"].map(c=>{
      const active = turn===c&&!winner&&!thinking;
      const acc = c==="green"?"#4caf50":"#f44336";
      const isMe = mode === "online" && myColor === c;
      const name = mode === "online"
        ? (myColor === c ? myName : opName)
        : (c === "green" ? T("colorGreen") : (mode !== "pvp" ? T("computer") : T("colorRed")));
      return (
        <div key={c} style={{...S.hudCard, border:`2px solid ${active?acc:"transparent"}`, boxShadow:active?`0 0 20px ${acc}33`:"none"}}>
          <div style={{color:acc,fontWeight:700,fontSize:13}}>
            {c==="green"?"🟢":"🔴"} {name} {isMe ? T("you") : ""}
          </div>
          {active&&!winner&&(
            <div style={{color:"#aaa",fontSize:10,marginTop:3}} className={(thinking||(mode==="online"&&!isMe))?"blink":""}>
              {mode==="online" ? (isMe ? T("yourTurn") : T("opponentTurn")) : (thinking && c !== "green" && mode !== "pvp" ? T("thinking") : T("yourTurn"))}
            </div>
          )}
        </div>
      );
    });
  }

  // Timer percentage for display
  const maxTime = getTimerDuration();
  const timerPct = (timeLeft / maxTime) * 100;
  const timerColor = timeLeft <= 3 ? '#f44336' : timeLeft <= 5 ? '#ff9800' : '#4caf50';
  const showTimer = screen === "game" && !winner && !thinking && isMyTurnForTimer();

  return (
    <div style={{ ...S.root, direction: dir }}>
      <style>{CSS}</style>
      <audio id="remote-audio" autoPlay style={{display:'none'}}></audio>

      <div style={S.topBar}>
        <button className="btn-gray" style={{padding:"6px 12px",fontSize:11}} onClick={leaveGame}>{T("leave")}</button>
        <span style={S.hTitle}>⚽ {T("appName")} {isOnlineRoom && <span style={{color:'#ffb300', fontSize:12}}>[{roomCode}]</span>}</span>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {(mode === "pvc-g" || mode === "pvc-r") && (
            <span style={{fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:10,
              background: difficulty==="easy"?"rgba(76,175,80,0.2)":difficulty==="hard"?"rgba(244,67,54,0.2)":"rgba(255,152,0,0.2)",
              color: difficulty==="easy"?"#81c784":difficulty==="hard"?"#ef9a9a":"#ffb74d",
              border: `1px solid ${difficulty==="easy"?"rgba(76,175,80,0.3)":difficulty==="hard"?"rgba(244,67,54,0.3)":"rgba(255,152,0,0.3)"}`
            }}>
              {difficulty==="easy" ? `😊 ${T("easy")}` : difficulty==="hard" ? `💀 ${T("hard")}` : `🎯 ${T("medium")}`}
            </span>
          )}
          <span style={{color:"#888",fontSize:10}}>
            {isOnlineRoom
              ? (gameOrder.length === 4 ? T("modeRoom2v2") : T("modeRoom1v1"))
              : mode === "online" ? T("modeRandom") : mode === "pvp" ? T("modeLocal") : T("modeComputer")}
          </span>
        </div>
      </div>

      {/* Timer Bar */}
      {showTimer && (
        <div style={{width:"100%", maxWidth:740, marginBottom:10, zIndex:10}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5}}>
            <span style={{fontSize:11, color:"#888", fontWeight:600}}>{T("timeLeft")}</span>
            <span style={{fontSize:16, fontWeight:900, color: timerColor, fontFamily:"monospace",
              textShadow: timeLeft <= 3 ? `0 0 15px ${timerColor}` : "none",
              animation: timeLeft <= 3 ? "blink 0.5s ease-in-out infinite" : "none"
            }}>{timeLeft}s</span>
          </div>
          <div style={{width:"100%", height:6, background:"rgba(255,255,255,0.08)", borderRadius:6, overflow:"hidden"}}>
            <div style={{
              height:"100%", borderRadius:6,
              width: `${timerPct}%`,
              background: `linear-gradient(90deg, ${timerColor}, ${timerColor}88)`,
              transition: "width 1s linear, background 0.5s",
              boxShadow: `0 0 8px ${timerColor}66`
            }}/>
          </div>
        </div>
      )}

      <div style={S.hud}>
        {hudContent}
      </div>

      {/* Repeat warning */}
      {repeatWarning && (
        <div style={{position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          background:"rgba(244,67,54,0.95)", backdropFilter:"blur(10px)",
          color:"#fff", fontWeight:900, fontSize:15, borderRadius:16,
          padding:"16px 28px", zIndex:999, textAlign:"center",
          boxShadow:"0 10px 40px rgba(244,67,54,0.6)",
          animation:"fadeIn 0.2s ease"
        }}>
          {T("repeatWarning")}
          <div style={{fontSize:12, fontWeight:400, marginTop:4, opacity:0.85}}>{T("repeatWarningSub")}</div>
        </div>
      )}

      <div style={S.boardWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:"block",maxHeight:400,overflow:"visible"}}>
          <defs>
            <radialGradient id="bg" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#1e1e38"/><stop offset="100%" stopColor="#0d0d1c"/></radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="sglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            {NODES.map(n=>{
              const pc=board[n.id]; if(!pc) return null;
              const sel=selected===n.id; const isWin=winner&&pc===winner;
              const skinPart = pc === "green" ? activeSkin.green : activeSkin.red;
              const c = sel ? skinPart.selected : isWin ? skinPart.win : skinPart.normal;
              return (
                <radialGradient key={`gr${n.id}`} id={`gr${n.id}`} cx="33%" cy="28%" r="70%">
                  <stop offset="0%" stopColor={c[0]}/>
                  <stop offset="100%" stopColor={c[1]}/>
                </radialGradient>
              );
            })}
          </defs>

          <rect width={W} height={H} fill="url(#bg)" rx={16}/>
          <rect x={8} y={58} width={118} height={404} rx={10} fill="rgba(76,175,80,0.04)" stroke="rgba(76,175,80,0.22)" strokeWidth={1.5} strokeDasharray="7,5"/>
          <rect x={574} y={58} width={118} height={404} rx={10} fill="rgba(244,67,54,0.04)" stroke="rgba(244,67,54,0.22)" strokeWidth={1.5} strokeDasharray="7,5"/>
          <text x={67} y={46} textAnchor="middle" fill="rgba(76,175,80,0.4)" fontSize={9}>{T("redGoalZone")}</text>
          <text x={633} y={46} textAnchor="middle" fill="rgba(244,67,54,0.4)" fontSize={9}>{T("greenGoalZone")}</text>

          {EDGES.map(([a,b],i)=>{
            const na=NODES[a], nb=NODES[b];
            const isLast = lastMove&&((lastMove.from===a&&lastMove.to===b)||(lastMove.from===b&&lastMove.to===a));
            const isDiag = DIAG_SET.has(edgeKey(a,b));
            return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={isLast?"rgba(255,215,0,0.7)":isDiag?"rgba(160,140,255,0.22)":"rgba(255,255,255,0.13)"} strokeWidth={isLast?3:isDiag?1.6:2.4} strokeDasharray={isDiag&&!isLast?"5,4":"none"} strokeLinecap="round" />;
          })}

          <ellipse cx={ECX} cy={ECY} rx={ERX} ry={ERY} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={2.5}/>
          <line x1={ECX} y1={ECY-ERY+10} x2={ECX} y2={ECY+ERY-10} stroke="rgba(255,255,255,0.05)" strokeWidth={1.5}/>
          <line x1={ECX-ERX+10} y1={ECY} x2={ECX+ERX-10} y2={ECY} stroke="rgba(255,255,255,0.05)" strokeWidth={1.5}/>

          {valids.map(nid=>{
            const n=NODES[nid];
            return (
              <g key={`vm${nid}`}>
                <circle cx={n.x} cy={n.y} r={30} fill="rgba(255,215,0,0.07)" stroke="rgba(255,215,0,0.65)" strokeWidth={2} strokeDasharray="6,4" className="pulse-a"/>
                <circle cx={n.x} cy={n.y} r={6} fill="rgba(255,215,0,0.55)"/>
              </g>
            );
          })}

          {NODES.map(node=>{
            const pc=board[node.id];
            const sel=selected===node.id; const isVM=valids.includes(node.id);
            const isLT=lastMove?.to===node.id; const isWin=!!winner&&pc===winner;
            const R=pc?22:9;
            const stroke = pc ? (sel||isWin ? "#ffd700" : (pc === "green" ? activeSkin.green.accent : activeSkin.red.accent)) : "rgba(255,255,255,0.13)";
            const sw = sel||isWin ? 3 : 2;
            const filt = sel?"url(#sglow)":isWin?"url(#glow)":isLT?"url(#glow)":"none";
            
            let clickable = false;
            if (!winner && !thinking) {
               if (isOnlineRoom) {
                 const cp = gameOrder[turnIndex];
                 if (cp && cp.id === myId) {
                    clickable = (pc === cp.color || isVM);
                 }
               } else if (mode === "online") {
                 clickable = (turn === myColor && (pc === turn || isVM));
               } else {
                 clickable = (pc===turn||isVM);
               }
            }

            return (
              <g key={node.id} onClick={()=>handleClick(node.id)} style={{cursor:clickable?"pointer":"default"}}>
                {pc&&<circle cx={node.x} cy={node.y+5} r={R+2} fill={pc==="green"?"rgba(76,175,80,0.18)":"rgba(244,67,54,0.18)"}/>}
                <circle cx={node.x} cy={node.y} r={R} fill={pc?`url(#gr${node.id})`:"rgba(255,255,255,0.03)"} stroke={stroke} strokeWidth={sw} filter={filt} className={isWin?"winb":""}/>
                {pc&&<circle cx={node.x-6} cy={node.y-6} r={5} fill="rgba(255,255,255,0.28)"/>}
                {!pc&&<circle cx={node.x} cy={node.y} r={2.5} fill="rgba(255,255,255,0.18)"/>}
                {pc && activeSkinId !== "classic" && (
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize={14} style={{ pointerEvents: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}>
                    {pc === "green" ? activeSkin.green.emoji : activeSkin.red.emoji}
                  </text>
                )}
                {sel&&<circle cx={node.x} cy={node.y} r={R+7} fill="none" stroke="rgba(255,215,0,0.4)" strokeWidth={2} strokeDasharray="5,3" className="spinr"/>}
              </g>
            );
          })}
        </svg>
      </div>

      <div className={`sbar ${winner?'win':''}`} style={{marginTop:12, width:"100%", maxWidth:740}}>
        {myTurnStatus}
      </div>

      {(mode === "online" || isOnlineRoom) && (
        <>
          <div className="voice-bar">
            <button className={`vbtn ${voiceOn?'von':'voff'}`} onClick={toggleVoice}>
              {voiceOn ? (muted ? T('voiceMuted') : T('voiceOn')) : T('voiceEnable')}
            </button>
            {voiceOn && <button className={`vbtn ${muted?'vmuted':'von'}`} onClick={toggleMute}>{muted ? T('mute') : T('unmuteSelf')}</button>}
            
            {isOnlineRoom && voiceOn && gameOrder.length === 4 && (
              <button className={`vbtn ${voiceChannel==='team'?'von':'voff'}`} onClick={() => setVoiceChannel(v => v==='all'?'team':'all')}>
                {voiceChannel==='team' ? T('teamOnly') : T('everyone')}
              </button>
            )}

            {isOnlineRoom ? (
               <div style={{display:'flex', gap:6, marginInlineStart:'auto'}}>
                 {Object.keys(peerSpeaking).map(id => peerSpeaking[id] && (
                    <span key={id} className="peer-vs peer-speaking" style={{padding:"2px 6px"}}>🎤 {roomPlayers.find(p=>p.id===id)?.name || T('friend')}</span>
                 ))}
               </div>
            ) : (
               <span className={`peer-vs ${peerVoice?'peer-speaking':''}`}>{T('opponentLabel')} {peerVoice ? T('opponentSpeaking') : T('noVoice')}</span>
            )}
          </div>
          
          <div className="chat-wrap">
            <div className="chat-msgs">
              {chatMsgs.map(m => (
                m.side === "sys" ? <div key={m.id} className="cmsg-sys">{m.text}</div> :
                <div key={m.id} className={`cmsg ${m.side}`}>
                  <div className="cmsg-who" style={{color:m.color==='green'?'#4caf50':'#f44336'}}>{m.name}</div>
                  <div className="cmsg-bub">{m.text}</div>
                </div>
              ))}
              <div ref={msgsEndRef} />
            </div>
            <div className="chat-inp-row">
              <input className="chat-inp" value={chatInp} onChange={e=>setChatInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder={T("chatPlaceholder")} maxLength="100"/>
              <button className="btn-blue" style={{padding:"6px 14px", borderRadius:8}} onClick={sendChat}>←</button>
            </div>
          </div>
        </>
      )}

      <div style={{display:"flex",gap:10,marginTop:12,justifyContent:"center"}}>
        <button className="btn-blue" onClick={reqRestart}>{T("restartGame")}</button>
        {(mode !== "online" && !isOnlineRoom) && <button className="btn-gray" onClick={()=>setScreen("menu")}>{T("menu")}</button>}
      </div>

      {restartReqFrom && (
        <div className="overlay">
          <div className="overlay-box">
            <div className="overlay-icon">🔄</div>
            <div className="overlay-title">{T("restartRequest")}</div>
            <div className="overlay-sub">{Tf("restartRequestSub", { name: restartReqFrom })}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn-blue" onClick={()=>{
                setRestartReqFrom(null);
                handleRestart();
                if(gameChRef.current) gameChRef.current.send({type:'broadcast',event:'rst_ack',payload:{}});
                if(roomChRef.current) roomChRef.current.send({type:'broadcast',event:'rst_ack_room',payload:{}});
              }}>{T("agree")}</button>
              <button className="btn-gray" onClick={()=>setRestartReqFrom(null)}>{T("decline")}</button>
            </div>
          </div>
        </div>
      )}

      {discoMsg && (
        <div className="overlay">
          <div className="overlay-box">
            <div className="overlay-icon">📡</div>
            <div className="overlay-title">{T("disconnected")}</div>
            <div className="overlay-sub">{discoMsg}</div>
            <button className="btn-gray" onClick={leaveGame}>🏠 {T("backMenu")}</button>
          </div>
        </div>
      )}

      {winner && (
        <WinScreen
          winner={winner}
          mode={mode}
          aiColor={aiColor}
          moveCount={movesCount}
          onRestart={reqRestart}
          onMenu={leaveGame}
          lang={lang}
          T={T}
          coinsAwarded={coinsAwarded}
          activeSkin={activeSkinId}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════
const S = {
  root:{
    minHeight:"100vh", background:"#050508", position:"relative", overflow:"hidden",
    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",
    fontFamily:"'Cairo',sans-serif",padding:"14px 12px",userSelect:"none", WebkitUserSelect:"none",
  },
  menuWrap:{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:460,paddingTop:20, zIndex:10},
  logo:{fontSize:54,marginBottom:8,filter:"drop-shadow(0 0 20px rgba(100,150,255,0.6))"},
  title:{color:"#fff",fontSize:"clamp(28px,6vw,42px)",fontWeight:900,margin:"0 0 6px", textShadow:"0 0 30px rgba(100,150,255,0.5)"},
  sub:{color:"#88a",fontSize:13,margin:"0 0 22px",textAlign:"center", letterSpacing:1},
  card:{
    background:"rgba(25, 25, 35, 0.4)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)",
    border:"1px solid rgba(255,255,255,0.08)", borderRadius:24,padding:"24px 20px",width:"100%", 
    display:"flex",flexDirection:"column",gap:12, boxShadow:"0 20px 60px rgba(0,0,0,0.6)",marginBottom:18,
  },
  cardHint:{color:"#778",fontSize:12,direction:"rtl",alignSelf:"flex-end",marginBottom:4},
  modeBtn:{
    width:"100%",display:"flex",alignItems:"center",gap:16, border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:16,padding:"16px 20px", color:"#fff",cursor:"pointer",
    boxShadow:"0 8px 25px rgba(0,0,0,0.3)", transition:"all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  mBtnT:{fontWeight:800,fontSize:15,fontFamily:"Cairo,sans-serif",direction:"rtl",textAlign:"right", textShadow:"0 2px 4px rgba(0,0,0,0.3)"},
  mBtnS:{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:4,fontFamily:"Cairo,sans-serif",direction:"rtl",textAlign:"right"},
  topBar:{ display:"flex",alignItems:"center",justifyContent:"space-between", width:"100%",maxWidth:740,marginBottom:16,gap:8, zIndex:10 },
  hTitle:{color:"#fff",fontWeight:900,fontSize:"clamp(16px,4vw,22px)", textShadow:"0 0 15px rgba(255,255,255,0.3)"},
  hud:{display:"flex",gap:12,marginBottom:16,width:"100%",maxWidth:740, zIndex:10},
  hudCard:{ flex:1,background:"rgba(20,20,30,0.5)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:16, padding:"12px 14px",textAlign:"center",transition:"all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" },
  boardWrap:{
    background:"rgba(15,15,25,0.6)", backdropFilter:"blur(20px)", borderRadius:24,padding:"16px 14px",
    border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 30px 90px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.5)", width:"100%",maxWidth:740, zIndex:10,
  },
  lbl:{color:"#88a",fontSize:12,display:"block",marginBottom:6,textAlign:"right", fontWeight:600}
};

const CSS=`
  /* Animated Background Orbs */
  body::before, body::after { content:''; position:fixed; border-radius:50%; filter:blur(80px); z-index:0; opacity:0.4; animation:float 15s infinite alternate; }
  body::before { width:300px; height:300px; background:#1565c0; top:-100px; left:-100px; }
  body::after { width:400px; height:400px; background:#4a148c; bottom:-150px; right:-100px; animation-delay:-7s; }
  @keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(50px, 50px) scale(1.2); } }

  .fadeIn{animation:fadeIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);}
  @keyframes fadeIn{from{opacity:0;transform:translateY(20px) scale(0.95)}to{opacity:1;transform:none}}
  .modeBtn:hover{transform:translateY(-3px) scale(1.02); box-shadow:0 12px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.1);}
  .pulse-a{animation:pulseA 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;}
  @keyframes pulseA{0%,100%{opacity:1; transform:scale(1)}50%{opacity:0.4; transform:scale(1.05)}}
  .blink{animation:blink 1s ease-in-out infinite;}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
  .winb{animation:winb 0.6s ease infinite alternate;}
  @keyframes winb{from{transform:translateY(0) scale(1)}to{transform:translateY(-6px) scale(1.1)}}
  .spinr{animation:spinr 3s linear infinite;transform-origin:center;transform-box:fill-box;}
  @keyframes spinr{from{stroke-dashoffset:0}to{stroke-dashoffset:50}}
  
  .sbar{border-radius:14px;padding:12px 30px;font-size:15px;font-weight:800;text-align:center;min-width:240px;transition:all 0.4s;background:rgba(255,255,255,.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);box-shadow:0 10px 30px rgba(0,0,0,0.3); z-index:10;}
  .sbar.win{border-color:rgba(255,215,0,.8);background:rgba(255,215,0,.1);animation:wgl 1s ease-in-out infinite alternate;}
  @keyframes wgl{from{box-shadow:0 0 15px rgba(255,215,0,.3)}to{box-shadow:0 0 50px rgba(255,215,0,.8)}}

  .mm-ring{position:relative;width:150px;height:150px;margin:10px auto;}
  .mm-ring svg{position:absolute;top:0;left:0;filter:drop-shadow(0 0 10px rgba(66,165,245,0.5));}
  .mm-icon{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:52px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.4));}
  .mm-icon-anim{animation:mmico 1.5s ease-in-out infinite;}
  @keyframes mmico{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.15)}}
  .mm-track{fill:none;stroke:rgba(255,255,255,.05);stroke-width:8;}
  .mm-prog{fill:none;stroke:url(#mmg);stroke-width:8;stroke-linecap:round;stroke-dasharray:339;transform-origin:70px 70px;animation:mmspin 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;}
  @keyframes mmspin{0%{stroke-dashoffset:339;transform:rotate(-90deg);}50%{stroke-dashoffset:80;transform:rotate(180deg);}100%{stroke-dashoffset:339;transform:rotate(450deg);}}
  
  .inp{width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 16px;color:#fff;font-family:'Cairo',sans-serif;font-size:15px;outline:none;text-align:right;transition:all 0.2s;}
  .inp:focus{border-color:rgba(100,150,255,.6);box-shadow:0 0 0 4px rgba(100,150,255,.15), inset 0 0 10px rgba(0,0,0,0.5);}
  .inp::placeholder{color:#667;}

  .btn-blue{background:linear-gradient(135deg,#1e88e5,#1565c0);color:#fff;border:none;border-radius:12px;padding:12px 24px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(21,101,192,.4);transition:all 0.2s;}
  .btn-blue:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(21,101,192,.6);filter:brightness(1.1);}
  .btn-blue:active{transform:translateY(1px);box-shadow:0 2px 10px rgba(21,101,192,.4);}
  
  .btn-gray{background:rgba(255,255,255,.05);backdrop-filter:blur(5px);color:#ccc;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 24px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.2s;}
  .btn-gray:hover{background:rgba(255,255,255,.1);color:#fff;}

  .chat-wrap{width:100%;max-width:740px;background:rgba(15,15,22,.7);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08);border-radius:20px;overflow:hidden;margin-top:16px;box-shadow:0 12px 40px rgba(0,0,0,0.6); z-index:10;}
  .chat-head{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.4);}
  .chat-head-txt{font-size:14px;font-weight:800;color:#eee;}
  .chat-msgs{height:160px;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;}
  .chat-msgs::-webkit-scrollbar{width:6px;}
  .chat-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px;}
  .cmsg{display:flex;flex-direction:column;max-width:85%;}
  .cmsg.mine{align-self:flex-start;}
  .cmsg.theirs{align-self:flex-end;}
  .cmsg-who{font-size:11px;margin-bottom:4px;font-weight:700;}
  .cmsg-bub{border-radius:14px;padding:10px 14px;font-size:13.5px;line-height:1.5;box-shadow:0 4px 12px rgba(0,0,0,0.3);}
  .cmsg.mine .cmsg-bub{background:linear-gradient(135deg,rgba(41,121,255,.25),rgba(21,101,192,.2));border-bottom-right-radius:4px;border:1px solid rgba(41,121,255,0.2);}
  .cmsg.theirs .cmsg-bub{background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border-bottom-left-radius:4px;border:1px solid rgba(255,255,255,0.05);}
  .cmsg-sys{text-align:center;font-size:12px;color:#88a;font-weight:600;padding:6px 0;background:rgba(0,0,0,.3);border-radius:10px;margin:6px 15%;}
  .chat-inp-row{display:flex;gap:10px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.2);}
  .chat-inp{flex:1;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 14px;color:#fff;font-family:'Cairo',sans-serif;font-size:14px;outline:none;text-align:right;transition:all 0.2s;}
  .chat-inp:focus{border-color:rgba(100,150,255,.5);box-shadow:inset 0 0 8px rgba(0,0,0,0.5);}

  .voice-bar{display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:rgba(20,20,30,.6);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,.08);margin-top:16px;width:100%;max-width:740px;box-shadow:0 8px 30px rgba(0,0,0,0.4); z-index:10;}
  .vbtn{display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 16px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:13px;font-weight:800;transition:all .2s;}
  .vbtn.voff{background:rgba(0,0,0,.3);color:#aaa;}
  .vbtn.von{background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;border-color:rgba(76,175,80,0.3);box-shadow:0 4px 15px rgba(76,175,80,0.3);}
  .vbtn.vmuted{background:linear-gradient(135deg,#c62828,#b71c1c);color:#fff;border-color:rgba(244,67,54,0.3);box-shadow:0 4px 15px rgba(244,67,54,0.3);}
  .vbtn:hover{filter:brightness(1.1);transform:translateY(-1px);}
  .peer-vs{font-size:12px;color:#88a;margin-right:auto;padding:6px 12px;border-radius:8px;transition:all 0.3s;font-weight:600;}
  .peer-speaking{color:#fff;background:linear-gradient(135deg,rgba(76,175,80,0.3),rgba(46,125,50,0.3));border:1px solid rgba(76,175,80,0.4);animation:voicePulse 1.2s infinite;}
  @keyframes voicePulse{0%{box-shadow:0 0 0 0 rgba(76,175,80,0.5)}70%{box-shadow:0 0 0 10px rgba(76,175,80,0)}100%{box-shadow:0 0 0 0 rgba(76,175,80,0)}}

  .overlay{position:fixed;inset:0;background:rgba(0,0,5,.85);backdrop-filter:blur(8px);z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:fadeIn .3s ease;}
  .overlay-box{background:linear-gradient(145deg,#12121e,#0a0a12);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:36px 30px;text-align:center;max-width:340px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.8), inset 0 0 30px rgba(255,255,255,0.02);}
  .overlay-icon{font-size:54px;margin-bottom:14px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5));}
  .overlay-title{font-size:20px;font-weight:900;margin-bottom:8px;color:#fff;}
  .overlay-sub{font-size:13px;color:#88a;margin-bottom:24px;line-height:1.6;}
`;