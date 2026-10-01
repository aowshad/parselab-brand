"use client";

import type { ComponentProps } from "react";
import type { FileRef } from "@/lib/manifest";
import { withBase } from "@/lib/paths";
import { useToast } from "./Toast";

/** Plain static-file download that confirms with a toast. */
export function DownloadLink({
  file,
  onClick,
  ...props
}: { file: FileRef } & Omit<ComponentProps<"a">, "href" | "download">) {
  const toast = useToast();
  return (
    <a
      href={withBase(file.path)}
      download={file.filename}
      onClick={(e) => {
        toast(`Downloading ${file.filename}`);
        onClick?.(e);
      }}
      {...props}
    />
  );
}
