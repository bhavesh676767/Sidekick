import React from 'react';

export const Card = ({ 
  children, 
  className = '', 
  hoverable = false,
  ...props 
}) => {
  return (
    <div
      className={`
        bg-white border border-gray-200 rounded-lg p-5
        transition-all duration-200
        ${hoverable ? 'hover:border-gray-300 hover:shadow-md cursor-pointer' : 'shadow-sm'}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const QuickActionCard = ({ 
  icon: Icon, 
  label, 
  onClick,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center w-full p-4 rounded-lg
        bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300
        transition-all duration-200 active:scale-95
        ${className}
      `}
    >
      <div className="w-8 h-8 mb-2 flex items-center justify-center">
        <Icon size={20} className="text-black" />
      </div>
      <span className="text-xs font-medium text-center text-black">
        {label}
      </span>
    </button>
  );
};
