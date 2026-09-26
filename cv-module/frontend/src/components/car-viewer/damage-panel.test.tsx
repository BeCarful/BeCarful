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
        { partId: "hood", severity: "moderate", damageTypes: ["dent"] },
        {
          partId: "front_bumper",
          severity: "severe",
          damageTypes: ["crack", "detached_part"],
        },
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
      statusLabel="Sample data"
      emptyMessage="No visible damage findings."
      {...overrides}
    />,
  );
  return { onSelectPart };
}

describe("DamagePanel", () => {
  it("shows one legend swatch per semantic severity", () => {
    renderPanel();
    const legend = screen.getByRole("list", { name: /Visual damage severity/ });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps semantic severity labels when the scale changes", () => {
    renderPanel({ scale: buildDamageScale(4) });
    const legend = screen.getByRole("list", {
      name: /Visual damage severity/,
    });
    expect(within(legend).getByText("Minor")).toBeInTheDocument();
    expect(within(legend).getByText("Moderate")).toBeInTheDocument();
    expect(within(legend).getByText("Severe")).toBeInTheDocument();
  });

  it("lists damaged parts most severe first with damage types", () => {
    renderPanel();
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Front bumper");
    expect(rows[0]).toHaveTextContent("Severe · Crack, Detached part");
    expect(rows[1]).toHaveTextContent("Hood");
    expect(rows[1]).toHaveTextContent("Moderate · Dent");
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

  it("shows the supplied result status", () => {
    renderPanel({ statusLabel: "Gemini result" });
    expect(screen.getByText("Gemini result")).toBeInTheDocument();
    expect(screen.queryByText("Sample data")).not.toBeInTheDocument();
  });
});
