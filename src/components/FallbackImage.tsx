"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ImgHTMLAttributes,
} from "react";

import {
  TONKI_IMAGE_FALLBACK_CLASS,
  TONKI_IMAGE_FALLBACK_SRC,
} from "src/lib/imageFallback";

export type FallbackImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
  fallbackClassName?: string;
};

function mergeClassNames(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function FallbackImage({
  src,
  alt = "",
  onError,
  className,
  fallbackSrc = TONKI_IMAGE_FALLBACK_SRC,
  fallbackClassName = TONKI_IMAGE_FALLBACK_CLASS,
  ...props
}: FallbackImageProps) {
  const [usingFallback, setUsingFallback] = useState(() => !src);

  useEffect(() => {
    setUsingFallback(!src);
  }, [src]);

  const resolvedSrc = usingFallback || !src ? fallbackSrc : String(src);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (!usingFallback) {
        setUsingFallback(true);
      }
      onError?.(event);
    },
    [onError, usingFallback]
  );

  return (
    <img
      {...props}
      src={resolvedSrc}
      alt={alt}
      onError={handleError}
      className={mergeClassNames(
        className,
        usingFallback || !src ? fallbackClassName : undefined
      )}
    />
  );
}
