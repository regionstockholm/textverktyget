import { processAttachedFiles } from "./core/app-state.js";
import { processFile } from "./file/core/file-processor.js";
import { attachedFiles, initializeFileUpload } from "./file/file-upload-controller.js";
import { initializeSummarizer } from "./ui/summarizer-ui.js";

function initializeApplication(): void {
  try {
    const processAttachedFilesWrapper = async (
      text: string,
      clickCount: number,
    ): Promise<string> => {
      return processAttachedFiles(
        text,
        clickCount,
        attachedFiles,
        processFile,
      );
    };

    initializeSummarizer({
      processAttachedFiles: processAttachedFilesWrapper,
    });
    initializeFileUpload();
  } catch (error) {
    console.error("Application initialization failed:", error);
  }
}

function initialize(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeApplication();
    });
    return;
  }

  initializeApplication();
}

initialize();

export { initializeApplication };
