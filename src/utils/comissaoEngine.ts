import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PlanoComissao, CompetenciaNota } from '../types/models';

// Reexporta o tipo PlanoComissao para facilitar a importação em outras páginas
export type { PlanoComissao, CompetenciaNota };

/**
 * Estrutura de cada parcela gerada pelo motor de comissão.
 */
export interface ParcelaCalculada {
  numeroParcela: number;
  mesAnoReferencia: string;
  valorReceber: number;
  status: 'CONFIRMADA' | 'AGUARDANDO_CLIENTE';
  clientePagou: boolean;
}

/**
 * Modelos iniciais criados automaticamente caso o usuário ainda não tenha nenhum plano.
 * Você pode ajustar os nomes, percentuais ou quantidades de parcelas aqui se desejar.
 */
const PLANOS_PADRAO: Omit<PlanoComissao, 'id' | 'userId'>[] = [
  {
    nome: 'Padrão 1,5% (13 parcelas)',
    percentualBase: 1.5,
    parcelasBase: 13,
    temBonus: false,
    percentualBonus: 0,
    parcelaBonus: 0,
  },
  {
    nome: 'Intermediário 1,66% (13 parcelas)',
    percentualBase: 1.66,
    parcelasBase: 13,
    temBonus: false,
    percentualBonus: 0,
    parcelaBonus: 0,
  },
  {
    nome: 'Especial 2,0% (13x) + 0,3% na 15ª parcela',
    percentualBase: 2.0,
    parcelasBase: 13,
    temBonus: true,
    percentualBonus: 0.3,
    parcelaBonus: 15,
  },
];

/**
 * Normalizador de planos:
 * Lê documentos do Firestore (sejam antigos ou novos) e devolve um objeto
 * padronizado com todos os campos numéricos preenchidos, evitando erros de cálculo (NaN).
 */
function normalizarPlano(id: string, dadosBrutos: Record<string, any>): PlanoComissao {
  const percentualBase = Number(dadosBrutos.percentualBase ?? dadosBrutos.percentualTotal ?? 0);
  const parcelasBase = Number(dadosBrutos.parcelasBase ?? dadosBrutos.parcelasRegulares ?? 1);
  const percentualBonus = Number(dadosBrutos.percentualBonus ?? 0);
  const parcelaBonus = Number(dadosBrutos.parcelaBonus ?? dadosBrutos.parcelaBonusNumero ?? 0);
  const temBonus =
    dadosBrutos.temBonus !== undefined
      ? Boolean(dadosBrutos.temBonus)
      : percentualBonus > 0 && parcelaBonus > 0;

  return {
    id,
    userId: dadosBrutos.userId || '',
    nome: dadosBrutos.nome || 'Plano sem nome',
    percentualBase,
    parcelasBase,
    temBonus,
    percentualBonus,
    parcelaBonus,
    // Mantém os campos antigos espelhados caso alguma tela legada ainda os consulte
    percentualTotal: percentualBase,
    parcelasRegulares: parcelasBase,
    parcelaBonusNumero: parcelaBonus,
  };
}

/**
 * Busca os planos de comissão do usuário no Firestore.
 * Se ainda não existirem, cria automaticamente os 3 planos iniciais.
 */
export async function buscarOuInicializarPlanos(userId: string): Promise<PlanoComissao[]> {
  if (!userId) return [];

  const q = query(collection(db, 'planos_comissao'), where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const planos = snapshot.docs.map((documento) =>
      normalizarPlano(documento.id, documento.data())
    );
    return planos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  const criados: PlanoComissao[] = [];
  for (const plano of PLANOS_PADRAO) {
    const docRef = await addDoc(collection(db, 'planos_comissao'), {
      ...plano,
      userId,
      createdAt: serverTimestamp(),
    });
    criados.push({ id: docRef.id, userId, ...plano });
  }

  return criados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Calcula o cronograma completo de comissões aplicando:
 * - Competência da Nota ('ATUAL' -> +1 mês | 'PROXIMO' -> +2 meses).
 *   Caso não seja informada, aplica a regra padrão: até dia 15 -> 'ATUAL', após dia 15 -> 'PROXIMO'.
 * - 1ª parcela já nasce CONFIRMADA (contrato fechado).
 * - 2ª parcela em diante nasce AGUARDANDO_CLIENTE.
 * - Parcela bônus extra (quando ativada no plano).
 */
export function calcularCronogramaComissao(
  valorTotalCarta: number,
  dataVendaISO: string,
  plano: PlanoComissao,
  competenciaNota?: CompetenciaNota
): {
  valorComissaoTotal: number;
  qtdParcelasTotal: number;
  parcelas: ParcelaCalculada[];
} {
  // 1. Garante que o valor da carta seja um número positivo válido
  const valorCartaSeguro =
    Number.isFinite(valorTotalCarta) && valorTotalCarta > 0 ? valorTotalCarta : 0;

  // 2. Extrai ano, mês e dia da data da venda no formato AAAA-MM-DD
  const dataLimpa =
    dataVendaISO && dataVendaISO.includes('-')
      ? dataVendaISO
      : new Date().toISOString().split('T')[0];

  const [anoStr, mesStr, diaStr] = dataLimpa.split('-').map(Number);
  const dia = diaStr || 1;
  const mesBaseIndex = (mesStr || 1) - 1; // No JavaScript, Janeiro = 0 e Dezembro = 11
  const anoBase = anoStr || new Date().getFullYear();

  // 3. Padroniza os dados do plano escolhido
  const planoNormalizado = normalizarPlano(plano.id || '', plano as Record<string, any>);
  const parcelasBaseSeguras = Math.max(1, planoNormalizado.parcelasBase);

  // 4. Define em qual mês cairá a 1ª parcela com base na escolha da nota (ou regra do dia 15)
  const competenciaEfetiva: CompetenciaNota =
    competenciaNota ?? (dia <= 15 ? 'ATUAL' : 'PROXIMO');
  const deslocamentoInicial = competenciaEfetiva === 'ATUAL' ? 1 : 2;

  // 5. Calcula o valor total da comissão base e o valor de cada parcela regular
  const comissaoBase = valorCartaSeguro * (planoNormalizado.percentualBase / 100);
  const valorParcelaRegular = comissaoBase / parcelasBaseSeguras;

  const parcelas: ParcelaCalculada[] = [];

  // 6. Gera todas as parcelas regulares mês a mês
  for (let i = 1; i <= parcelasBaseSeguras; i++) {
    const dataFechamento = new Date(anoBase, mesBaseIndex + deslocamentoInicial + (i - 1), 1);
    const mesFormatado = `${String(dataFechamento.getMonth() + 1).padStart(2, '0')}/${dataFechamento.getFullYear()}`;
    const ehPrimeira = i === 1;

    parcelas.push({
      numeroParcela: i,
      mesAnoReferencia: mesFormatado,
      valorReceber: Number(valorParcelaRegular.toFixed(2)),
      status: ehPrimeira ? 'CONFIRMADA' : 'AGUARDANDO_CLIENTE',
      clientePagou: ehPrimeira,
    });
  }

  let valorComissaoTotal = comissaoBase;
  let qtdParcelasTotal = parcelasBaseSeguras;

  // 7. Verifica se o plano possui parcela bônus e a adiciona no mês correspondente
  const possuiBonusValido =
    planoNormalizado.temBonus &&
    (planoNormalizado.percentualBonus ?? 0) > 0 &&
    (planoNormalizado.parcelaBonus ?? 0) > 0;

  if (possuiBonusValido) {
    const percentualBonus = planoNormalizado.percentualBonus!;
    const numeroParcelaBonus = planoNormalizado.parcelaBonus!;

    const valorBonus = valorCartaSeguro * (percentualBonus / 100);
    const dataBonus = new Date(
      anoBase,
      mesBaseIndex + deslocamentoInicial + (numeroParcelaBonus - 1),
      1
    );
    const mesBonusFormatado = `${String(dataBonus.getMonth() + 1).padStart(2, '0')}/${dataBonus.getFullYear()}`;

    parcelas.push({
      numeroParcela: numeroParcelaBonus,
      mesAnoReferencia: mesBonusFormatado,
      valorReceber: Number(valorBonus.toFixed(2)),
      status: 'AGUARDANDO_CLIENTE',
      clientePagou: false,
    });

    valorComissaoTotal += valorBonus;
    qtdParcelasTotal += 1;
  }

  return {
    valorComissaoTotal: Number(valorComissaoTotal.toFixed(2)),
    qtdParcelasTotal,
    parcelas,
  };
}

/**
 * Grava a venda e todas as suas parcelas de comissão no Firestore em uma operação unificada.
 */
export async function registrarVendaUnificada(params: {
  userId: string;
  clienteId: string;
  valorTotalCarta: number;
  tipoCarta: string;
  grupo: string;
  cota: string;
  dataVendaISO: string;
  plano: PlanoComissao;
  competenciaNota?: CompetenciaNota;
}) {
  const {
    userId,
    clienteId,
    valorTotalCarta,
    tipoCarta,
    grupo,
    cota,
    dataVendaISO,
    plano,
    competenciaNota,
  } = params;

  const [ano, mes, dia] = dataVendaISO.split('-').map(Number);
  const diaSeguro = dia || 1;

  // Define a competência final (manual ou automática pela regra do dia 15)
  const competenciaFinal: CompetenciaNota =
    competenciaNota ?? (diaSeguro <= 15 ? 'ATUAL' : 'PROXIMO');

  // 1. Calcula todo o cronograma de parcelas antes de gravar no banco
  const cronograma = calcularCronogramaComissao(
    valorTotalCarta,
    dataVendaISO,
    plano,
    competenciaFinal
  );

  if (
    Number.isNaN(cronograma.valorComissaoTotal) ||
    cronograma.valorComissaoTotal <= 0 ||
    cronograma.parcelas.length === 0
  ) {
    throw new Error('Não foi possível calcular a comissão. Verifique os valores da carta e do plano.');
  }

  // Cria o objeto Date ao meio-dia para evitar deslocamento de fuso horário
  const dataVendaObj = new Date(ano, mes - 1, diaSeguro, 12, 0, 0);

  // 2. Grava o documento principal da venda na coleção 'vendas'
  const vendaRef = await addDoc(collection(db, 'vendas'), {
    userId,
    clienteId,
    valorTotalCarta,
    tipoCarta,
    grupo,
    cota,
    dataVenda: dataVendaObj,
    competenciaNota: competenciaFinal,
    valorComissaoTotal: cronograma.valorComissaoTotal,
    planoComissaoId: plano.id || '',
    planoComissaoNome: plano.nome,
    qtdParcelasComissao: cronograma.qtdParcelasTotal,
    createdAt: serverTimestamp(),
  });

  // 3. Grava todas as parcelas vinculadas ao ID da venda recém-criada
  const gravacoesParcelas = cronograma.parcelas.map((parc) =>
    addDoc(collection(db, 'parcelas'), {
      userId,
      vendaId: vendaRef.id,
      clienteId,
      numeroParcela: parc.numeroParcela,
      mesAnoReferencia: parc.mesAnoReferencia,
      valorReceber: parc.valorReceber,
      status: parc.status,
      clientePagou: parc.clientePagou,
      dataConfirmacaoPagamento: parc.clientePagou ? dataVendaISO : '',
    })
  );

  await Promise.all(gravacoesParcelas);
  return vendaRef.id;
}
