import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

export type Status = 'pendente' | 'em_andamento' | 'concluido'

export interface Tema {
  id: number
  disciplina_id: number
  ordem: number
  tema_especifico: string
  paginas: number | null
  questoes_previstas: number | null
  responsavel: string | null
  observacoes: string | null
  status_geral: Status
  mat_atualizado: Status
  mat_revisado: Status
  mat_diagramado: Status
  mat_conferencia: Status
  vid_slide: Status
  vid_gravacao: Status
  vid_edicao: Status
  comp_simulado: Status
  comp_questoes: Status
  comp_flashcards: Status
  updated_at: string
}

export interface Disciplina {
  id: number
  nome: string
  microassunto: string | null
  total_paginas: number
  cor: string
}

export interface DB {
  disciplinas: Disciplina[]
  temas: Tema[]
}

function createInitialDB(): DB {
  const p = (s: Status = 'pendente') => s
  const disc = (id: number, nome: string, cor: string, micro?: string, pags = 0): Disciplina =>
    ({ id, nome, microassunto: micro ?? null, total_paginas: pags, cor })
  const tema = (id: number, did: number, ordem: number, t: string, pags?: number, q?: number, mat?: Status[], vid?: Status[], comp?: Status[]): Tema => {
    const m = mat ?? ['pendente','pendente','pendente','pendente']
    const v = vid ?? ['pendente','pendente','pendente']
    const c = comp ?? ['pendente','pendente','pendente']
    const all = [...m,...v,...c]
    const allDone = all.every(s => s === 'concluido')
    const anyStarted = all.some(s => s !== 'pendente')
    return {
      id, disciplina_id: did, ordem,
      tema_especifico: t,
      paginas: pags ?? null,
      questoes_previstas: q ?? null,
      responsavel: null, observacoes: null,
      status_geral: allDone ? 'concluido' : anyStarted ? 'em_andamento' : 'pendente',
      mat_atualizado: m[0] as Status, mat_revisado: m[1] as Status,
      mat_diagramado: m[2] as Status, mat_conferencia: m[3] as Status,
      vid_slide: v[0] as Status, vid_gravacao: v[1] as Status, vid_edicao: v[2] as Status,
      comp_simulado: c[0] as Status, comp_questoes: c[1] as Status, comp_flashcards: c[2] as Status,
      updated_at: new Date().toISOString()
    }
  }

  const disciplinas: Disciplina[] = [
    disc(1,  'Anatomia Sistêmica',    '#7c3aed', 'Anatomia Humana', 205),
    disc(2,  'Anatomia Topográfica',  '#6d28d9', 'Anatomia Humana', 0),
    disc(3,  'Biofísica',             '#0891b2', undefined, 0),
    disc(4,  'Bioquímica',            '#0d9488', undefined, 130),
    disc(5,  'Citologia',             '#059669', undefined, 83),
    disc(6,  'Embriologia',           '#16a34a', undefined, 67),
    disc(7,  'Farmacologia',          '#ca8a04', undefined, 206),
    disc(8,  'Fitoterapia',           '#65a30d', undefined, 0),
    disc(9,  'Fisiologia',            '#dc2626', undefined, 238),
    disc(10, 'Histologia',            '#db2777', undefined, 158),
    disc(11, 'Genética',              '#7c3aed', undefined, 80),
    disc(12, 'Imunologia',            '#2563eb', undefined, 150),
    disc(13, 'Microbiologia',         '#0891b2', undefined, 81),
    disc(14, 'Neuroanatomia',         '#9333ea', undefined, 261),
    disc(15, 'Parasitologia',         '#b45309', undefined, 104),
    disc(16, 'Psicologia',            '#e11d48', undefined, 33),
    disc(17, 'Semiologia',            '#0369a1', undefined, 283),
    disc(18, 'Suporte Básico de Vida','#b91c1c', undefined, 57),
  ]

  const c = ['concluido','concluido','concluido','concluido'] as Status[]
  const cv = ['concluido','concluido','concluido'] as Status[]

  let id = 1
  const temas: Tema[] = [
    // 1 - Anatomia Sistêmica
    tema(id++,1,1,'Roteiro Prático',9,undefined,c,cv,cv),
    tema(id++,1,2,'Introdução ao Estudo',4),
    tema(id++,1,3,'Conceitos e Nomenclaturas',8),
    tema(id++,1,4,'Sistema Esquelético',28),
    tema(id++,1,5,'Sistema Articular',8),
    tema(id++,1,6,'Sistema Muscular',44),
    tema(id++,1,7,'Sistema Nervoso',22),
    tema(id++,1,8,'Sistema Circulatório',17),
    tema(id++,1,9,'Sistema Respiratório',17),
    tema(id++,1,10,'Sistema Digestório',18),
    tema(id++,1,11,'Sistema Urinário',10),
    tema(id++,1,12,'Sistema Genital',20),
    // 2 - Anatomia Topográfica
    tema(id++,2,1,'Membro Superior'),
    tema(id++,2,2,'Membro Inferior'),
    tema(id++,2,3,'Introdução ao Abdome — Paredes, Cavidades, Regiões e Planos'),
    tema(id++,2,4,'Vísceras Abdominais'),
    tema(id++,2,5,'Peritônio e Cavidade Peritoneal'),
    tema(id++,2,6,'Parede Torácica'),
    tema(id++,2,7,'Mediastino'),
    tema(id++,2,8,'Cavidades Pulmonares, Pulmões e Pleura'),
    tema(id++,2,9,'Coração e Pericárdio'),
    tema(id++,2,10,'Introdução ao Dorso e Coluna Vertebral'),
    tema(id++,2,11,'Músculos do Dorso'),
    tema(id++,2,12,'Região Inguinal'),
    tema(id++,2,13,'Introdução a Cabeça e Pescoço'),
    tema(id++,2,14,'Vísceras Cervicais'),
    tema(id++,2,15,'Raiz e Estruturas Profundas do Pescoço'),
    tema(id++,2,16,'Trígono Anterior do Pescoço'),
    tema(id++,2,17,'Trígono Posterior do Pescoço'),
    // 3 - Biofísica
    tema(id++,3,1,'Difusão',undefined,4),
    tema(id++,3,2,'Osmose',undefined,4),
    tema(id++,3,3,'Transporte de Membrana',undefined,4),
    tema(id++,3,4,'Bioeletricidade',undefined,4),
    tema(id++,3,5,'Hemodinâmica',undefined,4),
    tema(id++,3,6,'Biofísica da Respiração',undefined,4),
    tema(id++,3,7,'Radioatividade',undefined,4),
    // 4 - Bioquímica
    tema(id++,4,1,'Introdução à Bioquímica',4),
    tema(id++,4,2,'Carboidratos',24),
    tema(id++,4,3,'Metabolismo do Glicogênio',8),
    tema(id++,4,4,'Glicólise e Gliconeogênese',9),
    tema(id++,4,5,'Via das Pentoses',3),
    tema(id++,4,6,'Ciclo do Ácido Cítrico',8),
    tema(id++,4,7,'Cadeia Respiratória',8),
    tema(id++,4,8,'Aminoácidos',16),
    tema(id++,4,9,'Peptídeo e Proteínas'),
    tema(id++,4,10,'Eletroforese de Proteínas',7),
    tema(id++,4,11,'Ciclo da Ureia',6),
    tema(id++,4,12,'Lipídeos',2),
    tema(id++,4,13,'Lipogênese',4),
    tema(id++,4,14,'Lipólise',7),
    tema(id++,4,15,'Biossíntese do Colesterol',5),
    tema(id++,4,16,'Metabolismo das Lipoproteínas',7),
    tema(id++,4,17,'Metabolismo do Etanol',5),
    tema(id++,4,18,'Metabolismo do Heme',7),
    // 5 - Citologia
    tema(id++,5,1,'Introdução ao Estudo da Célula',8),
    tema(id++,5,2,'Noções Básicas de Microscopia',4),
    tema(id++,5,3,'Montagem de uma Lâmina Histológica',2),
    tema(id++,5,4,'Membrana Celular'),
    tema(id++,5,5,'Núcleo Interfásico',3),
    tema(id++,5,6,'Ciclo Celular',5),
    tema(id++,5,7,'Complexo de Golgi',7),
    tema(id++,5,8,'Ribossomos',5),
    tema(id++,5,9,'Retículo Endoplasmático',6),
    tema(id++,5,10,'Peroxissomos',7),
    tema(id++,5,11,'Mitocôndrias',7),
    tema(id++,5,12,'Citoesqueleto',13),
    tema(id++,5,13,'Cílios e Flagelos',8),
    tema(id++,5,14,'Lisossomos',8),
    // 6 - Embriologia
    tema(id++,6,1,'Gametogênese',4),
    tema(id++,6,2,'Fecundação e Primeiras Semanas do Desenvolvimento Embrionário',12),
    tema(id++,6,3,'Sistema Cardiovascular',8),
    tema(id++,6,4,'Sistema Respiratório',6),
    tema(id++,6,5,'Sistema Digestório',9),
    tema(id++,6,6,'Sistema Nervoso',8),
    tema(id++,6,7,'Sistema Locomotor',9),
    tema(id++,6,8,'Sistema Endócrino',2),
    tema(id++,6,9,'Sistema Urinário',9),
    // 7 - Farmacologia
    tema(id++,7,1,'Introdução à Farmacologia',9),
    tema(id++,7,2,'Absorção e Distribuição dos Fármacos',7),
    tema(id++,7,3,'Biotransformação e Eliminação Metabólica',5),
    tema(id++,7,4,'Farmacodinâmica',5),
    tema(id++,7,5,'AINEs',11),
    tema(id++,7,6,'AIEs',10),
    tema(id++,7,7,'Drogas que Atuam no TGI',8),
    tema(id++,7,8,'Introdução aos Antibióticos',14),
    tema(id++,7,9,'Antibióticos — Aplicação Clínica',22),
    tema(id++,7,10,'Autocoides',6),
    tema(id++,7,11,'Drogas Anti-hipertensivas',15),
    tema(id++,7,12,'Insulina e Hipoglicemiantes Orais',12),
    tema(id++,7,13,'Fármacos que Agem no SN',23),
    tema(id++,7,14,'Antidepressivos',5),
    tema(id++,7,15,'Antipsicóticos',4),
    tema(id++,7,16,'Antiparkinsonianos',7),
    tema(id++,7,17,'Anticonvulsivantes',7),
    tema(id++,7,18,'Opiáceos',5),
    tema(id++,7,19,'Anestésicos',7),
    tema(id++,7,20,'Prescrição Médica',8),
    tema(id++,7,21,'Medidas de Diluição de Drogas',7),
    tema(id++,7,22,'Anemia e Hematopoiéticos',9),
    // 8 - Fitoterapia
    tema(id++,8,1,'Introdução à Fitoterapia',undefined,4),
    tema(id++,8,2,'Constituintes Químicos das Plantas Medicinais',undefined,4),
    tema(id++,8,3,'Plantas com Atividades Anti-inflamatória',undefined,4),
    tema(id++,8,4,'Plantas com Atividade no TGI',undefined,4),
    tema(id++,8,5,'Plantas com Atividades Hipoglicemiantes',undefined,4),
    tema(id++,8,6,'Plantas com Atividade Antimicrobiana',undefined,4),
    tema(id++,8,7,'Plantas com Atividade Anti-hipertensiva',undefined,4),
    tema(id++,8,8,'Plantas Tóxicas'),
    // 9 - Fisiologia
    tema(id++,9,1,'Introdução à Fisiologia e Homeostase',3),
    tema(id++,9,2,'Introdução à Endocrinologia',7),
    tema(id++,9,3,'Fisiologia do Sistema Endócrino',21),
    tema(id++,9,4,'Neurofisiologia',93),
    tema(id++,9,5,'Fisiologia Gastrointestinal',18),
    tema(id++,9,6,'Fisiologia Cardiovascular',20),
    tema(id++,9,7,'Eletrocardiograma Básico',12),
    tema(id++,9,8,'Fisiologia Hematológica',11),
    tema(id++,9,9,'Fisiologia Renal',21),
    tema(id++,9,10,'Regulação do Equilíbrio Ácido-Base',6),
    tema(id++,9,11,'Funções Reprodutivas Femininas',10),
    tema(id++,9,12,'Funções Reprodutivas Masculinas',4),
    tema(id++,9,13,'Gravidez e Lactação',12),
    // 10 - Histologia
    tema(id++,10,1,'Introdução a Histologia',3),
    tema(id++,10,2,'Noções Básicas de Microscopia',6),
    tema(id++,10,3,'Tecido Epitelial de Revestimento',11),
    tema(id++,10,4,'Tecido Glandular',11),
    tema(id++,10,5,'Tecido Conjuntivo',11),
    tema(id++,10,6,'Tecido Adiposo',3),
    tema(id++,10,7,'Tecido Muscular',8),
    tema(id++,10,8,'Tecido Cartilaginoso',7),
    tema(id++,10,9,'Tecido Ósseo',9),
    tema(id++,10,10,'Tecido Sanguíneo',12),
    tema(id++,10,11,'Tecido Imunológico e Órgãos Linfáticos',6),
    tema(id++,10,12,'Sistema Endócrino',12),
    tema(id++,10,13,'Aparelho Reprodutor Masculino',5),
    tema(id++,10,14,'Aparelho Reprodutor Feminino',6),
    tema(id++,10,15,'Aparelho Digestivo',21),
    tema(id++,10,16,'Aparelho Circulatório',8),
    tema(id++,10,17,'Aparelho Respiratório'),
    tema(id++,10,18,'Aparelho Urinário',12),
    tema(id++,10,19,'Tecido Nervoso'),
    tema(id++,10,20,'Pele e Anexos',7),
    // 11 - Genética
    tema(id++,11,1,'Introdução ao Estudo da Genética',2),
    tema(id++,11,2,'Ácidos Nucléicos',3),
    tema(id++,11,3,'Duplicação do DNA',4),
    tema(id++,11,4,'Transcrição do RNA',4),
    tema(id++,11,5,'Tradução do RNA',5),
    tema(id++,11,6,'PCR e Sequenciamento de Bases',5),
    tema(id++,11,7,'O Código Genético',10),
    tema(id++,11,8,'Regulação Gênica',3),
    tema(id++,11,9,'Engenharia Genética',7),
    tema(id++,11,10,'Mendelismo',6),
    tema(id++,11,11,'Doenças Monogênicas',5),
    tema(id++,11,12,'Polialelia e Grupos Sanguíneos',8),
    tema(id++,11,13,'Herança Ligada ao Sexo',8),
    tema(id++,11,14,'Alterações Cromossômicas',10),
    // 12 - Imunologia
    tema(id++,12,1,'Introdução ao Sistema Imunológico',7),
    tema(id++,12,2,'Células do Sistema Imune',5),
    tema(id++,12,3,'Órgãos do Sistema Imune',6),
    tema(id++,12,4,'Sistema Imune Inato',11),
    tema(id++,12,5,'Antígeno e Anticorpo',7),
    tema(id++,12,6,'Imunidade Adquirida — Resposta Humoral',8),
    tema(id++,12,7,'Imunidade Adquirida — Resposta Celular',6),
    tema(id++,12,8,'MHC e Apresentação Antigênica',9),
    tema(id++,12,9,'Ativação de Células B',8),
    tema(id++,12,10,'Ativação de Células T',6),
    tema(id++,12,11,'Vacinas e Soros',7),
    tema(id++,12,12,'Tolerância Imunológica',10),
    tema(id++,12,13,'Imunologia dos Transplantes',12),
    tema(id++,12,14,'Hipersensibilidade',20),
    tema(id++,12,15,'Doenças Autoimunes',8),
    tema(id++,12,16,'Imunologia dos Tumores',9),
    tema(id++,12,17,'Imunodeficiências',11),
    // 13 - Microbiologia
    tema(id++,13,1,'Introdução à Microbiologia',6),
    tema(id++,13,2,'Célula Bacteriana',7),
    tema(id++,13,3,'Genoma Bacteriano',8),
    tema(id++,13,4,'Interação Parasita x Hospedeiro',6),
    tema(id++,13,5,'Fisiologia Bacteriana',4),
    tema(id++,13,6,'Controle dos Microrganismos',3),
    tema(id++,13,7,'Quimioterapia Antimicrobiana',4),
    tema(id++,13,8,'Estafilococos',6),
    tema(id++,13,9,'Estreptococos',4),
    tema(id++,13,10,'Micobactérias',3),
    tema(id++,13,11,'Microrganismos Patogênicos de Importância em Alimentos',3),
    tema(id++,13,12,'Salmoneloses',3),
    tema(id++,13,13,'Bactérias Anaeróbicas de Maior Significado Clínico',5),
    tema(id++,13,14,'Grandes Síndromes Bacterianas',9),
    tema(id++,13,15,'Virologia',10),
    // 14 - Neuroanatomia
    tema(id++,14,1,'Anatomia da Medula Espinhal e Seus Envoltórios',7),
    tema(id++,14,2,'Microscopia da Medula Espinhal',13),
    tema(id++,14,3,'Macroscopia do Tronco Encefálico',5),
    tema(id++,14,4,'Microscopia do Bulbo',5),
    tema(id++,14,5,'Microscopia da Ponte',4),
    tema(id++,14,6,'Microscopia do Mesencéfalo',4),
    tema(id++,14,7,'Nervos Cranianos',22),
    tema(id++,14,8,'Estrutura e Funções do Cerebelo',10),
    tema(id++,14,9,'Macroscopia do Diencéfalo',4),
    tema(id++,14,10,'Subtálamo, Epitálamo e Tálamo',5),
    tema(id++,14,11,'Estrutura e Funções do Hipotálamo',6),
    tema(id++,14,12,'Anatomia Macroscópica do Telencéfalo',10),
    tema(id++,14,13,'Aspectos Funcionais do Córtex Cerebral',20),
    tema(id++,14,14,'Núcleos da Base e Centro Branco Medular',11),
    tema(id++,14,15,'Vascularização do Sistema Nervoso Central e Meninges',21),
    tema(id++,14,16,'Formação Reticular',12),
    tema(id++,14,17,'Sistema Límbico',7),
    tema(id++,14,18,'Sistema Nervoso Autônomo',17),
    tema(id++,14,19,'Grandes Vias Aferentes',12),
    tema(id++,14,20,'Grandes Vias Eferentes',10),
    tema(id++,14,21,'Ossos do Crânio'),
    tema(id++,14,22,'Roteiro Prático',56),
    // 15 - Parasitologia
    tema(id++,15,1,'Introdução à Parasitologia',3),
    tema(id++,15,2,'Esquistossomose',12),
    tema(id++,15,3,'Teníase e Cisticercose Humana',8),
    tema(id++,15,4,'Himenolipíase',5),
    tema(id++,15,5,'Filariose',5),
    tema(id++,15,6,'Estrongiloidíase',5),
    tema(id++,15,7,'Ancilostomose',7),
    tema(id++,15,8,'Ascaridíase',5),
    tema(id++,15,9,'Enterobiose',4),
    tema(id++,15,10,'Tricuríase',4),
    tema(id++,15,11,'Doença de Chagas',10),
    tema(id++,15,12,'Leishmaniose',10),
    tema(id++,15,13,'Giardíase',5),
    tema(id++,15,14,'Tricomoníase',6),
    tema(id++,15,15,'Amebíase',8),
    tema(id++,15,16,'Toxoplasmose',7),
    tema(id++,15,17,'Parasitoses Intestinais'),
    // 16 - Psicologia
    tema(id++,16,1,'Desenvolvimento Humano',7),
    tema(id++,16,2,'Afetividade Humana',2),
    tema(id++,16,3,'Adolescência',4),
    tema(id++,16,4,'Gravidez, Parto e Puerpério',3),
    tema(id++,16,5,'Envelhecimento',3),
    tema(id++,16,6,'Personalidade',5),
    tema(id++,16,7,'Biotipologia',4),
    tema(id++,16,8,'Psicossomático',5),
    // 17 - Semiologia
    tema(id++,17,1,'Anamnese e Ectoscopia',21),
    tema(id++,17,2,'Roteiro Prático de Anamnese e Exame Físico',7),
    tema(id++,17,3,'Semiologia do Aparelho Respiratório Aplicada',23),
    tema(id++,17,4,'Semiologia do Aparelho Cardiovascular Aplicada',30),
    tema(id++,17,5,'Semiologia Abdominal Aplicada',49),
    tema(id++,17,6,'Semiologia Neurológica Aplicada',37),
    tema(id++,17,7,'Semiologia Reumatológica',15),
    tema(id++,17,8,'Anatomia do Olho e Exame Físico',16),
    tema(id++,17,9,'Propedêutica Otorrinolaringológica',16),
    tema(id++,17,10,'Semiologia Urológica',10),
    tema(id++,17,11,'Diagnóstico Sindrômico em Nefrologia'),
    tema(id++,17,12,'Semiologia da Mulher',13),
    tema(id++,17,13,'Avaliação do Recém-Nascido',8),
    tema(id++,17,14,'Semiologia Pediátrica',8),
    tema(id++,17,15,'Avaliação Clínica do Idoso',5),
    tema(id++,17,16,'Anamnese Psiquiátrica',9),
    tema(id++,17,17,'Semiologia Dermatológica',16),
    // 18 - Suporte Básico de Vida
    tema(id++,18,1,'Epidemiologia do Trauma',7),
    tema(id++,18,2,'Medicina do Tráfego',10),
    tema(id++,18,3,'Cinemática do Trauma',6),
    tema(id++,18,4,'Assistência Inicial ao Trauma',8),
    tema(id++,18,5,'Parada Cardiorrespiratória',11),
    tema(id++,18,6,'Emergências Médicas',8),
    tema(id++,18,7,'Acidente com Múltiplas Vítimas',4),
    tema(id++,18,8,'Trauma por Queimaduras',3),
  ]

  return { disciplinas, temas }
}

export function getDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialDB()
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2))
    return initial
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DB
}

export function saveDB(db: DB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}
