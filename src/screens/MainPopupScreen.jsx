import React from 'react';
import { Settings, ChevronUp } from 'lucide-react';
import { StatusDot } from '../components/Status';
import { VoiceInput } from '../components/Input';
import { QuickActionCard } from '../components/Card';
import { Doodle } from '../components/Illustrations';

const quickActions = [
  { id: 'summarize', label: 'Summarize page', icon: '∑' },
  { id: 'open', label: 'Open website', icon: '◆' },
  { id: 'fill', label: 'Fill form', icon: '□' },
  { id: 'search', label: 'Search web', icon: '🔍' },
  { id: 'click', label: 'Click button', icon: '◉' },
  { id: 'tabs', label: 'Manage tabs', icon: '≡' },
];

export const MainPopupScreen = ({ 
  onMicClick, 
  micActive = false,
  onSettings,
  userName = 'Bhavesh',
  onQuickAction,
  status = 'idle', // idle, active, listening
}) => {
  return (
    <div className="w-96 bg-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-sm font-bold">
            S
          </div>
          <span className="font-semibold text-black">Sidekick</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <StatusDot status={status === 'idle' ? 'idle' : 'active'} />
            <span className="text-xs text-gray-500 font-medium">
              {status === 'idle' ? 'Ready' : status === 'listening' ? 'Listening' : 'Active'}
            </span>
          </div>
          <button
            onClick={onSettings}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
          >
            <Settings size={18} className="text-black" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-black">
            Hey {userName},
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            What can I help you with?
          </p>
        </div>

        {/* Voice input */}
        <div className="mb-8">
          <VoiceInput 
            onMicClick={onMicClick}
            micActive={micActive}
          />
        </div>

        {/* Or divider */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick actions
          </p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onQuickAction(action.id)}
                className={`
                  flex flex-col items-center justify-center p-4 rounded-lg
                  bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300
                  transition-all duration-200 active:scale-95
                `}
              >
                <span className="text-xl mb-1">{action.icon}</span>
                <span className="text-xs font-medium text-center text-black">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Decorative doodle */}
        <div className="flex justify-center mt-8 opacity-20">
          <Doodle type="dots" />
        </div>
      </div>

      {/* Footer info */}
      <div className="px-6 py-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          Powered by Gemini • Speech API ready
        </p>
      </div>
    </div>
  );
};
