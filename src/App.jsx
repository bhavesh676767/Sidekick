import React, { useState } from 'react';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { MainPopupScreen } from './screens/MainPopupScreen';
import { ListeningScreen } from './screens/ListeningScreen';
import { TaskExecutionScreen } from './screens/TaskExecutionScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  // Screen states
  const [currentScreen, setCurrentScreen] = useState('onboarding'); // onboarding, main, listening, executing, settings
  const [micActive, setMicActive] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState('idle'); // idle, listening, active
  
  // Task execution state
  const [currentTask, setCurrentTask] = useState(null);
  const [executionSteps, setExecutionSteps] = useState([]);
  const [showResult, setShowResult] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    voiceInput: true,
    autoReadContext: true,
    confirmRiskyActions: true,
  });

  // Transcription mock
  const [transcript, setTranscript] = useState('');

  // Handlers
  const handleGetStarted = () => {
    setCurrentScreen('main');
  };

  const handleMicClick = () => {
    if (micActive) {
      // Stop listening
      setMicActive(false);
      setAssistantStatus('idle');
      // Simulate processing
      setTimeout(() => {
        setCurrentScreen('executing');
        simulateTaskExecution();
      }, 800);
    } else {
      // Start listening
      setMicActive(true);
      setAssistantStatus('listening');
      setTranscript('');
      
      // Simulate transcript generation
      const transcripts = [
        'Summarize this page',
        'Open Google',
        'Fill out the contact form',
        'Search for React documentation',
      ];
      const randomTranscript = transcripts[Math.floor(Math.random() * transcripts.length)];
      
      setTimeout(() => {
        setTranscript(randomTranscript);
      }, 1500);
    }
  };

  const handleStop = () => {
    if (currentScreen === 'listening') {
      setMicActive(false);
      setAssistantStatus('idle');
      setCurrentScreen('main');
    } else if (currentScreen === 'executing') {
      setCurrentScreen('main');
      resetTaskState();
    }
  };

  // Get current page text via content script
  const getPageText = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "GET_PAGE_TEXT" },
          (response) => {
            if (response && response.text) {
              console.log("Page text retrieved:", response.text.substring(0, 100) + "...");
              // Use this text for summarization, context, etc.
            }
          }
        );
      }
    });
  };

  const simulateTaskExecution = () => {
    const steps = [
      { id: 1, label: 'Understanding command', status: 'completed' },
      { id: 2, label: 'Reading page', status: 'completed' },
      { id: 3, label: 'Processing content', status: 'active' },
      { id: 4, label: 'Generating result', status: 'pending' },
      { id: 5, label: 'Done', status: 'pending' },
    ];
    
    setExecutionSteps(steps);
    setAssistantStatus('active');
    
    // Simulate step progression
    let currentStep = 2;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps.length) {
        clearInterval(interval);
        setShowResult(true);
        return;
      }
      
      const updatedSteps = steps.map((step, idx) => {
        if (idx < currentStep) return { ...step, status: 'completed' };
        if (idx === currentStep) return { ...step, status: 'active' };
        return { ...step, status: 'pending' };
      });
      
      setExecutionSteps(updatedSteps);
    }, 1200);
  };

  const resetTaskState = () => {
    setCurrentTask(null);
    setExecutionSteps([]);
    setShowResult(false);
    setAssistantStatus('idle');
  };

  const handleQuickAction = (actionId) => {
    const actionLabels = {
      summarize: 'Summarize this page',
      open: 'Open website',
      fill: 'Fill form',
      search: 'Search web',
      click: 'Click button',
      tabs: 'Manage tabs',
    };
    
    setCurrentTask(actionLabels[actionId]);
    setCurrentScreen('executing');
    
    // Get page text if summarizing
    if (actionId === 'summarize') {
      getPageText();
    }
    
    simulateTaskExecution();
  };

  const handleToggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDoneWithTask = () => {
    resetTaskState();
    setCurrentScreen('main');
  };

  // Render current screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'onboarding':
        return <OnboardingScreen onGetStarted={handleGetStarted} />;
      
      case 'main':
        return (
          <MainPopupScreen
            onMicClick={handleMicClick}
            micActive={micActive}
            onSettings={() => setCurrentScreen('settings')}
            status={assistantStatus}
            onQuickAction={handleQuickAction}
          />
        );
      
      case 'listening':
        return (
          <ListeningScreen
            onStop={handleStop}
            transcript={transcript}
            isProcessing={assistantStatus === 'active'}
          />
        );
      
      case 'executing':
        return (
          <TaskExecutionScreen
            onStop={handleStop}
            onDone={handleDoneWithTask}
            task={currentTask}
            steps={executionSteps}
            showResult={showResult}
            result="This page contains information about web development, React frameworks, and best practices for building modern web applications. Key topics include component lifecycle, state management, and performance optimization techniques."
          />
        );
      
      case 'settings':
        return (
          <SettingsScreen
            onBack={() => setCurrentScreen('main')}
            settings={settings}
            onToggleSetting={handleToggleSetting}
            apiStatus={{
              gemini: 'connected',
              speechApi: 'ready',
            }}
          />
        );
      
      default:
        return <OnboardingScreen onGetStarted={handleGetStarted} />;
    }
  };

  return (
    <div className="bg-white">
      {renderScreen()}
    </div>
  );
}
