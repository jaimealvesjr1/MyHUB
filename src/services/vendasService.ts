import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { VendaConsorcio, ParcelaComissao } from '../types/models';

function extrairTimestamp(data: any): number {
  if (!data) return 0;
  if (data instanceof Date) return data.getTime();
  if (data.seconds) return data.seconds * 1000;
  const parsed = new Date(data).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Regra única de negócio:
 * - Parcela 1: sempre confirmada (contrato fecha com o pagamento da 1ª parcela).
 * - Parcela >= 2: confirmada apenas quando o consultor clica em "Pago".
 */
export function isParcelaConfirmada(parcela: {
  numeroParcela: number;
  status?: string;
  clientePagou?: boolean;
}): boolean {
  if (parcela.numeroParcela === 1) return true;
  return (
    parcela.clientePagou === true ||
    parcela.status === 'CONFIRMADA' ||
    parcela.status === 'PAGO'
  );
}

/**
 * Confirma ou desfaz o pagamento da parcela pelo cliente (a partir da 2ª parcela),
 * liberando a comissão referente ao fechamento daquele mês.
 */
export async function alternarConfirmacaoParcela(
  parcelaId: string,
  confirmar: boolean
): Promise<void> {
  if (!parcelaId) throw new Error('Parcela inválida.');

  const parcelaRef = doc(db, 'parcelas', parcelaId);
  await updateDoc(parcelaRef, {
    clientePagou: confirmar,
    status: confirmar ? 'CONFIRMADA' : 'AGUARDANDO_CLIENTE',
    dataConfirmacaoPagamento: confirmar ? new Date().toISOString().split('T')[0] : '',
  });
}

/**
 * Busca todas as vendas do usuário logado em ordem cronológica (mais recentes primeiro).
 */
export async function buscarVendasDoBanco(): Promise<VendaConsorcio[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(collection(db, 'vendas'), where('userId', '==', user.uid));
  const snapshot = await getDocs(q);

  const lista = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<VendaConsorcio, 'id'>),
  }));

  return lista.sort((a, b) => extrairTimestamp(b.dataVenda) - extrairTimestamp(a.dataVenda));
}

/**
 * Busca todas as parcelas de comissão do usuário logado em ordem cronológica.
 */
export async function buscarParcelasDoBanco(): Promise<ParcelaComissao[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(collection(db, 'parcelas'), where('userId', '==', user.uid));
  const snapshot = await getDocs(q);

  const lista = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ParcelaComissao, 'id'>),
  }));

  return lista.sort((a, b) => {
    const [mesA, anoA] = a.mesAnoReferencia.split('/').map(Number);
    const [mesB, anoB] = b.mesAnoReferencia.split('/').map(Number);
    if (anoA !== anoB) return anoA - anoB;
    if (mesA !== mesB) return mesA - mesB;
    return a.numeroParcela - b.numeroParcela;
  });
}

/**
 * Atualiza dados cadastrais básicos de uma venda existente.
 */
export async function atualizarVendaNoBanco(
  vendaId: string,
  dadosAtualizados: Partial<VendaConsorcio>
): Promise<void> {
  const vendaRef = doc(db, 'vendas', vendaId);
  await updateDoc(vendaRef, dadosAtualizados);
}

/**
 * Exclui uma venda cadastrada e remove todas as suas parcelas vinculadas.
 */
export async function excluirVendaDoBanco(vendaId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !vendaId) throw new Error('Usuário ou venda inválida.');

  const qParcelas = query(
    collection(db, 'parcelas'),
    where('userId', '==', user.uid),
    where('vendaId', '==', vendaId)
  );
  const parcelasSnap = await getDocs(qParcelas);

  const exclusoesParcelas = parcelasSnap.docs.map((pDoc) =>
    deleteDoc(doc(db, 'parcelas', pDoc.id))
  );
  await Promise.all(exclusoesParcelas);

  await deleteDoc(doc(db, 'vendas', vendaId));
}
