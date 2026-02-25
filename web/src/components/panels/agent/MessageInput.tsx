/**
 * MessageInput.tsx
 * 
 * Text input component for sending messages to the AI assistant.
 * 
 * Features:
 *   - Clean, rounded pill-style input field
 *   - Submit via Enter key or click the send button
 *   - Visual feedback for valid/invalid input states
 *   - Disabled state while AI is processing
 * 
 * This component is a child of AgentPanel and calls onSend when
 * the user submits a message.
 */

import { useState, KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

interface MessageInputProps {
  /** Callback function when user sends a message */
  onSend: (content: string) => void;
  /** Whether input should be disabled (e.g., while AI is processing) */
  disabled: boolean;
}

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

/**
 * MessageInput Component
 * 
 * A text input field with a send button for composing messages
 * to the AI assistant. Handles both keyboard (Enter) and click
 * submission methods.
 * 
 * Input Validation:
 *   - Empty or whitespace-only messages are not submitted
 *   - Send button is visually dimmed when input is invalid
 *   - Input is cleared after successful submission
 * 
 * Disabled State:
 *   - Used while waiting for AI response
 *   - Prevents multiple messages being sent at once
 *   - Visual feedback shows reduced opacity
 * 
 * @param onSend - Called with message content when user submits
 * @param disabled - Prevents input when true
 */
const MessageInput = ({ onSend, disabled }: MessageInputProps) => {
  // Local state for the input field value
  const [inputValue, setInputValue] = useState('');

  // ---------------------------------------------------------
  // Validation & Submission
  // ---------------------------------------------------------

  /**
   * Check if the input contains actual content (not just whitespace).
   * Used to prevent submitting empty messages.
   * 
   * @param value - The input string to validate
   * @returns true if the string has non-whitespace content
   */
  const isValidInput = (value: string): boolean => {
    return value.trim().length > 0;
  };

  /**
   * Handle message submission.
   * Validates the input, calls onSend callback, and clears the field.
   * Does nothing if input is invalid or component is disabled.
   */
  const handleSubmit = () => {
    // Don't submit empty messages or when disabled
    if (!isValidInput(inputValue) || disabled) {
      return;
    }
    // Send the message via callback
    onSend(inputValue);
    // Clear the input field for next message
    setInputValue('');
  };

  /**
   * Handle keyboard events for the input field.
   * Submits the message when Enter is pressed (without Shift).
   * Shift+Enter could be used for multi-line input in the future.
   * 
   * @param e - The keyboard event
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent form submission or newline
      handleSubmit();
    }
  };

  // Determine if the send button should be active
  const canSubmit = isValidInput(inputValue) && !disabled;

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  return (
    <div className="px-4 pb-4 pt-2 w-full">
      {/* 
        Input Container
        Styled as a pill-shaped container with the input and send button.
        Has a subtle glow effect when focused.
      */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 w-full 
        focus-within:border-white/20 transition-all duration-200">
        {/* 
          Text Input Field
          Grows to fill available space.
          Transparent background blends with container.
        */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          disabled={disabled}
          className={cn(
            // Layout and sizing
            'flex-1 py-1 text-sm bg-transparent',
            // Text colors
            'placeholder:text-white/40 text-white',
            // Remove default focus outline (container handles focus styling)
            'focus:outline-none',
            // Disabled state styling
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
        {/* 
          Send Button
          Circular button with arrow icon.
          Visual state changes based on whether submission is possible.
        */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            // Shape and layout
            'rounded-full h-8 w-8 flex items-center justify-center transition-all duration-200 shrink-0',
            // Conditional styling based on submit state
            canSubmit 
              ? 'cursor-pointer bg-white/20 hover:bg-white/30 text-white'  // Active: visible and interactive
              : 'bg-white/10 text-white/30'                  // Inactive: dimmed appearance
          )}
          aria-label="Send message"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
