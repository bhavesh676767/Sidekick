import React from 'react';
import { ChevronUp, X } from 'lucide-react';
import { ProgressStep } from '../components/Status';
import { Button } from '../components/Button';
import { Doodle } from '../components/Illustrations';

export const TaskExecutionScreen = ({ 
  onStop,
  onDone,
  task = 'Summarize this webpage',
  steps = [
    { id: 1, label: 'Understanding command', status: 'completed' },
    { id: 2, label: 'Reading page', status: 'completed' },
    { id: 3, label: 'Processing content', status: 'active' },
    { id: 4, label: 'Generating summary', status: 'pending' },
    { id: 5, label: 'Done', status: 'pending' },
  ],
  showResult = false,
  result = '',
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
        <button
          onClick={onStop}
          className="p-2 hover:bg-gray-100 rounded-full transition-all"
        >
          <X size={18} className="text-black" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Task title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-black mb-2">
            {task}
          </h2>
          <p className="text-sm text-gray-500">
            {showResult ? 'Complete!' : 'In progress...'}
          </p>
        </div>

        {!showResult ? (
          <>
            {/* Progress steps */}
            <div className="space-y-4 mb-8">
              {steps.map((step, idx) => (
                <ProgressStep
                  key={step.id}
                  number={step.id}
                  label={step.label}
                  status={step.status}
                />
              ))}
            </div>

            {/* Decorative element */}
            <div className="flex justify-center opacity-20 mb-8">
              <Doodle type="waves" />
            </div>
          </>
        ) : (
          <>
            {/* Result */}
            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 mb-8">
              <p className="text-sm text-black leading-relaxed">
                {result}
              </p>
            </div>

            {/* Success checkmark */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto">
                <span className="text-white text-xl font-bold">✓</span>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Task completed successfully
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-gray-200 space-y-3">
        {showResult ? (
          <>
            <Button 
              variant="primary" 
              className="w-full"
              onClick={onDone}
            >
              New Command
            </Button>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={onStop}
            >
              Close
            </Button>
          </>
        ) : (
          <Button 
            variant="secondary" 
            className="w-full"
            onClick={onStop}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
