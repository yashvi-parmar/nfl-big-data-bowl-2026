import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Filter, Download } from 'lucide-react';

const NFLPlayVisualizer = () => {
  const [allPlays, setAllPlays] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [filteredPlays, setFilteredPlays] = useState([]);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const parseCSV = (text) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = values[i]?.trim();
        });
        return obj;
      });
    
    return data;
  };

  const parseCSVData = (inputData, outputData, suppData) => {
    const playMap = new Map();
    
    // Group input data by game and play
    inputData.forEach(row => {
      const key = `${row.game_id}_${row.play_id}`;
      if (!playMap.has(key)) {
        playMap.set(key, {
          gameId: row.game_id,
          playId: row.play_id,
          inputFrames: [],
          outputFrames: [],
          playInfo: null
        });
      }
      playMap.get(key).inputFrames.push(row);
    });
    
    // Add output frames
    outputData.forEach(row => {
      const key = `${row.game_id}_${row.play_id}`;
      if (playMap.has(key)) {
        playMap.get(key).outputFrames.push(row);
      }
    });
    
    // Add supplementary data
    suppData.forEach(row => {
      const key = `${row.game_id}_${row.play_id}`;
      if (playMap.has(key)) {
        playMap.get(key).playInfo = row;
      }
    });
    
    // Convert to play objects with frames
    const plays = [];
    const gameSet = new Set();
    
    playMap.forEach((playData, key) => {
      gameSet.add(playData.gameId);
      
      // Combine and sort frames
      const allFrames = [
        ...playData.inputFrames.map(f => ({ ...f, source: 'input' })),
        ...playData.outputFrames.map(f => ({ ...f, source: 'output' }))
      ].sort((a, b) => parseFloat(a.frame_id) - parseFloat(b.frame_id));
      
      // Group by frame_id
      const frameMap = new Map();
      allFrames.forEach(row => {
        const frameId = parseFloat(row.frame_id);
        if (!frameMap.has(frameId)) {
          frameMap.set(frameId, {
            frameId: frameId,
            players: [],
            ball: null,
            separation: 0
          });
        }
        
        const frame = frameMap.get(frameId);
        
        if (row.display_name === 'football' || row.nfl_id === 'ball' || !row.player_role) {
          frame.ball = {
            x: parseFloat(row.x),
            y: parseFloat(row.y)
          };
        } else {
          frame.players.push({
            x: parseFloat(row.x),
            y: parseFloat(row.y),
            role: row.player_role || 'other',
            position: row.player_position || '',
            side: row.player_side || '',
            name: row.player_name || row.display_name || '',
            nflId: row.nfl_id,
            jersey: row.jersey_number || row.jersey || '',
            speed: parseFloat(row.s) || 0,
            acceleration: parseFloat(row.a) || 0,
            direction: parseFloat(row.dir) || 0,
            orientation: parseFloat(row.o) || 0
          });
        }
      });
      
      // Calculate separation for each frame
      frameMap.forEach((frame) => {
        const wr = frame.players.find(p => p.role === 'Targeted Receiver');
        const defenders = frame.players.filter(p => p.role === 'Defensive Coverage');
        
        if (wr && defenders.length > 0) {
          const distances = defenders.map(def => 
            Math.sqrt(Math.pow(wr.x - def.x, 2) + Math.pow(wr.y - def.y, 2))
          );
          frame.separation = Math.min(...distances);
        }
      });
      
      const frames = Array.from(frameMap.values());
      
      if (frames.length > 0) {
        const wr = frames[0].players.find(p => p.role === 'Targeted Receiver');
        const qb = frames[0].players.find(p => p.role === 'Passer');
        
        plays.push({
          gameId: playData.gameId,
          playId: playData.playId,
          description: playData.playInfo?.route_of_targeted_receiver || `Play ${playData.playId}`,
          passResult: playData.playInfo?.pass_result || 'N/A',
          wrName: wr?.name || 'Unknown',
          wrJersey: wr?.jersey || '',
          wrPosition: wr?.position || 'WR',
          qbName: qb?.name || 'Unknown',
          qbJersey: qb?.jersey || '',
          yardsToGo: playData.playInfo?.yards_to_go || '',
          down: playData.playInfo?.down || '',
          quarter: playData.playInfo?.quarter || '',
          yardsGained: playData.playInfo?.yards_gained || '',
          passLength: playData.playInfo?.pass_length || '',
          targetedYardLine: playData.playInfo?.targeted_yard_line || '',
          frames: frames
        });
      }
    });
    
    const gameList = Array.from(gameSet).map(gameId => ({
      gameId: gameId
    }));
    
    return { plays, games: gameList };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [inputRes, outputRes, suppRes] = await Promise.all([
          fetch('/data/input_all.csv'),
          fetch('/data/output_all.csv'),
          fetch('/data/supplementary_data.csv')
        ]);
        
        if (!inputRes.ok || !outputRes.ok || !suppRes.ok) {
          throw new Error('Failed to load data files. Make sure CSV files are in public/data/ folder');
        }
        
        const [inputText, outputText, suppText] = await Promise.all([
          inputRes.text(),
          outputRes.text(),
          suppRes.text()
        ]);
        
        const inputData = parseCSV(inputText);
        const outputData = parseCSV(outputText);
        const suppData = parseCSV(suppText);
        
        const { plays, games } = parseCSVData(inputData, outputData, suppData);
        
        setAllPlays(plays);
        setGames(games);
        
        if (games.length > 0) {
          setSelectedGame(games[0].gameId);
          setFilteredPlays(plays.filter(p => p.gameId === games[0].gameId));
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (selectedGame && allPlays.length > 0) {
      const plays = allPlays.filter(p => p.gameId === selectedGame);
      setFilteredPlays(plays);
      setCurrentPlayIndex(0);
      setFrame(0);
      setIsPlaying(false);
    }
  }, [selectedGame, allPlays]);

  useEffect(() => {
    if (!isPlaying || filteredPlays.length === 0) return;
    
    const currentPlay = filteredPlays[currentPlayIndex];
    if (!currentPlay) return;

    const interval = setInterval(() => {
      setFrame(prev => {
        if (prev >= currentPlay.frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);
    
    return () => clearInterval(interval);
  }, [isPlaying, currentPlayIndex, filteredPlays, playSpeed]);

  useEffect(() => {
    if (filteredPlays.length === 0 || !canvasRef.current) return;
    
    const currentPlay = filteredPlays[currentPlayIndex];
    if (!currentPlay || !currentPlay.frames[frame]) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Draw field background
    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, width, height);

    // Draw yard lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw hash marks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    [width * 0.4, width * 0.6].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    const currentFrame = currentPlay.frames[frame];
    const initialSep = currentPlay.frames[0].separation;
    const sepGain = currentFrame.separation - initialSep;

    const wrTarget = currentFrame.players.find(p => p.role === 'Targeted Receiver');
    const defenders = currentFrame.players.filter(p => p.role === 'Defensive Coverage');
    const qb = currentFrame.players.find(p => p.role === 'Passer');

    // Draw players
    currentFrame.players.forEach(player => {
      const x = (player.x / 120) * width;
      const y = (player.y / 53.3) * height;

      let fillColor, strokeColor, size;
      
      if (player.role === 'Targeted Receiver') {
        fillColor = '#3b82f6';
        strokeColor = '#60a5fa';
        size = 12;
      } else if (player.role === 'Defensive Coverage') {
        fillColor = '#ef4444';
        strokeColor = '#f87171';
        size = 10;
      } else if (player.role === 'Passer') {
        fillColor = '#60a5fa';
        strokeColor = '#93c5fd';
        size = 11;
      } else if (player.side === wrTarget?.side) {
        fillColor = '#60a5fa';
        strokeColor = '#93c5fd';
        size = 8;
      } else {
        fillColor = '#f87171';
        strokeColor = '#fca5a5';
        size = 8;
      }

      // Draw player circle
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw jersey number inside circle for key players
      if (player.jersey && (player.role === 'Targeted Receiver' || player.role === 'Passer' || player.role === 'Defensive Coverage')) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.jersey, x, y);
      }

      // Draw labels and names above key players
      if (player.role === 'Targeted Receiver') {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const displayName = player.name ? player.name.split(' ').pop() : 'WR';
        ctx.fillText(displayName, x, y - 16);
        
        // Draw speed indicator
        if (player.speed > 0) {
          ctx.fillStyle = '#10b981';
          ctx.font = '8px sans-serif';
          ctx.fillText(`${player.speed.toFixed(1)} mph`, x, y + 20);
        }
      } else if (player.role === 'Passer') {
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const displayName = player.name ? player.name.split(' ').pop() : 'QB';
        ctx.fillText(displayName, x, y - 16);
      } else if (player.role === 'Defensive Coverage') {
        ctx.fillStyle = '#fca5a5';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const displayName = player.name ? player.name.split(' ').pop() : 'DEF';
        ctx.fillText(displayName, x, y - 14);
      }
    });

    // Draw separation line
    if (wrTarget && defenders.length > 0) {
      const closestDef = defenders.reduce((closest, def) => {
        const dist = Math.sqrt(Math.pow(wrTarget.x - def.x, 2) + Math.pow(wrTarget.y - def.y, 2));
        return dist < closest.dist ? { player: def, dist } : closest;
      }, { player: defenders[0], dist: Infinity });

      const x1 = (wrTarget.x / 120) * width;
      const y1 = (wrTarget.y / 53.3) * height;
      const x2 = (closestDef.player.x / 120) * width;
      const y2 = (closestDef.player.y / 53.3) * height;
      
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw separation distance at midpoint
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(midX - 20, midY - 8, 40, 16);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${currentFrame.separation.toFixed(1)}yd`, midX, midY);
    }

    // ===== TOP LEFT: Play Info Panel =====
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(10, 10, 180, 110);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 180, 110);
    
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('PLAY INFO', 20, 18);
    
    ctx.fillStyle = 'white';
    ctx.font = '10px sans-serif';
    ctx.fillText(`Game: ${currentPlay.gameId}`, 20, 36);
    ctx.fillText(`Play: ${currentPlay.playId}`, 20, 50);
    
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`Route: ${currentPlay.description}`, 20, 68);
    
    ctx.fillStyle = currentPlay.passResult === 'C' ? '#10b981' : '#ef4444';
    ctx.font = 'bold 11px sans-serif';
    const resultText = currentPlay.passResult === 'C' ? 'COMPLETE' : 
                       currentPlay.passResult === 'I' ? 'INCOMPLETE' : 
                       currentPlay.passResult === 'IN' ? 'INTERCEPTION' : currentPlay.passResult;
    ctx.fillText(`Result: ${resultText}`, 20, 86);
    
    if (currentPlay.down && currentPlay.yardsToGo) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${currentPlay.down} & ${currentPlay.yardsToGo}`, 20, 104);
    }

    // ===== TOP RIGHT: Separation Stats Panel =====
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(width - 160, 10, 150, 100);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(width - 160, 10, 150, 100);
    
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SEPARATION', width - 150, 18);
    
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${currentFrame.separation.toFixed(1)}`, width - 150, 42);
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.fillText('YDS', width - 85, 52);
    
    ctx.fillStyle = sepGain >= 0 ? '#10b981' : '#ef4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${sepGain >= 0 ? '+' : ''}${sepGain.toFixed(1)} from snap`, width - 150, 75);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.fillText(`Initial: ${initialSep.toFixed(1)} yds`, width - 150, 95);

    // ===== BOTTOM LEFT: Player Info Panel =====
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(10, height - 90, 200, 80);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, height - 90, 200, 80);
    
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TARGET', 20, height - 76);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(currentPlay.wrName || 'Unknown', 20, height - 58);
    
    if (currentPlay.wrJersey) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px sans-serif';
      ctx.fillText(`#${currentPlay.wrJersey} • ${currentPlay.wrPosition}`, 20, height - 42);
    }
    
    if (wrTarget && wrTarget.speed > 0) {
      ctx.fillStyle = '#10b981';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Speed: ${wrTarget.speed.toFixed(1)} mph`, 20, height - 26);
    }
    
    // QB info on same panel
    if (currentPlay.qbName && currentPlay.qbName !== 'Unknown') {
      ctx.fillStyle = '#93c5fd';
      ctx.font = '10px sans-serif';
      ctx.fillText(`QB: ${currentPlay.qbName}`, 120, height - 58);
    }

    // ===== BOTTOM RIGHT: Timeline Panel =====
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(width - 140, height - 70, 130, 60);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.strokeRect(width - 140, height - 70, 130, 60);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TIMELINE', width - 75, height - 56);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${(currentFrame.frameId / 10).toFixed(1)}s`, width - 75, height - 32);
    
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px sans-serif';
    ctx.fillText(`Frame ${frame + 1} / ${currentPlay.frames.length}`, width - 75, height - 18);

    // ===== Progress Bar at Very Bottom =====
    const progressBarY = height - 8;
    const progressBarWidth = width - 20;
    const progress = (frame + 1) / currentPlay.frames.length;
    
    ctx.fillStyle = 'rgba(107, 114, 128, 0.5)';
    ctx.fillRect(10, progressBarY, progressBarWidth, 4);
    
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(10, progressBarY, progressBarWidth * progress, 4);

    // ===== Legend (Bottom Center) =====
    const legendY = height - 70;
    const legendX = width / 2 - 100;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(legendX, legendY, 200, 50);
    
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';
    
    // Row 1
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(legendX + 12, legendY + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('Target WR', legendX + 22, legendY + 15);
    
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(legendX + 90, legendY + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('Defenders', legendX + 100, legendY + 15);
    
    // Row 2
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(legendX + 12, legendY + 30, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('Offense', legendX + 22, legendY + 33);
    
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(legendX + 90, legendY + 30, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('Defense', legendX + 100, legendY + 33);
    
    // Separation line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(legendX + 150, legendY + 20);
    ctx.lineTo(legendX + 180, legendY + 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'white';
    ctx.fillText('Sep', legendX + 155, legendY + 33);

  }, [frame, currentPlayIndex, filteredPlays]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleReset = () => { setFrame(0); setIsPlaying(false); };
  const handlePrevPlay = () => {
    if (currentPlayIndex > 0) {
      setCurrentPlayIndex(currentPlayIndex - 1);
      setFrame(0);
      setIsPlaying(false);
    }
  };
  const handleNextPlay = () => {
    if (currentPlayIndex < filteredPlays.length - 1) {
      setCurrentPlayIndex(currentPlayIndex + 1);
      setFrame(0);
      setIsPlaying(false);
    }
  };

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    recordedChunksRef.current = [];
    
    const stream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const currentPlay = filteredPlays[currentPlayIndex];
      a.download = `play_${currentPlay.gameId}_${currentPlay.playId}_${currentPlay.description}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    setIsPlaying(true);
    setFrame(0);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (isRecording && filteredPlays.length > 0) {
      const currentPlay = filteredPlays[currentPlayIndex];
      if (frame >= currentPlay.frames.length - 1) {
        stopRecording();
      }
    }
  }, [frame, isRecording, currentPlayIndex, filteredPlays]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-2">Loading NFL tracking data...</div>
          <div className="text-sm text-gray-400">Please wait while we load the data files</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center max-w-md">
          <div className="text-xl mb-2 text-red-400">Error Loading Data</div>
          <div className="text-sm text-gray-400 mb-4">{error}</div>
          <div className="text-xs text-gray-500 text-left bg-gray-800 p-4 rounded">
            <p className="mb-2">Make sure your CSV files are in:</p>
            <code>public/data/input_all.csv</code><br/>
            <code>public/data/output_all.csv</code><br/>
            <code>public/data/supplementary_data.csv</code>
          </div>
        </div>
      </div>
    );
  }

  if (filteredPlays.length === 0) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">No plays found</div>;
  }

  const currentPlay = filteredPlays[currentPlayIndex];

  return (
    <div className="w-full min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-1">NFL Play-by-Play Analyzer</h1>
          <p className="text-sm text-gray-400">Separation Tracking & Route Visualization</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Game</label>
          <select
            value={selectedGame || ''}
            onChange={(e) => setSelectedGame(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          >
            {games.map(game => (
              <option key={game.gameId} value={game.gameId}>
                Game {game.gameId}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Play {currentPlayIndex + 1} of {filteredPlays.length}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPlay}
                disabled={currentPlayIndex === 0}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextPlay}
                disabled={currentPlayIndex === filteredPlays.length - 1}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-lg font-semibold">{currentPlay.description}</div>
          <div className="text-sm text-gray-400">
            Game {currentPlay.gameId} • Play {currentPlay.playId} • {currentPlay.wrName} • Result: {currentPlay.passResult}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              className="w-full rounded-lg shadow-xl"
            />
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                title="Reset"
                disabled={isRecording}
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handlePlayPause}
                className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                title={isPlaying ? 'Pause' : 'Play'}
                disabled={isRecording}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="p-2 bg-red-600 hover:bg-red-500 rounded-lg flex items-center gap-2"
                  title="Record Video"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-xs">Record</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="p-2 bg-red-600 animate-pulse rounded-lg flex items-center gap-2"
                  title="Stop Recording"
                >
                  <div className="w-3 h-3 bg-white rounded-full" />
                  <span className="text-xs">Recording...</span>
                </button>
              )}
              
              <input
                type="range"
                min="0"
                max={currentPlay.frames.length - 1}
                value={frame}
                onChange={(e) => setFrame(parseInt(e.target.value))}
                className="flex-1"
                disabled={isRecording}
              />
              <div className="text-xs text-gray-400 w-24 text-right">
                {(currentPlay.frames[frame]?.frameId / 10 || 0).toFixed(1)}s
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400">Speed:</label>
              <input
                type="range"
                min="50"
                max="300"
                step="50"
                value={playSpeed}
                onChange={(e) => setPlaySpeed(parseInt(e.target.value))}
                className="flex-1"
                disabled={isRecording}
              />
              <span className="text-xs text-gray-400 w-16">{(1000/playSpeed).toFixed(1)}x</span>
            </div>
            
            {isRecording && (
              <div className="text-xs text-yellow-400 text-center">
                Recording will auto-stop when animation completes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFLPlayVisualizer;