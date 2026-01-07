"use client";

import { useEffect, useState } from "react";
import "./status-chip.css";

type StatusChipProps = {
  message: string;
  variant?: "success" | "error" | "info" | "warning";
  duration?: number; // Auto-dismiss duration in ms (0 = no auto-dismiss)
  onDismiss?: () => void;
};

export default function StatusChip({
  message,
  variant = "success",
  duration = 3000,
  onDismiss,
}: StatusChipProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onDismiss) {
          setTimeout(onDismiss, 300); // Wait for fade-out animation
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={`status-chip status-chip-${variant}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="status-chip-icon">
        {variant === "success" && "✓"}
        {variant === "error" && "✕"}
        {variant === "info" && "ℹ"}
        {variant === "warning" && "⚠"}
      </span>
      <span className="status-chip-message">{message}</span>
      {duration === 0 && onDismiss && (
        <button
          className="status-chip-dismiss"
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      )}
    </div>
  );
}

