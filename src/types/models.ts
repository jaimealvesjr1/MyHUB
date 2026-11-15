export interface Cliente {
  id?: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  dataCadastro: Date;
}

export type TipoCartaConsorcio = 'Imobiliária' | 'Automotiva' | 'Serviços' | '';

export interface PlanoComissao {
  id?: string;
  userId: string;
  nome: string;               // Ex: "2% em 13 vezes + 0,3% na 15ª parcela"
  percentualBase: number;     // Ex: 2
  parcelasBase: number;       // Ex: 13
  temBonus?: boolean;         // Ex: true
  percentualBonus?: number;   // Ex: 0.3
  parcelaBonus?: number;      // Ex: 15
}

export interface VendaConsorcio {
  id?: string;
  userId: string;
  clienteId: string;
  valorTotalCarta: number;
  cota: string;
  grupo: string;
  tipoCarta: TipoCartaConsorcio;
  dataVenda: Date;
  planoComissaoId?: string;
  planoComissaoNome?: string;
  taxaAplicadaNaVenda?: number;
  valorComissaoTotal: number;
  qtdParcelasComissao?: number;
  dataPrimeiroRecebimento?: Date;
}

export interface ParcelaComissao {
  id?: string;
  userId?: string;
  vendaId: string;
  numeroParcela: number;
  valorReceber: number;
  mesAnoReferencia: string;
  status: 'PENDENTE' | 'PAGO';
}
