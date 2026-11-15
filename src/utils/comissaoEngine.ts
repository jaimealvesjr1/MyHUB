import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PlanoComissao, ParcelaComissao, TipoCartaConsorcio } from '../types/models';

// Planos padrão criados automaticamente na primeira utilização
const PLANOS_INICIAIS: Omit<PlanoComissao, 'id' | 'userId'>[] = [
  {
    nome: '1,5% em 13 vezes',
    percentualBase: 1.5,
    parcelasBase: 13,
    temBonus: false,
    percentualBonus: 0,
    parcelaBonus: 0,
  },
  {
    nome: '1,66% em 13 vezes',
    percentualBase: 1.66,
    parcelasBase: 13,
    temBonus: false,
    percentualBonus: 0,
    parcelaBonus: 0,
  },
  {
    nome: '2% em 13 vezes + 0,3% na 15ª parcela',
    percentualBase: 2,
    parcelasBase: 13,
    temBonus: true,
    percentualBonus: 0.3,
    parcelaBonus: 15,
  },
];

/**
 * Busca os planos de comissionamento do usuário no Firebase.
 * Se ainda não houver nenhum cadastrado, cria os 3 planos padrão automaticamente.
 */
export async function buscarOuInicializarPlanos(userId: string): Promise<PlanoComissao[]> {
  if (!userId) return [];

  const q = query(collection(db, 'planos_comissao'), where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    const planosCriados: PlanoComissao[] = [];
    for (const plano of PLANOS_INICIAIS) {
      const docRef = await addDoc(collection(db, 'planos_comissao'), {
        ...plano,
        userId,
      });
      planosCriados.push({ id: docRef.id, userId, ...plano });
    }
    return planosCriados;
  }

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PlanoComissao, 'id'>),
  }));
}

/**
 * Calcula o valor total da comissão, aplica a regra de fechamento do dia 15
 * e monta o cronograma exato de parcelas (incluindo parcela bônus, se houver).
 */
export function calcularCronogramaComissao(
  valorCarta: number,
  dataVendaISO: string,
  plano: PlanoComissao
) {
  const comissaoBaseTotal = valorCarta * (plano.percentualBase / 100);
  const valorParcelaBase = comissaoBaseTotal / Math.max(plano.parcelasBase, 1);

  const comissaoBonusTotal =
    plano.temBonus && plano.percentualBonus
      ? valorCarta * (plano.percentualBonus / 100)
      : 0;

  const valorComissaoTotal = comissaoBaseTotal + comissaoBonusTotal;

  // Regra do Fechamento Dia 15:
  // Venda entre dia 01 e 15 -> 1ª parcela no mês seguinte (M + 1)
  // Venda entre dia 16 e 31 -> 1ª parcela em dois meses (M + 2)
  const [ano, mes, dia] = dataVendaISO.split('-').map(Number);
  const mesIndexInicio = dia <= 15 ? mes : mes + 1;
  const dataPrimeiroRecebimento = new Date(ano, mesIndexInicio, 15, 12, 0, 0);

  const parcelas: Omit<ParcelaComissao, 'id' | 'vendaId' | 'userId'>[] = [];

  // 1. Gera as parcelas base (ex: 1 a 13)
  for (let i = 1; i <= plano.parcelasBase; i++) {
    const dataParcela = new Date(ano, mesIndexInicio + (i - 1), 15);
    const mesRef = String(dataParcela.getMonth() + 1).padStart(2, '0');
    const anoRef = dataParcela.getFullYear();

    parcelas.push({
      numeroParcela: i,
      valorReceber: valorParcelaBase,
      mesAnoReferencia: `${mesRef}/${anoRef}`,
      status: 'PENDENTE',
    });
  }

  // 2. Aplica a parcela bônus (ex: 0,3% na 15ª parcela)
  if (plano.temBonus && comissaoBonusTotal > 0 && plano.parcelaBonus && plano.parcelaBonus > 0) {
    const parcelaExistente = parcelas.find((p) => p.numeroParcela === plano.parcelaBonus);

    if (parcelaExistente) {
      parcelaExistente.valorReceber += comissaoBonusTotal;
    } else {
      const dataBonus = new Date(ano, mesIndexInicio + (plano.parcelaBonus - 1), 15);
      const mesBonus = String(dataBonus.getMonth() + 1).padStart(2, '0');
      const anoBonus = dataBonus.getFullYear();

      parcelas.push({
        numeroParcela: plano.parcelaBonus,
        valorReceber: comissaoBonusTotal,
        mesAnoReferencia: `${mesBonus}/${anoBonus}`,
        status: 'PENDENTE',
      });
    }
  }

  const totalParcelasGeradas = Math.max(
    plano.parcelasBase,
    plano.temBonus && plano.parcelaBonus ? plano.parcelaBonus : 0
  );

  return {
    valorComissaoTotal,
    dataPrimeiroRecebimento,
    totalParcelasGeradas,
    parcelas,
  };
}

/**
 * Função única para registrar a Venda e todas as suas Parcelas no Firestore.
 * Usada tanto na conversão do Lead quanto no módulo Financeiro.
 */
export async function registrarVendaUnificada(params: {
  userId: string;
  clienteId: string;
  valorTotalCarta: number;
  tipoCarta: TipoCartaConsorcio;
  grupo: string;
  cota: string;
  dataVendaISO: string;
  plano: PlanoComissao;
}) {
  const { userId, clienteId, valorTotalCarta, tipoCarta, grupo, cota, dataVendaISO, plano } = params;

  const calculo = calcularCronogramaComissao(valorTotalCarta, dataVendaISO, plano);
  const dataVendaObj = new Date(`${dataVendaISO}T12:00:00`);

  const vendaRef = await addDoc(collection(db, 'vendas'), {
    userId,
    clienteId,
    valorTotalCarta,
    tipoCarta,
    grupo: grupo.trim(),
    cota: cota.trim(),
    dataVenda: dataVendaObj,
    planoComissaoId: plano.id || '',
    planoComissaoNome: plano.nome,
    taxaAplicadaNaVenda: plano.percentualBase,
    valorComissaoTotal: calculo.valorComissaoTotal,
    qtdParcelasComissao: calculo.totalParcelasGeradas,
    dataPrimeiroRecebimento: calculo.dataPrimeiroRecebimento,
  });

  for (const parcela of calculo.parcelas) {
    await addDoc(collection(db, 'parcelas'), {
      userId,
      vendaId: vendaRef.id,
      ...parcela,
    });
  }

  return vendaRef.id;
}
