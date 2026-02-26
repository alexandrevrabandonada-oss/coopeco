import Placeholder from "@/components/placeholder";
import { isPilotFeatureEnabled } from "@/lib/features";
import BairroTransparenciaClient from "./transparencia-client";

export default function BairroTransparenciaPage({ params }: { params: { slug: string } }) {
  if (!isPilotFeatureEnabled()) {
    return (
      <Placeholder
        title="Transparência Semanal"
        backHref={`/bairros/${params.slug}`}
        description="Feature ECO_FEATURES_PILOT desativada neste ambiente."
      />
    );
  }

  return <BairroTransparenciaClient params={params} />;
}
