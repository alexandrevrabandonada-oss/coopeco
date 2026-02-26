import Placeholder from "@/components/placeholder";
import { isGovFeatureEnabled } from "@/lib/features";
import BairroDecisoesClient from "./decisoes-client";

export default function BairroDecisoesPage({ params }: { params: { slug: string } }) {
  if (!isGovFeatureEnabled()) {
    return (
      <Placeholder
        title="Decisões do Bairro"
        backHref={`/bairros/${params.slug}`}
        description="Feature ECO_FEATURES_GOV desativada neste ambiente."
      />
    );
  }

  return <BairroDecisoesClient params={params} />;
}
