export interface Cliente {
  id?: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  dataCadastro: Date;
}

// 2. Tipagem restrita para o tipo de carta (evita erros de digitação no código)
export type TipoCartaConsorcio = 'Imobiliária' | 'Automotiva' | 'Serviços' | '';

// 3. Molde expandido para a Venda de Consórcio
export interface VendaConsorcio {
  id?: string;
  userId: string;
  clienteId: string; // Referência ao ID do cliente no banco (usaremos o nome provisoriamente)
  valorTotalCarta: number;
  cota: string;
  grupo: string;
  tipoCarta: TipoCartaConsorcio;
  dataVenda: Date;
  taxaAplicadaNaVenda: number; 
  valorComissaoTotal: number;
}

// 4. Molde para as parcelas mensais (mantido inalterado)
export interface ParcelaComissao {
  id?: string;
  vendaId: string;
  numeroParcela: number;
  valorReceber: number;
  mesAnoReferencia: string; 
  status: 'PENDENTE' | 'PAGO';
}

export interface ConfiguracoesCRM {
  taxaComissaoAtual: number;
}
