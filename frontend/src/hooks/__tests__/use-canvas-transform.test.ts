import { describe, it, expect } from "vitest";
import { clampPosition } from "../use-canvas-transform";

// ---------------------------------------------------------------------------
// clampPosition 순수 함수 단위 테스트
// ---------------------------------------------------------------------------

describe("clampPosition", () => {
  // -----------------------------------------------------------------------
  // 1. imageSize undefined — 원래 위치 반환
  // -----------------------------------------------------------------------
  describe("imageSize가 undefined일 때", () => {
    it("전달된 위치를 그대로 반환한다", () => {
      const pos = { x: 123, y: 456 };
      const result = clampPosition(pos, 1, 800, 600, undefined);
      expect(result).toEqual(pos);
    });

    it("어떤 scale 값이어도 원래 위치를 반환한다", () => {
      const pos = { x: -9999, y: 9999 };
      const result = clampPosition(pos, 5, 800, 600, undefined);
      expect(result).toEqual(pos);
    });
  });

  // -----------------------------------------------------------------------
  // 2. 이미지가 컨테이너보다 작을 때 — 중앙 정렬
  // -----------------------------------------------------------------------
  describe("이미지가 컨테이너보다 작을 때", () => {
    it("정확히 컨테이너 중앙에 위치시킨다", () => {
      // 이미지 400×300, 컨테이너 800×600, scale 1 → scaled 400×300 < 800×600
      const result = clampPosition({ x: 0, y: 0 }, 1, 800, 600, {
        width: 400,
        height: 300,
      });
      expect(result.x).toBe((800 - 400) / 2); // 200
      expect(result.y).toBe((600 - 300) / 2); // 150
    });

    it("입력 위치와 무관하게 중앙값을 반환한다", () => {
      const result = clampPosition({ x: 999, y: -999 }, 1, 800, 600, {
        width: 400,
        height: 300,
      });
      expect(result.x).toBe(200);
      expect(result.y).toBe(150);
    });

    it("scale < 1 이어서 이미지가 더 작아진 경우에도 중앙 정렬", () => {
      // 이미지 1000×800, scale 0.5 → scaled 500×400 vs 컨테이너 800×600
      const result = clampPosition({ x: 0, y: 0 }, 0.5, 800, 600, {
        width: 1000,
        height: 800,
      });
      expect(result.x).toBe((800 - 500) / 2); // 150
      expect(result.y).toBe((600 - 400) / 2); // 100
    });
  });

  // -----------------------------------------------------------------------
  // 3. 이미지가 클 때 — 50% 마진 클램핑
  // -----------------------------------------------------------------------
  describe("이미지가 컨테이너보다 클 때", () => {
    // 컨테이너 800×600, 이미지 1600×1200, scale 1 → scaled 1600×1200
    // marginX = 400, marginY = 300
    // minX = 800 - 1600 - 400 = -1200,  maxX = 400
    // minY = 600 - 1200 - 300 = -900,   maxY = 300
    const imgSize = { width: 1600, height: 1200 };
    const scale = 1;
    const cw = 800;
    const ch = 600;

    it("허용 범위 내 위치는 그대로 반환한다", () => {
      const pos = { x: 0, y: 0 };
      const result = clampPosition(pos, scale, cw, ch, imgSize);
      expect(result).toEqual(pos);
    });

    it("minX 경계: pos.x = minX 일 때 그대로 반환한다", () => {
      const pos = { x: -1200, y: 0 };
      const result = clampPosition(pos, scale, cw, ch, imgSize);
      expect(result.x).toBe(-1200);
    });

    it("maxX 경계: pos.x = maxX 일 때 그대로 반환한다", () => {
      const pos = { x: 400, y: 0 };
      const result = clampPosition(pos, scale, cw, ch, imgSize);
      expect(result.x).toBe(400);
    });

    it("minY 경계: pos.y = minY 일 때 그대로 반환한다", () => {
      const pos = { x: 0, y: -900 };
      const result = clampPosition(pos, scale, cw, ch, imgSize);
      expect(result.y).toBe(-900);
    });

    it("maxY 경계: pos.y = maxY 일 때 그대로 반환한다", () => {
      const pos = { x: 0, y: 300 };
      const result = clampPosition(pos, scale, cw, ch, imgSize);
      expect(result.y).toBe(300);
    });

    it("x가 minX 미만이면 minX로 클램핑한다", () => {
      const result = clampPosition({ x: -9999, y: 0 }, scale, cw, ch, imgSize);
      expect(result.x).toBe(-1200);
    });

    it("x가 maxX 초과이면 maxX로 클램핑한다", () => {
      const result = clampPosition({ x: 9999, y: 0 }, scale, cw, ch, imgSize);
      expect(result.x).toBe(400);
    });

    it("y가 minY 미만이면 minY로 클램핑한다", () => {
      const result = clampPosition({ x: 0, y: -9999 }, scale, cw, ch, imgSize);
      expect(result.y).toBe(-900);
    });

    it("y가 maxY 초과이면 maxY로 클램핑한다", () => {
      const result = clampPosition({ x: 0, y: 9999 }, scale, cw, ch, imgSize);
      expect(result.y).toBe(300);
    });

    it("x, y 모두 범위 초과 시 둘 다 클램핑한다", () => {
      const result = clampPosition(
        { x: 9999, y: 9999 },
        scale,
        cw,
        ch,
        imgSize,
      );
      expect(result.x).toBe(400);
      expect(result.y).toBe(300);
    });
  });

  // -----------------------------------------------------------------------
  // 4. scale이 커서 이미지가 컨테이너를 초과하게 된 경우
  // -----------------------------------------------------------------------
  describe("scale이 크게 변경된 경우", () => {
    it("scale 2 적용 시 경계가 올바르게 계산된다", () => {
      // 이미지 400×300, scale 2 → scaled 800×600 = 컨테이너 800×600 (딱 같은 크기)
      // scaledW(800) <= containerW(800) AND scaledH(600) <= containerH(600) → 중앙 정렬
      const result = clampPosition({ x: 100, y: 100 }, 2, 800, 600, {
        width: 400,
        height: 300,
      });
      expect(result.x).toBe(0); // (800 - 800) / 2
      expect(result.y).toBe(0); // (600 - 600) / 2
    });

    it("scale 2.1 적용 시 이미지가 컨테이너보다 커서 클램핑 경계로 들어간다", () => {
      // 이미지 400×300, scale 2.1 → scaled 840×630 > 800×600
      const scale = 2.1;
      const imgSize = { width: 400, height: 300 };
      const cw = 800;
      const ch = 600;
      const scaledW = 400 * scale; // 840
      const scaledH = 300 * scale; // 630
      const marginX = cw * 0.5; // 400
      const marginY = ch * 0.5; // 300
      const minX = cw - scaledW - marginX; // 800 - 840 - 400 = -440
      const maxX = marginX; // 400
      const minY = ch - scaledH - marginY; // 600 - 630 - 300 = -330
      const maxY = marginY; // 300

      const result = clampPosition(
        { x: -999, y: -999 },
        scale,
        cw,
        ch,
        imgSize,
      );
      expect(result.x).toBe(minX);
      expect(result.y).toBe(minY);

      const result2 = clampPosition({ x: 999, y: 999 }, scale, cw, ch, imgSize);
      expect(result2.x).toBe(maxX);
      expect(result2.y).toBe(maxY);
    });
  });

  // -----------------------------------------------------------------------
  // 5. 경계 조건: 이미지 크기가 컨테이너와 정확히 같을 때
  // -----------------------------------------------------------------------
  describe("이미지 크기가 컨테이너와 동일할 때", () => {
    it("중앙 정렬 조건(<=)이 충족되어 (0, 0)을 반환한다", () => {
      // scaledW === containerWidth → 중앙 정렬 → (800-800)/2 = 0
      const result = clampPosition({ x: 50, y: 50 }, 1, 800, 600, {
        width: 800,
        height: 600,
      });
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 6. minX/maxX 수식 검증 — 50% 마진 공식 확인
  // -----------------------------------------------------------------------
  describe("50% 마진 수식 검증", () => {
    it("maxX는 containerWidth * 0.5와 같다", () => {
      const cw = 1000;
      const ch = 800;
      const imgSize = { width: 2000, height: 2000 };
      // 완전히 오른쪽 끝까지 밀면 maxX로 클램핑
      const result = clampPosition({ x: 99999, y: 0 }, 1, cw, ch, imgSize);
      expect(result.x).toBe(cw * 0.5); // 500
    });

    it("minX는 containerWidth - scaledW - containerWidth*0.5와 같다", () => {
      const cw = 1000;
      const ch = 800;
      const scale = 1;
      const imgSize = { width: 2000, height: 2000 };
      const scaledW = imgSize.width * scale; // 2000
      const expectedMinX = cw - scaledW - cw * 0.5; // 1000 - 2000 - 500 = -1500
      const result = clampPosition({ x: -99999, y: 0 }, scale, cw, ch, imgSize);
      expect(result.x).toBe(expectedMinX);
    });
  });
});
