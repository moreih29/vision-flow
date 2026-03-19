/** 스테이지 좌표 -> 이미지 좌표 (줌/팬 고려) */
export function stageToImage(
  stagePos: { x: number; y: number },
  stageScale: number,
  stageOffset: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: (stagePos.x - stageOffset.x) / stageScale,
    y: (stagePos.y - stageOffset.y) / stageScale,
  }
}

/** 이미지 좌표 -> normalized (0.0-1.0) */
export function imageToNormalized(
  imagePos: { x: number; y: number },
  imageSize: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: imagePos.x / imageSize.width,
    y: imagePos.y / imageSize.height,
  }
}

/** normalized -> 이미지 좌표 */
export function normalizedToImage(
  normPos: { x: number; y: number },
  imageSize: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: normPos.x * imageSize.width,
    y: normPos.y * imageSize.height,
  }
}

/** bbox normalized -> 이미지 rect */
export function normalizedBBoxToRect(
  bbox: { x: number; y: number; width: number; height: number },
  imageSize: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  return {
    x: bbox.x * imageSize.width,
    y: bbox.y * imageSize.height,
    width: bbox.width * imageSize.width,
    height: bbox.height * imageSize.height,
  }
}

/** 이미지 rect -> bbox normalized */
export function rectToNormalizedBBox(
  rect: { x: number; y: number; width: number; height: number },
  imageSize: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x / imageSize.width,
    y: rect.y / imageSize.height,
    width: rect.width / imageSize.width,
    height: rect.height / imageSize.height,
  }
}
