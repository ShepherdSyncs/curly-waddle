import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, AlertCircle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  pending: { icon: Loader2, label: 'Pending', className: 'text-muted-foreground', spin: true },
  running: { icon: Loader2, label: 'Running', className: 'text-blue-400', spin: true },
  in_progress: { icon: Loader2, label: 'In progress', className: 'text-blue-400', spin: true },
  completed: { icon: CheckCircle2, label: 'Completed', className: 'text-emerald-400' },
  success: { icon: CheckCircle2, label: 'Done', className: 'text-emerald-400' },
  failed: { icon: AlertCircle, label: 'Failed', className: 'text-destructive' },
  error: { icon: AlertCircle, label: 'Error', className: 'text-destructive' },
};

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || 'pending';
  const cfg = statusConfig[status] || statusConfig.pending;
  const Icon = cfg.icon;
  const isFailed = status === 'failed' || status === 'error';

  let parsedArgs = toolCall.arguments_string;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { /* keep raw */ }

  let parsedResults = toolCall.results;
  if (typeof parsedResults === 'string') {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }

  const projection = toolCall.display_projection || {};
  const hideDetails = projection.hide_details && projection.details_redacted;

  const label = isFailed ? (projection.error_label || cfg.label) : (projection.label || cfg.label);

  return (
    <div className="mt-2 text-xs rounded-lg border border-border bg-muted/30 p-2">
      <button
        onClick={() => !hideDetails && setExpanded(!expanded)}
        className={cn("flex items-center gap-2 w-full text-left", !hideDetails && "cursor-pointer hover:text-foreground")}
      >
        <Wrench className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", cfg.className, cfg.spin && "animate-spin")} />
        <span className="font-medium">{label}</span>
        {!hideDetails && (
          expanded
            ? <ChevronUp className="w-3 h-3 ml-auto text-muted-foreground" />
            : <ChevronDown className="w-3 h-3 ml-auto text-muted-foreground" />
        )}
      </button>
      {expanded && !hideDetails && (
        <div className="mt-2 space-y-1.5 pl-5 border-l border-border/50">
          {parsedArgs && (
            <div>
              <p className="text-muted-foreground font-medium mb-0.5">Parameters:</p>
              <pre className="text-xs whitespace-pre-wrap break-words text-foreground/80">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults !== undefined && (
            <div>
              <p className="text-muted-foreground font-medium mb-0.5">Result:</p>
              <pre className="text-xs whitespace-pre-wrap break-words text-foreground/80">{JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border")}>
        {message.content && (
          isUser
            ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            : <div className="text-sm prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        )}
        {message.tool_calls?.map((tc, idx) => <ToolCallDisplay key={idx} toolCall={tc} />)}
      </div>
    </div>
  );
}