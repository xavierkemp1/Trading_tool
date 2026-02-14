interface CorporateActionWarningProps {
  warning: string;
  createdAt?: string | null;
  onDismiss?: () => void;
}

export default function CorporateActionWarning({ warning, createdAt, onDismiss }: CorporateActionWarningProps) {
  const isRecent = createdAt ? 
    (Date.now() - new Date(createdAt).getTime()) < (7 * 24 * 60 * 60 * 1000) : // 7 days
    true;
  
  return (
    <div className={`rounded-lg border-2 p-4 ${
      isRecent 
        ? 'border-orange-500/50 bg-orange-500/10' 
        : 'border-yellow-500/30 bg-yellow-500/5'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <svg 
              className={`h-5 w-5 ${isRecent ? 'text-orange-400' : 'text-yellow-400'}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <h4 className={`text-sm font-semibold ${isRecent ? 'text-orange-200' : 'text-yellow-200'}`}>
              Corporate Action Detected
            </h4>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {warning}
          </p>
          {createdAt && (
            <p className="text-xs text-slate-400 mt-2">
              Detected: {new Date(createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </p>
          )}
          <div className="mt-3 text-xs text-slate-400 bg-slate-900/50 rounded p-2">
            ⚠️ <strong>Important:</strong> Technical indicators and price history may be inaccurate due to this corporate action. 
            Consider refreshing data or manually verifying price levels.
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Dismiss warning"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
