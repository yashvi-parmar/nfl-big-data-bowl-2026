import React, { useEffect, useState, useMemo, useRef } from 'react';

const normalizeName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/\./g, '').replace(/[^a-z\s-]/g, '').replace(/\s+/g, '-');
};

const RouteComparisonVisualizer = () => {
  const [data, setData] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [minTargets] = useState(50);
  
  const [activeFeature, setActiveFeature] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTTT, setCurrentTTT] = useState(3.5);
  const [currentDefSpeed, setCurrentDefSpeed] = useState(1.3);
  const [recordMode, setRecordMode] = useState(false);
  const [countdown, setCountdown] = useState(null);
  
  const [dataRanges, setDataRanges] = useState({ 
    tttMin: 2.5, tttMax: 3.5, 
    defMin: 1.3, defMax: 1.8 
  });
  
  const animationRef = useRef(null);
  const timeoutsRef = useRef([]);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  };

  const addTimeout = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  // Chart dimensions - WIDE aspect ratio for video
  const W = 1400;
  const H = 700;
  const P = 90;

  useEffect(() => {
    fetch('/data/elite_leaderboard3.csv')
      .then(res => res.text())
      .then(text => {
        const [header, ...rows] = text.trim().split('\n');
        const cols = header.split(',');
        const parsed = rows.map(r => {
          const v = r.split(',');
          const row = {};
          cols.forEach((c, i) => (row[c] = v[i]));
          if (!row.player_name) return null;
          return {
            player: row.player_name,
            wos: +row.Advanced_WOS,
            exp: +row.exp_sep_xgb,
            targets: +row.play_id,
            sep_at_arrival: +row.sep_at_arrival,
            pass_length: +row.pass_length,
            time_to_throw: +row.time_to_throw,
            def_avg_speed: +row.def_avg_speed,
            img: `/headshots/${normalizeName(row.player_name)}.jpg`
          };
        });
        const validData = parsed.filter(d => d && !isNaN(d.wos) && !isNaN(d.exp));
        
        const allTTT = validData.map(d => d.time_to_throw);
        const allDefSpeed = validData.map(d => d.def_avg_speed);
        const ranges = {
          tttMin: Math.floor(Math.min(...allTTT) * 100) / 100,
          tttMax: Math.ceil(Math.max(...allTTT) * 100) / 100,
          defMin: Math.floor(Math.min(...allDefSpeed) * 100) / 100,
          defMax: Math.ceil(Math.max(...allDefSpeed) * 100) / 100
        };
        setDataRanges(ranges);
        setCurrentTTT(ranges.tttMax);
        setCurrentDefSpeed(ranges.defMin);
        setData(validData);
      });
  }, []);

  const resetFilters = () => {
    cancelAnimationFrame(animationRef.current);
    clearAllTimeouts();
    setIsPlaying(false);
    setActiveFeature(null);
    setCurrentTTT(dataRanges.tttMax);
    setCurrentDefSpeed(dataRanges.defMin);
    setRecordMode(false);
    setCountdown(null);
  };

  const playTTTAnimation = (duration = 10000) => {
    cancelAnimationFrame(animationRef.current);
    setActiveFeature('ttt');
    setIsPlaying(true);
    setCurrentTTT(dataRanges.tttMax);
    
    const startTime = performance.now();
    const startVal = dataRanges.tttMax;
    const endVal = dataRanges.tttMin;
    
    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      setCurrentTTT(startVal + (endVal - startVal) * progress);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const playDefSpeedAnimation = (duration = 10000) => {
    cancelAnimationFrame(animationRef.current);
    setActiveFeature('def_speed');
    setIsPlaying(true);
    setCurrentDefSpeed(dataRanges.defMin);
    
    const startTime = performance.now();
    const startVal = dataRanges.defMin;
    const endVal = dataRanges.defMax;
    
    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      setCurrentDefSpeed(startVal + (endVal - startVal) * progress);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const playRecordMode = () => {
    resetFilters();
    setRecordMode(true);
    
    // Countdown
    setCountdown(3);
    addTimeout(() => setCountdown(2), 1000);
    addTimeout(() => setCountdown(1), 2000);
    addTimeout(() => setCountdown(null), 3000);

    // TTT animation starts at 4s, runs for 10s
    addTimeout(() => playTTTAnimation(10000), 4000);
    
    // Hold until 18s, then reset
    addTimeout(() => {
      setActiveFeature(null);
      setCurrentTTT(dataRanges.tttMax);
    }, 18000);

    // Def Speed at 20s, runs for 10s
    addTimeout(() => playDefSpeedAnimation(10000), 20000);
    
    // Done at 34s
    addTimeout(() => {
      setRecordMode(false);
      setIsPlaying(false);
    }, 34000);
  };

  const getPlayerVisibility = (player) => {
    if (activeFeature === 'ttt') return player.time_to_throw <= currentTTT;
    if (activeFeature === 'def_speed') return player.def_avg_speed >= currentDefSpeed;
    return true;
  };

  const processedData = useMemo(() => {
    if (!data.length) return [];
    return data.filter(d => d.targets >= minTargets).map(d => ({ ...d, radius: 15 }));
  }, [data, minTargets]);

  const visibleCount = processedData.filter(d => getPlayerVisibility(d)).length;
  const visibleCreators = processedData.filter(d => getPlayerVisibility(d) && d.wos > d.exp).length;

  if (!data.length) return <div className="p-10 text-center">Loading...</div>;

  const xs = data.map(d => d.wos);
  const ys = data.map(d => d.exp);
  const xMin = Math.min(...xs) - 0.1;
  const xMax = Math.max(...xs) + 0.1;
  const yMin = Math.min(...ys) - 0.1;
  const yMax = Math.max(...ys) + 0.1;
  const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;

  const xScale = v => P + ((v - xMin) / (xMax - xMin)) * (W - P * 2);
  const yScale = v => H - P - ((v - yMin) / (yMax - yMin)) * (H - P * 2);

  return (
    <div className="flex flex-col items-center p-4">
      {/* Small control buttons above - won't be in recording */}
      <div className="flex gap-2 mb-2">
        <button onClick={playRecordMode} disabled={isPlaying || recordMode}
          className="px-4 py-2 bg-red-500 text-white rounded font-bold text-sm">
          🎬 Auto-Play
        </button>
        <button onClick={() => { resetFilters(); playTTTAnimation(10000); }} disabled={isPlaying}
          className="px-4 py-2 bg-blue-500 text-white rounded font-bold text-sm">
          ⏱️ TTT
        </button>
        <button onClick={() => { resetFilters(); playDefSpeedAnimation(10000); }} disabled={isPlaying}
          className="px-4 py-2 bg-red-600 text-white rounded font-bold text-sm">
          🏃 Def Speed
        </button>
        <button onClick={resetFilters} className="px-4 py-2 bg-gray-400 text-white rounded font-bold text-sm">
          ↺ Reset
        </button>
      </div>

      {/* ========== THE SVG - RECORD THIS ========== */}
      <svg width={W} height={H} style={{ background: '#f9f7f1', border: '1px solid #ddd' }}>
        <defs>
          <filter id="dropShadow"><feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.3"/></filter>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Background quadrant shading */}
        <rect x={xScale(avgX)} y={P} width={W - P - xScale(avgX)} height={yScale(avgY) - P} fill="#10b98115"/>
        <rect x={P} y={yScale(avgY)} width={xScale(avgX) - P} height={H - P - yScale(avgY)} fill="#ef444415"/>

        {/* Grid lines */}
        <line x1={xScale(avgX)} y1={P} x2={xScale(avgX)} y2={H-P} stroke="#aaa" strokeDasharray="4,4"/>
        <line x1={P} y1={yScale(avgY)} x2={W-P} y2={yScale(avgY)} stroke="#aaa" strokeDasharray="4,4"/>

        {/* Axis labels */}
        <text x={W/2} y={H-25} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">
          Created Separation (WOS) →
        </text>
        <text x={30} y={H/2} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333" transform={`rotate(-90,30,${H/2})`}>
          Expected Separation →
        </text>

        {/* Quadrant labels */}
        {/* Quadrant labels */}
<text x={W - P - 15} y={P + 30} textAnchor="end" fontSize="18" fill="#10b981" fontWeight="bold">CREATORS ✓</text>
<text x={P + 15} y={P + 30} textAnchor="start" fontSize="18" fill="#ef4444" fontWeight="bold">UNDERPERFORMERS ✗</text>
<text x={W - P - 15} y={H - P - 15} textAnchor="end" fontSize="18" fill="#10b981" fontWeight="bold">SEPARATORS</text>
<text x={P + 15} y={H - P - 15} textAnchor="start" fontSize="18" fill="#888" fontWeight="bold">BASELINE</text>
        {/* Axis ticks */}
        {[xMin, avgX, xMax].map((v,i) => (
          <text key={i} x={xScale(v)} y={H-P+20} textAnchor="middle" fontSize="12" fill="#666">{v.toFixed(2)}</text>
        ))}
        {[yMin, avgY, yMax].map((v,i) => (
          <text key={i} x={P-10} y={yScale(v)+4} textAnchor="end" fontSize="12" fill="#666">{v.toFixed(2)}</text>
        ))}

        {/* ========== PLAYER NODES ========== */}
        {processedData.map(d => {
          const x = xScale(d.wos);
          const y = yScale(d.exp);
          const isVisible = getPlayerVisibility(d);
          const color = d.wos > d.exp ? '#10b981' : '#ef4444';
          const initials = d.player.split(' ').map(n => n[0]).join('');
          const cleanId = `clip-${normalizeName(d.player)}`;
          
          return (
            <g key={d.player} 
               style={{ opacity: isVisible ? 1 : 0.08, transition: 'opacity 0.5s', filter: isVisible ? '' : 'grayscale(100%)' }}
               onMouseEnter={() => setHovered(d)} onMouseLeave={() => setHovered(null)}>
              <defs>
                <clipPath id={cleanId}><circle cx={x} cy={y} r={d.radius}/></clipPath>
              </defs>
              <circle cx={x} cy={y} r={d.radius} fill="#ccc"/>
              <text x={x} y={y+4} textAnchor="middle" fontSize={d.radius*0.7} fontWeight="bold" fill="#555">{initials}</text>
              <image xlinkHref={d.img} x={x-d.radius} y={y-d.radius} width={d.radius*2} height={d.radius*2}
                     clipPath={`url(#${cleanId})`} preserveAspectRatio="xMidYMid slice"
                     onError={(e) => e.target.style.display='none'}/>
              <circle cx={x} cy={y} r={d.radius} fill="none" stroke={color} strokeWidth="2.5" filter="url(#dropShadow)"/>
              <text x={x} y={y+d.radius+12} textAnchor="middle" fontSize="9" fontWeight="600" fill="#333">{d.player}</text>
            </g>
          );
        })}

        {/* ========== COUNTDOWN (inside SVG) ========== */}
        {countdown && (
          <g>
            <rect x={0} y={0} width={W} height={H} fill="rgba(0,0,0,0.75)"/>
            <text x={W/2} y={H/2} textAnchor="middle" fontSize="200" fontWeight="bold" fill="white" dy="60">
              {countdown}
            </text>
          </g>
        )}

        {/* ========== TTT DISPLAY (TOP LEFT inside chart) ========== */}
        {activeFeature === 'ttt' && !countdown && (
  <g>
    {/* Background box */}
    <rect x={P+10} y={H-P-120} width={220} height={100} rx={10} fill="rgba(37,99,235,0.1)" stroke="#2563eb" strokeWidth="2"/>
    
    {/* Label */}
    <text x={P+120} y={H-P-95} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#2563eb">
      TIME TO THROW
    </text>
    
    {/* Big number */}
    <text x={P+120} y={H-P-55} textAnchor="middle" fontSize="42" fontWeight="bold" fill="#2563eb" fontFamily="Georgia, serif">
      {currentTTT.toFixed(2)}s
    </text>
    
    {/* Progress bar */}
    <rect x={P+20} y={H-P-40} width={200} height={8} rx={4} fill="#ddd"/>
    <rect x={P+20} y={H-P-40} 
          width={200 * ((dataRanges.tttMax - currentTTT) / (dataRanges.tttMax - dataRanges.tttMin))} 
          height={8} rx={4} fill="#2563eb"/>
  </g>
)}
   {activeFeature === 'def_speed' && !countdown && (
  <g>
    {/* Background box */}
    <rect x={P+10} y={H-P-120} width={220} height={100} rx={10} fill="rgba(220,38,38,0.1)" stroke="#dc2626" strokeWidth="2"/>
    
    {/* Label */}
    <text x={P+120} y={H-P-95} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#dc2626">
      DEFENDER SPEED
    </text>
    
    {/* Big number */}
    <text x={P+120} y={H-P-55} textAnchor="middle" fontSize="42" fontWeight="bold" fill="#dc2626" fontFamily="Georgia, serif">
      {currentDefSpeed.toFixed(2)}
    </text>
    
    {/* Progress bar */}
    <rect x={P+20} y={H-P-40} width={200} height={8} rx={4} fill="#ddd"/>
    <rect x={P+20} y={H-P-40} 
          width={200 * ((currentDefSpeed - dataRanges.defMin) / (dataRanges.defMax - dataRanges.defMin))} 
          height={8} rx={4} fill="#dc2626"/>
  </g>
)}

        

        {/* ========== INSIGHT TEXT (BOTTOM CENTER inside chart) ========== */}
        {activeFeature === 'ttt' && !countdown && (
          <g>
            <rect x={W/2-300} y={H-P-55} width={600} height={40} rx={8} fill="rgba(37,99,235,0.1)" stroke="#2563eb"/>
            <text x={W/2} y={H-P-28} textAnchor="middle" fontSize="14" fill="#1e40af">
              ⏱️ Showing players who get open with ≤{currentTTT.toFixed(2)}s to throw
            </text>
          </g>
        )}
        {activeFeature === 'def_speed' && !countdown && (
          <g>
            <rect x={W/2-300} y={H-P-55} width={600} height={40} rx={8} fill="rgba(220,38,38,0.1)" stroke="#dc2626"/>
            <text x={W/2} y={H-P-28} textAnchor="middle" fontSize="14" fill="#991b1b">
              🏃 Showing players who beat defenders running {currentDefSpeed.toFixed(2)}+ mph
            </text>
          </g>
        )}

        {/* ========== TITLE (TOP CENTER) ========== */}
        <text x={W/2} y={35} textAnchor="middle" fontSize="24" fontWeight="bold" fill="#1a1a1a">
          Who Creates Separation in the Hardest Situations?
        </text>

      </svg>
    </div>
  );
};

export default RouteComparisonVisualizer;
