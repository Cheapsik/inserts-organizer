import { createFileRoute } from "@tanstack/react-router";
import { Configurator } from "@/components/configurator/Configurator";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Konfigurator insertu — Przegródka" },
      {
        name: "description",
        content:
          "Skonfiguruj insert do gry planszowej — przeciągnij moduły, ustaw warstwy i sprawdź układ w 2D lub 3D.",
      },
    ],
  }),
});

function Index() {
  return <Configurator />;
}
