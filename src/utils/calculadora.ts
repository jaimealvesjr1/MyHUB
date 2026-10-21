import { VendaConsorcio, ParcelaComissao } from '../types/models';

export function gerarParcelas(venda: VendaConsorcio): ParcelaComissao[] {
  const parcelas: ParcelaComissao[] = [];
  const quantidadeMeses = 13;
  const valorPorMes = venda.valorComissaoTotal / quantidadeMeses;

  // Lemos a data de forma segura, extraindo o ano e o mês exatos da venda
  const dataBase = new Date(venda.dataVenda);
  let mesAtual = dataBase.getMonth(); 
  let anoAtual = dataBase.getFullYear();

  for (let i = 1; i <= quantidadeMeses; i++) {
    // Avançamos um mês de cada vez
    mesAtual++; 
    
    // Se o mês passar de dezembro (11 no JavaScript), viramos o ano
    if (mesAtual > 11) {
      mesAtual = 0; // Janeiro
      anoAtual++;
    }

    // Formata para MM/YYYY (somamos 1 porque janeiro é 0 no JS)
    const mesFormatado = String(mesAtual + 1).padStart(2, '0');
    const mesAnoReferencia = `${mesFormatado}/${anoAtual}`;

    parcelas.push({
      vendaId: venda.id || 'nova_venda', 
      numeroParcela: i,
      valorReceber: Number(valorPorMes.toFixed(2)),
      mesAnoReferencia: mesAnoReferencia,
      status: 'PENDENTE'
    });
  }

  return parcelas;
}
