import React from 'react';
import { MessageSquare, Calendar, FileText, Phone, Mail, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../utils/cn';

export interface ActivityEvent {
  id: string;
  type: 'communication' | 'tour' | 'application' | 'note' | 'other';
  title: string;
  description?: string;
  timestamp: string;
  channel?: 'email' | 'sms' | 'phone' | 'in_person' | 'note';
  direction?: 'inbound' | 'outbound';
  status?: string;
  created_by?: string;
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
  className?: string;
  emptyMessage?: string;
}

const getEventIcon = (event: ActivityEvent) => {
  switch (event.type) {
    case 'communication':
      if (event.channel === 'email') return <Mail className="w-4 h-4" />;
      if (event.channel === 'sms') return <MessageSquare className="w-4 h-4" />;
      if (event.channel === 'phone') return <Phone className="w-4 h-4" />;
      return <MessageSquare className="w-4 h-4" />;
    case 'tour':
      return <Calendar className="w-4 h-4" />;
    case 'application':
      return <FileText className="w-4 h-4" />;
    case 'note':
      return <FileText className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getEventColor = (event: ActivityEvent) => {
  switch (event.type) {
    case 'communication':
      return event.direction === 'inbound'
        ? 'bg-status-info-light dark:bg-status-info-dark text-status-info-text dark:text-status-info-text-dark'
        : 'bg-status-success-light dark:bg-status-success-dark text-status-success-text dark:text-status-success-text-dark';
    case 'tour':
      return 'bg-status-warning-light dark:bg-status-warning-dark text-status-warning-text dark:text-status-warning-text-dark';
    case 'application':
      return 'bg-havyn-subtle dark:bg-havyn-dark text-havyn-primary dark:text-havyn-lightest';
    case 'note':
      return 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200';
    default:
      return 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200';
  }
};

export function ActivityTimeline({ events, className, emptyMessage = 'No activity yet' }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500 dark:text-gray-400', className)}>
        <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className={cn('space-y-4', className)}>
      {sortedEvents.map((event, index) => (
        <div key={event.id} className="flex gap-4 relative">
          {/* Timeline line */}
          {index < sortedEvents.length - 1 && (
            <div className="absolute left-5 top-8 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
          )}
          
          {/* Icon */}
          <div className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            getEventColor(event)
          )}>
            {getEventIcon(event)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {event.title}
                </h4>
                {event.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {event.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
                  {event.channel && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{event.channel}</span>
                    </>
                  )}
                  {event.direction && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{event.direction}</span>
                    </>
                  )}
                  {event.status && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{event.status}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}



