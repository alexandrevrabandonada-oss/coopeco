import Placeholder from "@/components/placeholder"

export default function BairroDetalhe({ params }: { params: { slug: string } }) {
    const name = params.slug.charAt(0).toUpperCase() + params.slug.slice(1)
    return <Placeholder title={`Bairro: ${name}`} backHref="/" description={`Ranking e ações sustentáveis ocorrendo em ${name}.`} />
}
