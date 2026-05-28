import { createFileRoute } from "@tanstack/react-router";
import { Configurator } from "@/components/configurator/Configurator";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Insert Configurator — Tabletop Foundry" },
      {
        name: "description",
        content:
          "Design custom 3D-printed board game inserts with a precise drag-and-drop configurator. Snap-to-grid layout and collision detection.",
      },
    ],
  }),
});

function Index() {
  return <Configurator />;
}
