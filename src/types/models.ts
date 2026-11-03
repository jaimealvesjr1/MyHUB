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

export type StatusProposta = 'Contato Inicial' | 'Proposta Enviada' | 'Em Negociação' | 'Ganho' | 'Perdido';

export interface Proposta {
  id?: string;               // Gerado pelo Firebase
  userId: string;            // O ID do corretor (dono da proposta)
  clienteNome: string;       // Nome do prospect/cliente
  clienteId?: string;        // ID do cliente (opcional, caso já esteja cadastrado)
  valorCredito: number;      // O "dinheiro na mesa" (Ex: Carta de 500 mil)
  status: StatusProposta;    // Em que fase da venda estamos
  dataCriacao: Date | any;   // Quando a proposta foi iniciada
  observacoes?: string;      // Notas para você lembrar de detalhes
}
