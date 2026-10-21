/**
 * Formata uma string de texto para o padrão de CPF: 000.000.000-00
 */
export const mascaraCPF = (valor: string) => {
  return valor
    .replace(/\D/g, '') // Remove tudo o que não for número
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto após os primeiros 3 números
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto após os próximos 3 números
    .replace(/(\d{3})(\d{1,2})/, '$1-$2') // Coloca um traço antes dos últimos 2 números
    .replace(/(-\d{2})\d+?$/, '$1'); // Impede a digitação de mais números que o permitido
};

/**
 * Formata uma string de texto para o padrão de Telefone: (00) 00000-0000
 */
export const mascaraTelefone = (valor: string) => {
  return valor
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2') // Coloca parênteses em volta do DDD
    .replace(/(\d{5})(\d)/, '$1-$2') // Coloca o traço após os 5 primeiros dígitos
    .replace(/(-\d{4})\d+?$/, '$1'); // Limita o tamanho máximo
};

/**
 * Formata uma string para o padrão monetário brasileiro (BRL): R$ 0.000,00
 */
export const mascaraMoeda = (valor: string) => {
  // Remove tudo que não for número
  const apenasNumeros = valor.replace(/\D/g, '');
  
  // Se o campo ficar vazio, retorna vazio
  if (!apenasNumeros) return '';

  // Divide por 100 para colocar as duas casas decimais
  const valorDecimal = Number(apenasNumeros) / 100;

  // Formata usando a API nativa de internacionalização do JavaScript
  return valorDecimal.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};
