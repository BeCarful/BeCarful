import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { resolveDamage, sortBySeverity } from "@/lib/damage/damage-report";
import { buildDamageScale } from "@/lib/damage/damage-scale";

import { DamagePanel } from "./damage-panel";

const scale = buildDamageScale(6);
const damagedParts = sortBySeverity(
  resolveDamage(
    {
      parts: [
        { partId: "hood", score: 0.45 },
        { partId: "front_bumper", score: 0.92 },
      ],
    },
    scale,
  ),
);

function renderPanel(
  overrides: Partial<Parameters<typeof DamagePanel>[0]> = {},
) {
  const onSelectPart = vi.fn();
  render(
    <DamagePanel
      scale={scale}
      damagedParts={damagedParts}
      selectedPartId={null}
      onSelectPart={onSelectPart}
      isSampleData
      {...overrides}
    />,
  );
  return { onSelectPart };
}

describe("DamagePanel", () => {
  it("shows one legend swatch per level", () => {
    renderPanel();
    const legend = screen.getByRole("list", { name: /Damage levels/ });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(6);
  });

  it("follows the level count when the scale changes", () => {
    renderPanel({ scale: buildDamageScale(4) });
    const legend = screen.getByRole("list", {
      name: /1 \(low\) to 4 \(high\)/,
    });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(4);
  });

  it("lists damaged parts most severe first with level and score", () => {
    renderPanel();
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Front bumper");
    expect(rows[0]).toHaveTextContent("L6 · 92%");
    expect(rows[1]).toHaveTextContent("Hood");
    expect(rows[1]).toHaveTextContent("L3 · 45%");
  });

  it("selects a part when its row is clicked", async () => {
    const user = userEvent.setup();
    const { onSelectPart } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Hood/ }));
    expect(onSelectPart).toHaveBeenCalledWith("hood");
  });

  it("marks the selected row", () => {
    renderPanel({ selectedPartId: "hood" });
    expect(screen.getByRole("button", { name: /Hood/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Front bumper/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("explains when the selected part has no damage", () => {
    renderPanel({ selectedPartId: "roof" });
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Roof — no damage reported",
      ),
    ).toBeInTheDocument();
  });

  it("shows the sample data badge only for sample data", () => {
    renderPanel({ isSampleData: false });
    expect(screen.queryByText("Sample data")).not.toBeInTheDocument();
  });
});
