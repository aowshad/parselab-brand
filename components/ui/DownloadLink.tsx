"use client";

import type { ComponentProps } from "react";
import type { FileRef } from "@/lib/files";
import { withBase } from "@/lib/paths";
import { FeedbackLabel, useFeedback } from "./Feedback";
import { useToast } from "./Toast";

/**
 * Plain static-file download that confirms with a toast. With `feedback`, the link's content
 * briefly shows a spinner, then "✓ Downloaded", without changing its width.
 */
export function DownloadLink({
  file,
  onClick,
  feedback = false,
  doneLabel = "Downloaded",
  children,
  ...props
}: { file: FileRef; feedback?: boolean; doneLabel?: React.ReactNode } & Omit<ComponentProps<"a">, "href" | "download">) {
  const toast = useToast();
  const { state, run } = useFeedback();
  return (
    <a
      href={file.downloadUrl ?? withBase(file.path)}
      download={file.filename}
      onClick={(e) => {
        toast(`Downloading ${file.filename}`);
        if (feedback) run(true);
        onClick?.(e);
      }}
      {...props}
    >
      {feedback ? (
        <FeedbackLabel state={state} doneLabel={doneLabel}>
          {children}
        </FeedbackLabel>
      ) : (
        children
      )}
    </a>
  );
}
