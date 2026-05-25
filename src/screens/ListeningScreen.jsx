import React from 'react';
import { X } from 'lucide-react';
import { MicPulseRing, ListeningAnimation } from '../components/Illustrations';
import { Button } from '../components/Button';

export const ListeningScreen = ({ 
  onStop,
  transcript = 'Summarize this page for me...',
  isProcessing = false,
}) => {
  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-sm font-bold">
            S
          </div>
          <span className="font-semibold text-black">Sidekick</span>
        </div>
        <button
          onClick={onStop}
          className="p-2 hover:bg-gray-100 rounded-full transition-all"
        >
          <X size={18} className="text-black" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Mic pulse animation */}
        <div className="mb-8">
          <MicPulseRing size="lg" />
        </div>

        {/* Status text */}
        <h2 className="text-2xl font-bold text-black mb-2">
          {isProcessing ? 'Processing...' : 'Listening...'}
        </h2>
        
        <p className="text-sm text-gray-500 mb-8">
          {isProcessing ? 'Understanding your request' : 'Waiting for your voice command'}
        </p>

        {/* Listening animation bars */}
        {!isProcessing && (
          <div className="mb-12 flex items-end justify-center gap-1.5 h-16">
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((delay, idx) => (
              <div
                key={idx}
                className="w-1.5 bg-black rounded-full"
                style={{
                  height: `${30 + Math.random() * 40}px`,
                  animation: `pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Transcript display */}
        {transcript && (
          <div className="w-full bg-gray-50 rounded-lg p-4 mb-8 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Transcript
            </p>
            <p className="text-base text-black leading-relaxed">
              "{transcript}"
            </p>
          </div>
        )}

        {/* Stop button */}
        <Button
          variant="secondary"
          onClick={onStop}
          className="w-full"
        >
          Stop
        </Button>
      </div>
    </div>
  );
};
