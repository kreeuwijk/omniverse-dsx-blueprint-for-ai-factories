/**
 * ChatMessage.tsx
 * 
 * Renders a single chat message in the AI Agent conversation.
 * 
 * Design Philosophy:
 *   - User messages: Appear in a rounded grey bubble, right-aligned
 *   - Assistant messages: Plain text, left-aligned (like ChatGPT style)
 *   
 * This visual distinction makes it easy to scan the conversation
 * and understand who said what at a glance.
 */

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

/**
 * ChatMessage Interface
 * 
 * Represents a single message in the chat conversation.
 * Exported so other components (AgentPanel, MessageList) can use it.
 * 
 * @property id - Unique identifier for React key and tracking
 * @property role - Who sent the message: 'user' or 'assistant'
 * @property content - The actual message text
 * @property timestamp - When the message was created
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  /** The message data to display */
  message: ChatMessage;
}

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

/**
 * ChatMessageComponent
 * 
 * Displays a single chat message with role-appropriate styling.
 * 
 * Visual Design:
 *   - User messages:
 *     - Grey rounded bubble (bg-white/15)
 *     - Right-aligned (flex justify-end)
 *     - Max width 85% to leave some margin
 *   
 *   - Assistant messages:
 *     - No background (open, clean style)
 *     - Left-aligned (default flex)
 *     - Max width 95% for readability
 *     - Slightly dimmed text (text-white/90)
 * 
 * Text Handling:
 *   - whitespace-pre-wrap: Preserves line breaks from the content
 *   - break-words: Prevents long words from breaking layout
 *   - leading-relaxed: Comfortable line height for reading
 * 
 * @param message - The message object containing role and content
 */
const ChatMessageComponent = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user';

  // ---------------------------------------------------------
  // User Message Styling
  // ---------------------------------------------------------
  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        {/* 
          User Message Bubble
          - Rounded corners for a friendly, modern look
          - Semi-transparent white background
          - Right-aligned to distinguish from assistant
        */}
        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-white/15 text-white">
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // Assistant Message Styling
  // ---------------------------------------------------------
  return (
    <div className="flex w-full">
      {/* 
        Assistant Message (No Bubble)
        - Open style without background, like ChatGPT
        - Left-aligned for clear visual hierarchy
        - Slightly dimmed text to contrast with user messages
      */}
      <div className="max-w-[95%]">
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed text-white/90">
          {message.content}
        </p>
      </div>
    </div>
  );
};

export default ChatMessageComponent;
