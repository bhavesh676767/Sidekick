import React from 'react';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Status';
import { Divider } from '../components/Status';

export const SettingsScreen = ({ 
  onBack,
  settings = {
    voiceInput: true,
    autoReadContext: true,
    confirmRiskyActions: true,
  },
  onToggleSetting,
  apiStatus = {
    gemini: 'connected',
    speechApi: 'ready',
  },
}) => {
  const toggleSetting = (key) => {
    onToggleSetting(key);
  };

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all -ml-2"
        >
          <ChevronLeft size={20} className="text-black" />
        </button>
        <h1 className="text-lg font-bold text-black">Settings</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Preferences section */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-4">
            Preferences
          </h2>
          
          <Card className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-black mb-1">Voice Input</h3>
                <p className="text-xs text-gray-500">
                  Enable voice commands via microphone
                </p>
              </div>
              <button
                onClick={() => toggleSetting('voiceInput')}
                className={`
                  w-12 h-7 rounded-full flex items-center transition-all
                  ${settings.voiceInput 
                    ? 'bg-black' 
                    : 'bg-gray-300'
                  }
                `}
              >
                <div className={`
                  w-5 h-5 rounded-full bg-white transition-all transform
                  ${settings.voiceInput ? 'translate-x-6' : 'translate-x-1'}
                `} />
              </button>
            </div>
          </Card>

          <Card className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-black mb-1">Auto-read Context</h3>
                <p className="text-xs text-gray-500">
                  Automatically read webpage context
                </p>
              </div>
              <button
                onClick={() => toggleSetting('autoReadContext')}
                className={`
                  w-12 h-7 rounded-full flex items-center transition-all
                  ${settings.autoReadContext 
                    ? 'bg-black' 
                    : 'bg-gray-300'
                  }
                `}
              >
                <div className={`
                  w-5 h-5 rounded-full bg-white transition-all transform
                  ${settings.autoReadContext ? 'translate-x-6' : 'translate-x-1'}
                `} />
              </button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-black mb-1">Confirm Risky Actions</h3>
                <p className="text-xs text-gray-500">
                  Ask before sending forms or deleting content
                </p>
              </div>
              <button
                onClick={() => toggleSetting('confirmRiskyActions')}
                className={`
                  w-12 h-7 rounded-full flex items-center transition-all
                  ${settings.confirmRiskyActions 
                    ? 'bg-black' 
                    : 'bg-gray-300'
                  }
                `}
              >
                <div className={`
                  w-5 h-5 rounded-full bg-white transition-all transform
                  ${settings.confirmRiskyActions ? 'translate-x-6' : 'translate-x-1'}
                `} />
              </button>
            </div>
          </Card>
        </div>

        <Divider className="my-8" />

        {/* API Status section */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-4">
            System Status
          </h2>
          
          <Card className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-black mb-1">Gemini API</h3>
                <p className="text-xs text-gray-500">
                  AI model backend status
                </p>
              </div>
              <Badge variant={apiStatus.gemini === 'connected' ? 'success' : 'default'}>
                {apiStatus.gemini === 'connected' ? '● Connected' : '● Offline'}
              </Badge>
            </div>
          </Card>

{/* API Provider Configuration */}
<Card className="mb-4">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <h3 className="font-semibold text-black mb-1">AI Provider</h3>
      <p className="text-xs text-gray-500">Select API provider and configure key</p>
    </div>
    <select
      value={settings.apiProvider || 'groq'}
      onChange={(e) => toggleSetting('apiProvider', e.target.value)}
      className="bg-gray-200 text-black rounded p-1"
    >
      <option value="groq">Groq</option>
      <option value="openrouter">OpenRouter</option>
    </select>
  </div>
</Card>

<Card className="mb-4">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <h3 className="font-semibold text-black mb-1">Groq API Key</h3>
      <p className="text-xs text-gray-500">Enter your Groq API secret</p>
    </div>
    <input
      type="password"
      value={settings.groqApiKey || ''}
      onChange={(e) => toggleSetting('groqApiKey', e.target.value)}
      placeholder="groq-..."
      className="w-40 p-1 border rounded bg-gray-100 text-black"
    />
  </div>
</Card>

<Card className="mb-4">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <h3 className="font-semibold text-black mb-1">OpenRouter API Key</h3>
      <p className="text-xs text-gray-500">Enter your OpenRouter API secret</p>
    </div>
    <input
      type="password"
      value={settings.openRouterApiKey || ''}
      onChange={(e) => toggleSetting('openRouterApiKey', e.target.value)}
      placeholder="or-..."
      className="w-40 p-1 border rounded bg-gray-100 text-black"
    />
  </div>
</Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-black mb-1">Speech API</h3>
                <p className="text-xs text-gray-500">
                  Voice recognition service
                </p>
              </div>
              <Badge variant={apiStatus.speechApi === 'ready' ? 'success' : 'default'}>
                {apiStatus.speechApi === 'ready' ? '● Ready' : '● Unavailable'}
              </Badge>
            </div>
          </Card>
        </div>

        <Divider className="my-8" />

        {/* About section */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-4">
            About
          </h2>
          
          <Card>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Version</span>
                <span className="text-sm font-semibold text-black">1.0.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Privacy</span>
                <span className="text-sm font-semibold text-black">Local-first</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Support</span>
                <span className="text-sm text-blue-600 font-semibold cursor-pointer hover:underline">
                  Help center
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200">
        <Button 
          variant="secondary" 
          className="w-full"
          onClick={onBack}
        >
          Back to Sidekick
        </Button>
      </div>
    </div>
  );
};
