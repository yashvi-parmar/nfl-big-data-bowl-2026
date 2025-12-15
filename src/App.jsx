import React, { useState } from 'react';
import NFLPlayVisualizer from './NFLPlayVisualizer';
import RouteComparisonVisualizer from './RouteComparisonVisualizer';
import { PlayCircle, LineChart } from 'lucide-react';

const App = () => {
  const [currentPage, setCurrentPage] = useState('play-visualizer');

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-white font-bold text-lg">
            NFL Separation Analytics
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage('play-visualizer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                currentPage === 'play-visualizer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              Play Visualizer
            </button>
            
            <button
              onClick={() => setCurrentPage('route-comparison')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                currentPage === 'route-comparison'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <LineChart className="w-4 h-4" />
              Route Comparison
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>
        {currentPage === 'play-visualizer' && <NFLPlayVisualizer />}
        {currentPage === 'route-comparison' && <RouteComparisonVisualizer />}
      </main>
    </div>
  );
};

export default App;
