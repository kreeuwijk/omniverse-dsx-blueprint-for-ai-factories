/**
 * MessageList.tsx
 *
 * Displays the chat message history for the AI Agent panel.
 *
 * Features:
 *   - Shows a welcome screen with suggested prompts when chat is empty
 *   - Renders all messages with proper styling (user vs assistant)
 *   - Auto-scrolls to the latest message when new messages arrive
 *   - Shows a loading indicator while waiting for AI response
 *
 * This component is a child of AgentPanel and receives messages as props.
 */

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import ChatMessageComponent, { ChatMessage } from './ChatMessage';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

interface MessageListProps {
  /** Array of chat messages to display */
  messages: ChatMessage[];
  /** Whether AI is currently processing a response */
  isLoading: boolean;
  /** Dynamic status text shown next to loading spinner (e.g. "Analyzing...", "Executing...") */
  loadingStatus?: string;
  /** Callback when user clicks a suggested prompt */
  onPromptClick?: (prompt: string) => void;
}

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

/**
 * Suggested prompts shown on the welcome screen.
 * These give users ideas of what they can ask the AI agent.
 * Clicking a prompt sends it as a message automatically.
 */
const SUGGESTED_PROMPTS = [
  "Go in the data hall and show the hot aisle",
  "Show me the thermal CFD results",
  "Show the site from the top",
];

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

/**
 * MessageList Component
 *
 * Renders the scrollable chat history area. Shows a welcome screen
 * with suggested prompts when there are no messages, otherwise
 * displays all messages in chronological order.
 *
 * Auto-scroll Behavior:
 *   - Automatically scrolls to bottom when new messages arrive
 *   - Uses smooth scrolling for better UX
 *   - Invisible anchor div at bottom serves as scroll target
 *
 * @param messages - Array of chat messages to display
 * @param isLoading - Shows loading spinner when true
 * @param loadingStatus - Dynamic text for the loading indicator
 * @param onPromptClick - Called when user clicks a suggested prompt
 */
const MessageList = ({ messages, isLoading, loadingStatus, onPromptClick }: MessageListProps) => {
  // Ref to the invisible div at the bottom for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-scroll Effect
   * Scrolls to bottom whenever messages array changes.
   * This ensures the latest message is always visible.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      className={cn(
        // Flex container that grows to fill available space
        'flex-1 overflow-y-auto px-4 py-2 space-y-3 w-full',
        // Custom scrollbar styling for a cleaner look
        'scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent'
      )}
    >
      {/*
        Conditional Rendering:
        - Empty state: Show welcome message with suggested prompts
        - With messages: Show message history
      */}
      {messages.length === 0 ? (
        // ----- Welcome Screen (Empty State) -----
        <div className="flex flex-col py-2">
          {/* Welcome heading */}
          <h3 className="text-base font-medium text-white mb-4">
            How can I help you with the AI Factory Datacenter configurator?
          </h3>
          {/* Suggested prompts - clickable buttons */}
          <div className="flex flex-col gap-1">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onPromptClick?.(prompt)}
                className="text-left text-sm text-white/50 hover:text-white/80 transition-colors cursor-pointer py-0.5"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        // ----- Message History -----
        <>
          {messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))}
        </>
      )}

      {/*
        Loading Indicator
        Shown while waiting for AI response.
        Displays a spinning icon and "Thinking..." text.
      */}
      {isLoading && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="size-4 animate-spin text-white/50" />
          <span className="text-sm text-white/50">{loadingStatus || 'Thinking...'}</span>
        </div>
      )}

      {/*
        Scroll Anchor
        Invisible div at the bottom that we scroll into view
        when new messages arrive. This is a common React pattern
        for implementing auto-scroll in chat interfaces.
      */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
