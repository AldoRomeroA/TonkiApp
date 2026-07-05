"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useEffect, useState } from "react";

import {
  TONKI_IMAGE_FALLBACK_CLASS,
  TONKI_IMAGE_FALLBACK_SRC,
} from "src/lib/imageFallback";

function mergeClassNames(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export type FallbackNextImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
  fallbackSrc?: string;
  fallbackClassName?: string;
};

export function FallbackNextImage({
  src,
  alt,
  className,
  fallbackSrc = TONKI_IMAGE_FALLBACK_SRC,
  fallbackClassName = TONKI_IMAGE_FALLBACK_CLASS,
  ...props
}: FallbackNextImageProps) {
  const [usingFallback, setUsingFallback] = useState(() => !src);
  const [currentSrc, setCurrentSrc] = useState(() =>
    src ? src : fallbackSrc
  );

  useEffect(() => {
    setUsingFallback(!src);
    setCurrentSrc(src ? src : fallbackSrc);
  }, [fallbackSrc, src]);

  const handleError = useCallback(() => {
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setUsingFallback(true);
    }
  }, [currentSrc, fallbackSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      onError={handleError}
      className={mergeClassNames(
        className,
        usingFallback ? fallbackClassName : undefined
      )}
    />
  );
}
