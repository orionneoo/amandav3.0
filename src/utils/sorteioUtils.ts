export function sortearMembros(participantes: string[], opcoes: { excluir?: string[], quantidade?: number } = {}): string[] {
  let lista = participantes;
  if (opcoes.excluir && opcoes.excluir.length > 0) {
    lista = lista.filter(jid => !opcoes.excluir!.includes(jid));
  }
  if (opcoes.quantidade && opcoes.quantidade > 0) {
    lista = lista.sort(() => 0.5 - Math.random()).slice(0, opcoes.quantidade);
  } else {
    lista = lista.sort(() => 0.5 - Math.random());
  }
  return lista;
} 