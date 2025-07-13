'use client';

interface ResearchStep {
  phase: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  description: string;
  tools?: string[];
  timestamp?: string;
}

interface ResearchProgressProps {
  steps: ResearchStep[];
  currentPhase?: string;
}

export function ResearchProgress({ steps, currentPhase }: ResearchProgressProps) {
  if (steps.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mb-4">
      <div className="flex items-center mb-3">
        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        </div>
        <h3 className="font-semibold text-blue-800">Research Progress</h3>
      </div>
      
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start space-x-3">
            {/* Status indicator */}
            <div className="flex-shrink-0 mt-1">
              {step.status === 'completed' && (
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
              {step.status === 'in-progress' && (
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              )}
              {step.status === 'pending' && (
                <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
              )}
              {step.status === 'error' && (
                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className={`font-medium text-sm
                  ${step.status === 'completed' ? 'text-green-700' : 
                    step.status === 'in-progress' ? 'text-blue-700' :
                    step.status === 'error' ? 'text-red-700' : 'text-gray-600'}
                `}>
                  {step.phase}
                </span>
                
                {step.status === 'in-progress' && step.phase === currentPhase && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    Current
                  </span>
                )}
              </div>
              
              <p className="text-sm text-gray-600 mt-1">{step.description}</p>
              
              {/* Tools used */}
              {step.tools && step.tools.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {step.tools.map((tool, toolIndex) => (
                    <span 
                      key={toolIndex}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                    >
                      🔧 {tool}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Timestamp */}
              {step.timestamp && (
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}