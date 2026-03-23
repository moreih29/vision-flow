import { useEffect, useRef } from "react";

interface CanvasScrollbarsProps {
  position: { x: number; y: number };
  scale: number;
  imageSize: { width: number; height: number };
  containerSize: { width: number; height: number };
}

export default function CanvasScrollbars({
  position,
  scale,
  imageSize,
  containerSize,
}: CanvasScrollbarsProps) {
  const hRef = useRef<HTMLDivElement>(null);
  const vRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const el of [hRef.current, vRef.current]) {
      if (el) el.dataset.visible = "true";
    }
    const timer = setTimeout(() => {
      for (const el of [hRef.current, vRef.current]) {
        if (el) el.dataset.visible = "false";
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [position.x, position.y, scale]);

  const scaledW = imageSize.width * scale;
  const scaledH = imageSize.height * scale;

  const showH = scaledW > containerSize.width;
  const showV = scaledH > containerSize.height;

  if (!showH && !showV) return null;

  const PADDING = 8;
  const THICKNESS = 6;
  const MIN_THUMB = 30;

  // 수평
  const trackW =
    containerSize.width - PADDING * 2 - (showV ? THICKNESS + PADDING : 0);
  const marginX = containerSize.width * 0.5;
  const hMaxX = marginX;
  const hMinX = containerSize.width - scaledW - marginX;
  const hRange = hMaxX - hMinX;
  const hThumbW = Math.max(MIN_THUMB, (containerSize.width / scaledW) * trackW);
  const hFraction =
    hRange > 0 ? Math.max(0, Math.min(1, (hMaxX - position.x) / hRange)) : 0;
  const hThumbLeft = hFraction * (trackW - hThumbW);

  // 수직
  const trackH =
    containerSize.height - PADDING * 2 - (showH ? THICKNESS + PADDING : 0);
  const marginY = containerSize.height * 0.5;
  const vMaxY = marginY;
  const vMinY = containerSize.height - scaledH - marginY;
  const vRange = vMaxY - vMinY;
  const vThumbH = Math.max(
    MIN_THUMB,
    (containerSize.height / scaledH) * trackH,
  );
  const vFraction =
    vRange > 0 ? Math.max(0, Math.min(1, (vMaxY - position.y) / vRange)) : 0;
  const vThumbTop = vFraction * (trackH - vThumbH);

  return (
    <>
      {showH && (
        <div
          ref={hRef}
          data-visible="false"
          className="absolute pointer-events-none transition-opacity duration-300 data-[visible=true]:opacity-100 data-[visible=false]:opacity-0"
          style={{
            bottom: PADDING,
            left: PADDING,
            width: trackW,
            height: THICKNESS,
          }}
        >
          <div
            className="absolute rounded-full bg-white/40"
            style={{
              left: hThumbLeft,
              width: hThumbW,
              height: THICKNESS,
            }}
          />
        </div>
      )}
      {showV && (
        <div
          ref={vRef}
          data-visible="false"
          className="absolute pointer-events-none transition-opacity duration-300 data-[visible=true]:opacity-100 data-[visible=false]:opacity-0"
          style={{
            right: PADDING,
            top: PADDING,
            width: THICKNESS,
            height: trackH,
          }}
        >
          <div
            className="absolute rounded-full bg-white/40"
            style={{
              top: vThumbTop,
              width: THICKNESS,
              height: vThumbH,
            }}
          />
        </div>
      )}
    </>
  );
}
