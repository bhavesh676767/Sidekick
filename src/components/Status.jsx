import React from 'react';

export const StatusDot = ({ 
  status = 'idle', 
  className = '',
}) => {
  const statusColors = {
    idle: 'bg-gray-300',
    active: 'bg-black animate-pulse-soft',
    listening: 'bg-black animate-mic-pulse',
    executing: 'bg-black animate-pulse-soft',
    success: 'bg-black',
    error: 'bg-gray-700',
  };

  return (
    <div className={`
      inline-block w-2 h-2 rounded-full
      ${statusColors[status]}
      ${className}
    `} />
  );
};

export const Badge = ({ 
  children, 
  variant = 'default',
  className = '',
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    dark: 'bg-black text-white',
    success: 'bg-gray-200 text-black',
  };

  return (
    <span className={`
      inline-flex items-center px-3 py-1
      text-xs font-medium rounded-full
      ${variants[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
};

export const ProgressStep = ({ 
  number, 
  label, 
  status = 'pending', // pending, active, completed
  className = '',
}) => {
  const statusStyles = {
    pending: 'bg-gray-100 text-gray-400',
    active: 'bg-black text-white animate-pulse-soft',
    completed: 'bg-black text-white',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center
        font-semibold text-sm transition-all duration-200
        ${statusStyles[status]}
      `}>
        {status === 'completed' ? '✓' : number}
      </div>
      <span className={`text-sm font-medium ${
        status === 'active' ? 'text-black' : 'text-gray-500'
      }`}>
        {label}
      </span>
    </div>
  );
};

export const Divider = ({ className = '' }) => {
  return <div className={`h-px bg-gray-200 ${className}`} />;
};
