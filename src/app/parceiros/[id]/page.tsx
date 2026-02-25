import Placeholder from "@/components/placeholder"

export default function ParceiroDetalhe({ params }: { params: { id: string } }) {
    return <Placeholder title={`Parceiro #${params.id}`} backHref="/parceiros" description="Veja os benefícios e ações deste parceiro." />
}
