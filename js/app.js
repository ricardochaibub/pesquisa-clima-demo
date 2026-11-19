// Pesquisa de clima: telas de quem responde.
//
// O que este arquivo faz com os seus dados:
// - As respostas ficam só na memória desta aba até você tocar em "Enviar respostas".
// - O envio manda apenas { respostas, perfil }. Nada de cookies, identificadores ou horário.
// - A única coisa gravada no navegador é a marcação "já respondi" (localStorage),
//   que nunca é enviada ao servidor.

const app = document.getElementById('app');
const progresso = document.getElementById('progresso');
const progressoBarra = document.getElementById('progresso-barra');
const progressoPreenchido = document.getElementById('progresso-preenchido');

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];

// Versão de demonstração (página estática, sem servidor): serve para revisar perguntas e
// layout. Nela nada é enviado nem guardado, nem a marcação "já respondi".
const DEMO = document.documentElement.dataset.demo === '1';
const BASE = DEMO ? '' : '/';

let cfg = null;
let passos = [];
let passo = 0;
let enviando = false;
let enviado = false;
const respostas = {};
const perfil = {};

// ------------------------------------------------------------- utilidades

function h(tag, attrs, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs || {})) {
    if (valor === false || valor == null) continue;
    if (chave === 'class') el.className = valor;
    else if (chave.startsWith('on')) el.addEventListener(chave.slice(2), valor);
    else if (valor === true) el.setAttribute(chave, '');
    else el.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

const ICONES = {
  nao: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  sim: 'M3.5 8.5l3 3 6-7',
  info: 'M8 7.2v4.3M8 4.6v.2',
  relogio: 'M8 4.5V8l2.3 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z',
  calendario: 'M3 6.5h10M5.5 2.5v2M10.5 2.5v2M4 3.5h8a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z',
  pessoa: 'M8 8a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 8 8ZM3 13.2c.6-2 2.6-3.2 5-3.2s4.4 1.2 5 3.2M2.5 2.5l11 11',
  cadeado: 'M5 7V5a3 3 0 0 1 6 0v2M4 7h8a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z',
};

function icone(nome, tamanho = 14) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', tamanho);
  svg.setAttribute('height', tamanho);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const caminho = document.createElementNS(ns, 'path');
  caminho.setAttribute('d', ICONES[nome]);
  caminho.setAttribute('fill', 'none');
  caminho.setAttribute('stroke', 'currentColor');
  caminho.setAttribute('stroke-width', '1.7');
  caminho.setAttribute('stroke-linecap', 'round');
  caminho.setAttribute('stroke-linejoin', 'round');
  svg.append(caminho);
  return svg;
}

function dataPorExtenso(iso) {
  const [, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
}

function chaveRespondida() {
  return `pesquisa:${cfg.id}:respondida`;
}

function jaRespondeu() {
  try { return localStorage.getItem(chaveRespondida()) === '1'; } catch { return false; }
}

function marcarRespondida() {
  try { localStorage.setItem(chaveRespondida(), '1'); } catch { /* navegador sem armazenamento */ }
}

function temAlgumaResposta() {
  return Object.values(respostas).some((v) => {
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return v != null;
  });
}

// ----------------------------------------------- conteúdo sobre anonimato

function itemLista(tipo, nomeIcone, titulo, texto) {
  return h('li', null,
    h('span', { class: `lista-icone icone-${tipo}` }, icone(nomeIcone, 12)),
    h('span', null, h('strong', null, titulo), ' ', texto));
}

function conteudoAnonimato() {
  const minimo = cfg.minimo_por_recorte;
  return [
    h('section', { class: 'cartao' },
      h('h2', null, 'O que não coletamos'),
      h('ul', { class: 'lista' },
        itemLista('nao', 'nao', 'Nome, e-mail ou login.', 'Não existe cadastro, e o link é o mesmo para todo mundo.'),
        itemLista('nao', 'nao', 'Endereço IP.', 'O sistema da pesquisa não lê nem grava o seu IP.'),
        itemLista('nao', 'nao', 'Horário da resposta.', 'Guardamos só o dia do envio, sem hora nem minuto.'),
        itemLista('nao', 'nao', 'Seu aparelho.', 'Nada de modelo, navegador, localização ou qualquer "impressão digital".'),
        itemLista('nao', 'nao', 'Rastreadores.', 'Esta página não tem cookies, analytics nem scripts de outras empresas.'))),
    h('section', { class: 'cartao' },
      h('h2', null, 'O que fica guardado'),
      h('ul', { class: 'lista' },
        itemLista('sim', 'sim', 'As respostas que você der', 'e o dia em que enviou.'),
        itemLista('sim', 'sim', 'Sua área e seu tempo de casa,', 'só se você quiser informar. As duas perguntas são opcionais e usam faixas, nunca o cargo ou a data exata.'))),
    h('section', { class: 'cartao' },
      h('h2', null, 'Como os resultados são vistos'),
      h('ul', { class: 'lista' },
        itemLista('info', 'info', `Só em grupos de ${minimo} ou mais.`, `Qualquer recorte com menos de ${minimo} respostas aparece como "dados insuficientes para preservar o anonimato". As palavras escolhidas só aparecem no total da empresa, nunca por área ou tempo de casa.`),
        itemLista('info', 'info', 'Comentários soltos e embaralhados.', 'O que você escrever é guardado separado das suas outras respostas e nunca aparece junto de área ou tempo de casa.'),
        itemLista('info', 'info', 'Nada em tempo real.', `As respostas só entram no painel a partir do dia seguinte, em lotes de pelo menos ${minimo}. Depois do encerramento, entram as que faltavam.`),
        itemLista('info', 'info', 'Painel com senha.', cfg.acesso_painel),
        itemLista('info', 'info', 'Uma marcação no seu navegador.', 'Para evitar resposta repetida, seu navegador guarda que você já respondeu. Essa marcação fica só no seu aparelho e nunca é enviada.'))),
  ];
}

// ------------------------------------------------------------ componentes

function campoEscala(pergunta, valores, rotulos, classe, pontas) {
  const escolhida = h('p', { class: 'escolhida', 'aria-live': 'polite' });
  const mostrarEscolhida = () => {
    const v = respostas[pergunta.id];
    escolhida.textContent = v == null ? '' : `${v} · ${rotulos(v)}`;
  };
  const opcoes = valores.map((v) => {
    const input = h('input', {
      type: 'radio',
      name: pergunta.id,
      value: v,
      'aria-label': `${v}: ${rotulos(v)}`,
      checked: respostas[pergunta.id] === v,
    });
    input.addEventListener('click', () => {
      if (respostas[pergunta.id] === v) {
        input.checked = false;      // tocar de novo desmarca: toda pergunta é opcional
        delete respostas[pergunta.id];
      } else {
        respostas[pergunta.id] = v;
      }
      mostrarEscolhida();
    });
    return h('label', { class: 'opcao' }, input, h('span', null, v));
  });
  mostrarEscolhida();
  const tituloId = `titulo-${pergunta.id}`;
  return h('div', { class: 'pergunta', role: 'radiogroup', 'aria-labelledby': tituloId },
    h('h2', { class: 'pergunta-titulo', id: tituloId }, pergunta.texto),
    h('div', { class: `escala ${classe}` }, opcoes),
    h('div', { class: 'escala-pontas', 'aria-hidden': 'true' }, h('span', null, pontas[0]), h('span', null, pontas[1])),
    escolhida);
}

function campoPalavras(pergunta) {
  const tituloId = `titulo-${pergunta.id}`;
  const escolhidas = new Set(respostas[pergunta.id] || []);
  const contador = h('p', { class: 'escolhida', 'aria-live': 'polite' });
  const inputs = [];
  const atualizar = () => {
    const cheio = escolhidas.size >= pergunta.maximo;
    for (const input of inputs) input.disabled = cheio && !input.checked;
    if (escolhidas.size === 0) contador.textContent = '';
    else if (cheio) contador.textContent = `Escolhidas: ${escolhidas.size} de ${pergunta.maximo}. Para trocar, desmarque uma.`;
    else contador.textContent = `Escolhidas: ${escolhidas.size} de ${pergunta.maximo}`;
  };
  const chips = pergunta.opcoes.map((opcao) => {
    const input = h('input', { type: 'checkbox', value: opcao.id, checked: escolhidas.has(opcao.id) });
    input.addEventListener('change', () => {
      if (input.checked) escolhidas.add(opcao.id);
      else escolhidas.delete(opcao.id);
      if (escolhidas.size) respostas[pergunta.id] = [...escolhidas];
      else delete respostas[pergunta.id];
      atualizar();
    });
    inputs.push(input);
    return h('label', { class: 'palavra' }, input, h('span', null, opcao.rotulo));
  });
  atualizar();
  return h('div', { class: `pergunta palavras-${pergunta.polaridade}`, role: 'group', 'aria-labelledby': tituloId },
    h('h2', { class: 'pergunta-titulo', id: tituloId }, pergunta.texto),
    h('p', { class: 'ajuda' }, `Escolha até ${pergunta.maximo}. Se nenhuma combinar, é só deixar em branco.`),
    h('div', { class: 'palavras' }, chips),
    contador);
}

function campoPergunta(pergunta, comAviso = false) {
  if (pergunta.tipo === 'palavras') return campoPalavras(pergunta);
  if (pergunta.tipo === 'enps') {
    const rotulo = (v) => (v <= 6 ? 'não recomendaria' : v <= 8 ? 'talvez recomendasse' : 'recomendaria');
    return campoEscala(pergunta, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rotulo, 'enps',
      ['0 · Não recomendaria', '10 · Recomendaria com certeza']);
  }
  if (pergunta.tipo === 'escala') {
    return campoEscala(pergunta, [1, 2, 3, 4, 5], (v) => cfg.escala[v - 1], '',
      [`1 · ${cfg.escala[0]}`, `5 · ${cfg.escala[4]}`]);
  }
  const id = `campo-${pergunta.id}`;
  const contador = h('span', { class: 'contador' });
  const atualizar = (texto) => { contador.textContent = texto.length ? `${texto.length}/${cfg.limite_texto}` : ''; };
  const area = h('textarea', {
    class: 'campo-texto',
    id,
    maxlength: cfg.limite_texto,
    rows: 4,
    placeholder: 'Opcional',
    'aria-describedby': comAviso ? `${id}-aviso` : null,
    oninput: (e) => { respostas[pergunta.id] = e.target.value; atualizar(e.target.value); },
  });
  area.value = respostas[pergunta.id] || '';
  atualizar(area.value);
  return h('div', { class: 'pergunta' },
    h('label', { for: id }, pergunta.texto),
    area,
    h('div', { class: 'campo-rodape' },
      comAviso
        ? h('span', { class: 'aviso-nomes', id: `${id}-aviso` }, icone('cadeado', 13),
          'Evite citar nomes ou detalhes que possam identificar você.')
        : h('span'),
      contador));
}

function campoPerfil(chave, definicao) {
  const opcoes = [...definicao.opcoes, { id: '', rotulo: 'Prefiro não informar', detalhe: '' }];
  const tituloId = `titulo-perfil-${chave}`;
  return h('div', { class: 'pergunta', role: 'radiogroup', 'aria-labelledby': tituloId },
    h('h2', { class: 'pergunta-titulo', id: tituloId }, definicao.titulo),
    definicao.ajuda ? h('p', { class: 'ajuda' }, definicao.ajuda) : null,
    h('div', { class: 'escolhas' }, opcoes.map((opcao) => {
      const input = h('input', {
        type: 'radio',
        name: `perfil-${chave}`,
        value: opcao.id,
        checked: (perfil[chave] ?? null) === opcao.id,
      });
      input.addEventListener('change', () => { perfil[chave] = opcao.id; });
      return h('label', { class: 'escolha' }, input,
        h('span', { class: 'escolha-corpo' },
          h('span', { class: 'escolha-rotulo' }, opcao.rotulo),
          opcao.detalhe ? h('span', { class: 'escolha-detalhe' }, opcao.detalhe) : null));
    })));
}

// ------------------------------------------------------------------ etapas

function montarPassos() {
  const blocos = cfg.blocos.map((bloco) => ({ tipo: 'bloco', bloco }));
  return [{ tipo: 'abertura' }, ...blocos, { tipo: 'perfil' }];
}

function conteudoDoPasso(atual) {
  if (atual.tipo === 'abertura') {
    return [
      h('h1', { tabindex: '-1' }, 'Queremos ouvir você.'),
      h('p', { class: 'subtitulo' },
        `Esta é a pesquisa de clima e cultura da ${cfg.empresa}. ${cfg.objetivo}`),
      h('div', { class: 'fatos' },
        h('span', { class: 'fato' }, icone('relogio'), cfg.tempo_estimado),
        h('span', { class: 'fato' }, icone('calendario'), `Aberta até ${dataPorExtenso(cfg.fechamento)}`)),
      h('section', { class: 'cartao' },
        h('h2', null, 'Como funciona'),
        h('ul', { class: 'lista' },
          itemLista('sim', 'sim', 'Não existe resposta certa ou errada.', 'Vale o que você vive no dia a dia.'),
          itemLista('sim', 'sim', 'Críticas são bem-vindas.', 'É para ouvir o que incomoda que esta pesquisa existe.'),
          itemLista('sim', 'sim', 'Pule o que quiser.', 'Todas as perguntas são opcionais.'),
          itemLista('sim', 'sim', 'Você vai ver o resultado.', `Os resultados consolidados serão compartilhados com todo mundo até ${dataPorExtenso(cfg.devolutiva)}.`))),
      h('section', { class: 'cartao' },
        h('h2', null, 'A pesquisa é anônima'),
        h('p', null, 'Não tem login, nome nem e-mail, e o link é o mesmo para todo mundo. O sistema não guarda IP, horário nem dados do seu aparelho.'),
        h('p', null, h('button', { type: 'button', class: 'link', onclick: abrirDialogo }, 'Ver em detalhes como isso é garantido'))),
    ];
  }
  if (atual.tipo === 'bloco') {
    const { bloco } = atual;
    const temEscala = bloco.perguntas.some((p) => p.tipo === 'escala');
    // O aviso sobre nomes aparece uma vez por tela, no primeiro campo aberto.
    const primeiraAberta = bloco.perguntas.find((p) => p.tipo === 'aberta');
    return [
      h('h1', { tabindex: '-1' }, bloco.titulo),
      h('p', { class: 'subtitulo' }, bloco.descricao),
      temEscala
        ? h('p', { class: 'dica-pular' }, `De 1 (${cfg.escala[0].toLowerCase()}) a 5 (${cfg.escala[4].toLowerCase()}). Toque de novo em uma nota para desmarcar.`)
        : null,
      ...bloco.perguntas.map((p) => campoPergunta(p, p === primeiraAberta)),
    ];
  }
  return [
    h('h1', { tabindex: '-1' }, 'Para terminar, duas perguntas opcionais'),
    h('p', { class: 'subtitulo' },
      `Elas ajudam a ver se a experiência muda de um grupo para outro. Só aparecem no painel grupos com ${cfg.minimo_por_recorte} respostas ou mais.`),
    campoPerfil('area', cfg.perfil.area),
    campoPerfil('tempo_casa', cfg.perfil.tempo_casa),
  ];
}

function atualizarProgresso() {
  const pct = Math.round((100 * (passo + 1)) / (passos.length + 1));
  progresso.hidden = false;
  progressoPreenchido.style.width = `${pct}%`;
  progressoBarra.setAttribute('aria-valuenow', pct);
}

function mostrarPasso(focar = true) {
  const atual = passos[passo];
  const ultimo = passo === passos.length - 1;
  const erro = h('p', { class: 'mensagem-erro', role: 'alert', hidden: true });

  const avancar = h('button', {
    type: 'button',
    class: 'botao botao-principal',
    onclick: () => {
      if (ultimo) { enviar(avancar, erro); return; }
      passo += 1;
      mostrarPasso();
    },
  }, ultimo ? 'Enviar respostas' : passo === 0 ? 'Começar' : 'Continuar');

  const voltar = passo > 0
    ? h('button', {
      type: 'button',
      class: 'botao botao-secundario',
      onclick: () => { passo -= 1; mostrarPasso(); },
    }, 'Voltar')
    : null;

  let nota = '';
  if (ultimo) nota = 'Depois de enviar, não dá para alterar as respostas.';
  else if (passo === 0) nota = 'Nada é enviado até você tocar em "Enviar respostas", na última etapa.';
  const foto = atual.tipo === 'abertura'
    ? h('img', {
      class: 'foto-time',
      src: `${BASE}img/time.webp`,
      width: 1360,
      height: 680,
      alt: `Foto do time da ${cfg.empresa} reunido em frente a um ônibus`,
    })
    : null;

  app.replaceChildren(...[
    foto,
    h('p', { class: 'etapa-rotulo' }, `Etapa ${passo + 1} de ${passos.length}`),
    ...conteudoDoPasso(atual),
    erro,
    h('div', { class: 'navegacao' }, voltar, avancar),
    h('p', { class: 'rodape-nota' }, nota),
  ].filter(Boolean));

  atualizarProgresso();
  if (focar) {
    window.scrollTo(0, 0);
    app.querySelector('h1')?.focus({ preventScroll: true });
  }
}

// -------------------------------------------------------------------- envio

async function enviar(botao, erro) {
  if (enviando) return;
  erro.hidden = true;

  const corpo = { respostas: {}, perfil: {} };
  for (const [id, valor] of Object.entries(respostas)) {
    if (typeof valor === 'string') {
      if (valor.trim()) corpo.respostas[id] = valor.trim();
    } else if (Array.isArray(valor)) {
      if (valor.length) corpo.respostas[id] = valor;
    } else if (valor != null) {
      corpo.respostas[id] = valor;
    }
  }
  if (perfil.area) corpo.perfil.area = perfil.area;
  if (perfil.tempo_casa) corpo.perfil.tempo_casa = perfil.tempo_casa;

  if (Object.keys(corpo.respostas).length === 0) {
    erro.textContent = 'Você ainda não respondeu nenhuma pergunta. Volte e responda pelo menos uma para enviar.';
    erro.hidden = false;
    return;
  }

  if (DEMO) {
    enviado = true;
    mostrarFim();
    return;
  }

  enviando = true;
  botao.disabled = true;
  botao.textContent = 'Enviando…';
  try {
    const resposta = await fetch('/api/respostas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (resposta.status === 201) {
      enviado = true;
      marcarRespondida();
      mostrarFim();
      return;
    }
    const dados = await resposta.json().catch(() => ({}));
    erro.textContent = dados.mensagem || 'Não foi possível enviar agora. Suas respostas continuam aqui: tente de novo.';
  } catch {
    erro.textContent = 'Sem conexão no momento. Suas respostas continuam aqui: tente de novo em instantes.';
  }
  erro.hidden = false;
  enviando = false;
  botao.disabled = false;
  botao.textContent = 'Enviar respostas';
}

// ------------------------------------------------------- telas de situação

function telaSimples({ nomeIcone, titulo, paragrafos, extra }) {
  progresso.hidden = true;
  app.replaceChildren(
    h('div', { class: 'destaque-icone' }, icone(nomeIcone, 26)),
    h('h1', { tabindex: '-1' }, titulo),
    ...paragrafos.map((texto) => h('p', { class: 'subtitulo' }, texto)),
    ...(extra || []),
    h('p', { class: 'rodape-nota' }, ''));
  window.scrollTo(0, 0);
  app.querySelector('h1')?.focus({ preventScroll: true });
}

function mostrarFimDemo() {
  telaSimples({
    nomeIcone: 'sim',
    titulo: 'Fim da demonstração.',
    paragrafos: [
      'Nada foi enviado nem guardado. Na pesquisa de verdade, aqui aparece o agradecimento e a data em que os resultados serão compartilhados.',
    ],
    extra: [
      h('div', { class: 'navegacao' },
        h('button', {
          type: 'button',
          class: 'botao botao-secundario',
          onclick: () => {
            for (const chave of Object.keys(respostas)) delete respostas[chave];
            for (const chave of Object.keys(perfil)) delete perfil[chave];
            enviado = false;
            passo = 0;
            mostrarPasso();
          },
        }, 'Ver de novo desde o início')),
    ],
  });
}

function mostrarFim() {
  if (DEMO) { mostrarFimDemo(); return; }
  telaSimples({
    nomeIcone: 'sim',
    titulo: 'Obrigado. Sua resposta foi enviada.',
    paragrafos: [
      'Ela foi registrada de forma anônima.',
    ],
    extra: [
      h('section', { class: 'cartao' },
        h('h2', null, 'E agora?'),
        h('p', null, h('strong', null, `Até ${dataPorExtenso(cfg.devolutiva)}`),
          ', os resultados consolidados serão compartilhados com todo mundo.'),
        h('p', null, cfg.objetivo),
        h('p', null, `A pesquisa fica aberta até ${dataPorExtenso(cfg.fechamento)}. Se puder, lembre quem ainda não respondeu: quanto mais gente participa, mais fiel fica o retrato.`)),
    ],
  });
}

function mostrarJaRespondeu() {
  const extra = [];
  if (cfg.modo_teste) {
    extra.push(h('div', { class: 'navegacao' },
      h('button', {
        type: 'button',
        class: 'botao botao-secundario',
        onclick: () => {
          try { localStorage.removeItem(chaveRespondida()); } catch { /* sem armazenamento */ }
          passo = 0;
          mostrarPasso();
        },
      }, 'Responder de novo (só no modo de teste)')));
  }
  telaSimples({
    nomeIcone: 'sim',
    titulo: 'Você já respondeu por este navegador.',
    paragrafos: [
      `Obrigado por participar. Os resultados consolidados serão compartilhados com todo mundo até ${dataPorExtenso(cfg.devolutiva)}.`,
    ],
    extra,
  });
}

function mostrarForaDoPeriodo() {
  if (cfg.estado === 'antes') {
    telaSimples({
      nomeIcone: 'calendario',
      titulo: `A pesquisa abre em ${dataPorExtenso(cfg.abertura)}.`,
      paragrafos: [
        `Ela fica aberta até ${dataPorExtenso(cfg.fechamento)}, leva de ${cfg.tempo_estimado} e é anônima. Volte a este mesmo link quando abrir.`,
      ],
    });
  } else {
    telaSimples({
      nomeIcone: 'calendario',
      titulo: 'A pesquisa já foi encerrada.',
      paragrafos: [
        `Ela ficou aberta até ${dataPorExtenso(cfg.fechamento)}. Os resultados consolidados serão compartilhados com todo mundo até ${dataPorExtenso(cfg.devolutiva)}.`,
      ],
    });
  }
}

// ----------------------------------------------------------------- diálogo

function abrirDialogo() {
  if (!cfg) return;
  const dialogo = document.getElementById('dialogo-anonimato');
  const corpo = document.getElementById('dialogo-corpo');
  if (!corpo.hasChildNodes()) corpo.append(...conteudoAnonimato());
  dialogo.showModal();
  dialogo.scrollTop = 0;
}

function prepararDialogo() {
  const dialogo = document.getElementById('dialogo-anonimato');
  document.getElementById('selo').addEventListener('click', abrirDialogo);
  document.getElementById('dialogo-fechar').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
}

// ------------------------------------------------------------------ início

async function iniciar() {
  prepararDialogo();
  try {
    const resposta = await fetch(DEMO ? 'config.json' : '/api/config', { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!resposta.ok) throw new Error('config');
    cfg = await resposta.json();
  } catch {
    app.replaceChildren(h('p', { class: 'mensagem-erro', role: 'alert' },
      'Não foi possível carregar a pesquisa. Verifique sua conexão e recarregue a página.'));
    return;
  }

  const faixa = document.getElementById('faixa-teste');
  if (DEMO) faixa.textContent = 'Demonstração para revisão: as respostas não são enviadas nem guardadas.';
  faixa.hidden = !(cfg.modo_teste || DEMO);
  passos = montarPassos();

  if (!DEMO && jaRespondeu()) { mostrarJaRespondeu(); return; }
  if (cfg.estado !== 'aberta') { mostrarForaDoPeriodo(); return; }
  mostrarPasso(false);
}

window.addEventListener('beforeunload', (e) => {
  if (!enviado && temAlgumaResposta()) e.preventDefault();
});

iniciar();
