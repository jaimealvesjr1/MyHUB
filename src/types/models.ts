/**
 * Segmentos de carta de consórcio disponíveis no sistema.
 * O "| string" garante compatibilidade com registros antigos do banco de dados.
 */
export type TipoCartaConsorcio = 'Imobiliária' | 'Automotiva' | 'Serviços' | string;

/**
 * Define em qual fechamento de nota fiscal a venda foi faturada:
 * - 'ATUAL': entra na nota do próprio mês da venda (1º recebimento no mês seguinte).
 * - 'PROXIMO': entra na nota do mês seguinte à venda (1º recebimento em 2 meses).
 */
export type CompetenciaNota = 'ATUAL' | 'PROXIMO';

/**
 * Estrutura de um plano/regra de comissionamento do consultor.
 */
export interface PlanoComissao {
  id?: string;
  userId: string;
  nome: string;

  // Campos principais utilizados na tela de Configurações e no motor de cálculo
  percentualBase: number;
  parcelasBase: number;
  temBonus?: boolean;
  percentualBonus?: number;
  parcelaBonus?: number;

  // Campos legados opcionais (mantidos para compatibilidade com planos antigos do banco)
  percentualTotal?: number;
  parcelasRegulares?: number;
  parcelaBonusNumero?: number;
}

/**
 * Dados cadastrais de um cliente da carteira.
 */
export interface Cliente {
  id?: string;
  nomeCompleto: string;
  cpf: string;
  telefone: string;
  dataNascimento?: string;
  dataCadastro?: any;
  userId?: string;
}

/**
 * Dados de uma venda/cota de consórcio vinculada a um cliente.
 */
export interface VendaConsorcio {
  id?: string;
  userId: string;
  clienteId: string;
  valorTotalCarta: number;
  tipoCarta: TipoCartaConsorcio;
  grupo: string;
  cota: string;
  dataVenda: any;
  competenciaNota?: CompetenciaNota; // Define se a venda entrou na nota do mês atual ou do próximo
  valorComissaoTotal: number;
  planoComissaoId?: string;
  planoComissaoNome?: string;
  qtdParcelasComissao?: number;
}

/**
 * Parcela mensal de comissão gerada a partir de uma venda:
 * - 1ª parcela: nasce como 'CONFIRMADA' (contrato fechado).
 * - 2ª parcela em diante: nasce como 'AGUARDANDO_CLIENTE' até clicar no botão "Pago".
 */
export interface ParcelaComissao {
  id?: string;
  userId: string;
  vendaId: string;
  clienteId?: string;
  numeroParcela: number;
  mesAnoReferencia: string; // Formato "MM/AAAA"
  valorReceber: number;
  status: 'CONFIRMADA' | 'AGUARDANDO_CLIENTE' | 'PENDENTE' | 'PAGO' | string;
  clientePagou?: boolean;
  dataConfirmacaoPagamento?: string;
}
