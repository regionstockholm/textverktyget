export enum TextProcessingEventType {
  PROCESSING_STARTED = "processing-started",
  TEXT_RECEIVED_FROM_DATABASE = "text-received-from-database",
  PROCESSING_COMPLETED = "processing-completed",
  PROCESSING_ERROR = "processing-error",
}

export type TextProcessingEventData = {
  clickCount: number;
  attemptNumber?: number;
  timestamp: number;
};

export type TextReceivedEventData = TextProcessingEventData & {
  text: string;
  qualityEvaluationId?: number;
  hasQualityProcess: boolean;
  systemMessage?: string;
  isFinalAttempt?: boolean;
};

export type ProcessingCompletedEventData = TextProcessingEventData & {
  finalScore?: number;
  totalAttempts: number;
};

export type ProcessingErrorEventData = TextProcessingEventData & {
  error: Error;
  errorMessage: string;
};

export type TextProcessingEventListener<T = unknown> = (
  data: T,
) => void | Promise<void>;

class TextProcessingEventEmitter {
  private listeners: Map<
    TextProcessingEventType,
    Array<TextProcessingEventListener<any>>
  > = new Map();

  on<T>(
    eventType: TextProcessingEventType,
    listener: TextProcessingEventListener<T>,
  ): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    this.listeners.get(eventType)!.push(listener);
  }

  emit<T>(eventType: TextProcessingEventType, data: T): void {
    const eventListeners = this.listeners.get(eventType);
    if (!eventListeners) {
      return;
    }

    eventListeners.forEach((listener) => {
      void Promise.resolve(listener(data)).catch((error) => {
        console.error(`[Events] Error in listener for ${eventType}:`, error);
      });
    });
  }

}

export const textProcessingEvents = new TextProcessingEventEmitter();
