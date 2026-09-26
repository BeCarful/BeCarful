import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useViewerState } from "./use-viewer-state";

describe("useViewerState", () => {
  it("starts auto-rotating with doors closed", () => {
    const { result } = renderHook(() => useViewerState());

    expect(result.current.isAutoRotating).toBe(true);
    expect(result.current.areDoorsOpen).toBe(false);
    expect(result.current.resetToken).toBe(0);
  });

  it("toggles auto-rotate", () => {
    const { result } = renderHook(() => useViewerState());

    act(() => result.current.toggleAutoRotate());
    expect(result.current.isAutoRotating).toBe(false);

    act(() => result.current.toggleAutoRotate());
    expect(result.current.isAutoRotating).toBe(true);
  });

  it("toggles the doors", () => {
    const { result } = renderHook(() => useViewerState());

    act(() => result.current.toggleDoors());
    expect(result.current.areDoorsOpen).toBe(true);
  });

  it("increments the reset token on each reset", () => {
    const { result } = renderHook(() => useViewerState());

    act(() => result.current.resetView());
    act(() => result.current.resetView());
    expect(result.current.resetToken).toBe(2);
  });
});

describe("useViewerState part selection", () => {
  it("selects a part and pauses auto-rotate", () => {
    const { result } = renderHook(() => useViewerState());

    act(() => result.current.selectPart("hood"));
    expect(result.current.selectedPartId).toBe("hood");
    expect(result.current.isAutoRotating).toBe(false);
  });

  it("clears the selection when the same part is selected again or null is passed", () => {
    const { result } = renderHook(() => useViewerState());

    act(() => result.current.selectPart("hood"));
    act(() => result.current.selectPart("hood"));
    expect(result.current.selectedPartId).toBeNull();

    act(() => result.current.selectPart("roof"));
    act(() => result.current.selectPart(null));
    expect(result.current.selectedPartId).toBeNull();
  });
});
