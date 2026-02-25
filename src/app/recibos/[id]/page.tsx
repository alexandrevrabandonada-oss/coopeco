import Placeholder from "@/components/placeholder"

export default function ReciboDetalhe({ params }: { params: { id: string } }) {
    return <Placeholder title={`Recibo ECO #${params.id}`} backHref="/recibos" description="Detalhes da validação de seu descarte." />
}
