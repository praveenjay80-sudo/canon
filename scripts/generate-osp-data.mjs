import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, 'ospData.json'), 'utf8'));

// Discipline group → OSP field names
const DISCIPLINE_GROUPS = {
  'STEM': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Engineering', 'Earth Sciences', 'Astronomy', 'Atmospheric Sciences'],
  'Social Sciences': ['Psychology', 'Economics', 'Sociology', 'Political Science', 'Anthropology', 'Geography', 'Women\'s Studies'],
  'Humanities': ['Philosophy', 'History', 'English Literature', 'Linguistics', 'Classics', 'Religion', 'Theology', 'Fine Arts', 'Music', 'Theatre Arts', 'Film and Photography'],
  'Professional': ['Business', 'Law', 'Medicine', 'Nursing', 'Accounting', 'Marketing', 'Architecture', 'Social Work', 'Education', 'Journalism', 'Library Science', 'Public Safety', 'Health Technician', 'Dentistry', 'Veterinary Medicine', 'Nutrition', 'Criminal Justice', 'Military Science', 'Agriculture'],
  'Languages': ['Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Hebrew', 'English as a Second Language', 'Sign Language'],
  'Practical': ['Writing', 'Basic Skills', 'Basic Computer Skills', 'Fitness and Leisure', 'Media / Communications', 'Dance', 'Culinary Arts', 'Cosmetology', 'Mechanic / Repair Tech', 'Transportation'],
};

// Subfields: field name → [{name, kw[]}]
// Keywords matched case-insensitively against title text.
// 'General & Introductory' is the fallback — titles with no other match go here.
const SUBFIELD_DEFS = {
  Mathematics: [
    { name: 'Calculus', kw: ['calculus', 'transcendental', 'multivariable'] },
    { name: 'Precalculus & Algebra', kw: ['precalculus', 'trigonometry', 'college algebra', 'intermediate algebra', 'elementary algebra', 'beginning algebra', 'prealgebra', 'pre-algebra', 'finite mathematics'] },
    { name: 'Statistics & Probability', kw: ['statistic', 'probability', 'bayesian', 'stochastic', 'regression', 'inference'] },
    { name: 'Linear Algebra', kw: ['linear algebra', 'numerical linear algebra'] },
    { name: 'Abstract Algebra', kw: ['abstract algebra', 'algebraic structures', 'group theory'] },
    { name: 'Real & Complex Analysis', kw: ['real analysis', 'mathematical analysis', 'complex analysis', 'principles of mathematical', 'real and complex'] },
    { name: 'Differential Equations', kw: ['differential equation', 'dynamical system', 'nonlinear dynamics', 'chaos'] },
    { name: 'Discrete Math & Graph Theory', kw: ['discrete', 'graph theory', 'combinatorics'] },
    { name: 'Numerical Methods', kw: ['numerical', 'computational mathematics', 'scientific computing'] },
    { name: 'Topology', kw: ['topology', 'topological', 'manifold'] },
    { name: 'Applied & Optimization', kw: ['operations research', 'optimization', 'convex', 'vector calculus', 'engineering mathematics', 'quantitative reasoning', 'mathematical ideas', 'mathematics for', 'applied mathematics'] },
  ],
  Physics: [
    { name: 'General & University Physics', kw: ['university physics', 'fundamentals of physics', 'physics for scientists', 'physics: principles', 'feynman lectures', 'concepts of physics', 'introductory physics', 'modern physics', 'college physics', 'general physics'] },
    { name: 'Classical Mechanics', kw: ['classical mechanics', 'analytical mechanics', 'lagrangian', 'hamiltonian', 'newtonian', 'statics', 'dynamics'] },
    { name: 'Quantum Mechanics & QFT', kw: ['quantum mechanics', 'quantum physics', 'quantum theory', 'quantum field', 'schrodinger', 'schrödinger', 'quantum chemistry'] },
    { name: 'Electrodynamics', kw: ['electrodynamics', 'electromagnetism', 'electromagnetic', 'maxwell', 'electrostatics'] },
    { name: 'Statistical Mechanics & Thermodynamics', kw: ['statistical mechanics', 'statistical physics', 'thermodynamics', 'thermal physics', 'entropy'] },
    { name: 'Solid State & Condensed Matter', kw: ['solid state', 'condensed matter', 'solid-state', 'crystal', 'semiconductor', 'superconductor'] },
    { name: 'Nuclear & Particle Physics', kw: ['nuclear physics', 'particle physics', 'nuclear and particle', 'high energy', 'subatomic', 'radioactive', 'nuclear structure'] },
    { name: 'Optics & Photonics', kw: ['optics', 'optical', 'photonics', 'laser', 'wave optics'] },
    { name: 'Astrophysics & Cosmology', kw: ['astrophysics', 'cosmology', 'stellar', 'astrophysical', 'gravitational', 'relativity'] },
    { name: 'Mathematical Methods', kw: ['mathematical methods', 'mathematical physics', 'methods of mathematical'] },
    { name: 'Computational Physics', kw: ['computational physics', 'numerical methods in physics', 'simulation'] },
  ],
  Chemistry: [
    { name: 'General Chemistry', kw: ['general chemistry', 'chemistry: the central', 'principles of chemistry', 'chemistry: a molecular', 'introduction to chemistry', 'chemical principles', 'general, organic', 'chemistry for'] },
    { name: 'Organic Chemistry', kw: ['organic chemistry', 'organic synthesis', 'stereochemistry', 'reaction mechanism', 'organometallic'] },
    { name: 'Inorganic Chemistry', kw: ['inorganic chemistry', 'inorganic', 'coordination chemistry'] },
    { name: 'Physical Chemistry', kw: ['physical chemistry', 'thermochemistry', 'chemical kinetics', 'quantum chemistry', 'electrochemistry'] },
    { name: 'Analytical Chemistry', kw: ['analytical chemistry', 'quantitative analysis', 'quantitative chemical', 'chromatography', 'mass spectrometry', 'spectroscopy', 'instrumental analysis'] },
    { name: 'Biochemistry', kw: ['biochemistry', 'biochemical', 'enzymes', 'proteins', 'metabolism', 'molecular biochemistry'] },
    { name: 'Environmental Chemistry', kw: ['environmental chemistry', 'green chemistry', 'atmospheric chemistry', 'chemical pollution'] },
    { name: 'Materials & Polymer Chemistry', kw: ['polymer', 'materials chemistry', 'solid state chemistry', 'nanochemistry', 'materials science'] },
    { name: 'Food & Industrial Chemistry', kw: ['food chemistry', 'pharmaceutical chemistry', 'medicinal chemistry', 'drug design'] },
  ],
  Biology: [
    { name: 'Molecular & Cell Biology', kw: ['molecular biology', 'cell biology', 'cellular', 'molecular cell', 'molecular genetics', 'gene expression', 'genomics', 'dna', 'rna'] },
    { name: 'Genetics', kw: ['genetics', 'heredity', 'chromosome', 'genetic analysis', 'introduction to genetics'] },
    { name: 'Ecology', kw: ['ecology', 'ecosystem', 'biodiversity', 'population ecology', 'environmental biology', 'conservation biology', 'animal behavior'] },
    { name: 'Evolutionary Biology', kw: ['evolution', 'evolutionary', 'natural selection', 'speciation', 'darwin', 'origin of species'] },
    { name: 'Microbiology', kw: ['microbiology', 'microbial', 'bacteria', 'viruses', 'fungi', 'pathogen', 'immunology', 'immune'] },
    { name: 'Anatomy & Physiology', kw: ['anatomy', 'physiology', 'human biology', 'human anatomy', 'organ system'] },
    { name: 'Neuroscience', kw: ['neuroscience', 'neurobiology', 'neural', 'brain', 'nervous system'] },
    { name: 'Biochemistry', kw: ['biochemistry', 'biochemical', 'metabolism'] },
    { name: 'Botany & Plant Science', kw: ['botany', 'plant biology', 'plant science', 'photosynthesis', 'plant physiology', 'plant ecology'] },
    { name: 'Zoology & Animal Biology', kw: ['zoology', 'zoological', 'vertebrate', 'invertebrate', 'animal science', 'entomology'] },
    { name: 'Marine & Aquatic Biology', kw: ['marine biology', 'oceanography', 'aquatic', 'marine ecology'] },
    { name: 'Developmental Biology', kw: ['developmental biology', 'development', 'embryology', 'stem cell'] },
  ],
  'Computer Science': [
    { name: 'Algorithms & Data Structures', kw: ['algorithms', 'data structures', 'introduction to algorithms', 'algorithm design', 'complexity', 'sorting'] },
    { name: 'Artificial Intelligence & ML', kw: ['artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'natural language processing', 'computer vision', 'pattern recognition'] },
    { name: 'Operating Systems', kw: ['operating systems', 'linux', 'unix', 'kernel', 'concurrency', 'os concepts'] },
    { name: 'Computer Networks', kw: ['computer networks', 'networking', 'tcp/ip', 'internet protocols', 'distributed systems', 'wireless'] },
    { name: 'Databases', kw: ['database', 'sql', 'data management', 'relational', 'nosql', 'data modeling'] },
    { name: 'Programming Languages & Compilers', kw: ['programming languages', 'compilers', 'interpreters', 'language design', 'type systems', 'programming language'] },
    { name: 'Software Engineering', kw: ['software engineering', 'software design', 'design patterns', 'agile', 'software development', 'software architecture'] },
    { name: 'Computer Architecture', kw: ['computer architecture', 'computer organization', 'digital systems', 'hardware', 'processor', 'embedded systems'] },
    { name: 'Computer Graphics', kw: ['computer graphics', 'rendering', 'visualization', 'opengl', 'game development', 'image processing'] },
    { name: 'Cybersecurity & Cryptography', kw: ['security', 'cryptography', 'cybersecurity', 'network security', 'ethical hacking', 'information security'] },
    { name: 'Theory of Computation', kw: ['theory of computation', 'automata', 'formal languages', 'computability', 'discrete mathematics'] },
    { name: 'Human-Computer Interaction', kw: ['human-computer', 'hci', 'user interface', 'usability', 'interaction design'] },
  ],
  Engineering: [
    { name: 'Electrical & Electronics', kw: ['circuit', 'electronics', 'electrical engineering', 'signal processing', 'control systems', 'power systems', 'electric', 'microelectronics', 'electromagnetic'] },
    { name: 'Mechanical Engineering', kw: ['mechanics of materials', 'strength of materials', 'machine design', 'vibrations', 'mechanical engineering', 'dynamics of machinery', 'statics and dynamics'] },
    { name: 'Statics & Dynamics', kw: ['statics', 'dynamics', 'engineering mechanics'] },
    { name: 'Fluid Mechanics & Thermodynamics', kw: ['fluid mechanics', 'fluid dynamics', 'thermodynamics', 'heat transfer', 'thermal'] },
    { name: 'Civil & Structural Engineering', kw: ['civil engineering', 'structural', 'concrete', 'steel design', 'geotechnical', 'transportation engineering', 'highway'] },
    { name: 'Chemical Engineering', kw: ['chemical engineering', 'transport phenomena', 'reactor design', 'process engineering', 'mass transfer'] },
    { name: 'Materials Science', kw: ['materials science', 'materials engineering', 'metallurgy', 'nanomaterials', 'polymers', 'material properties'] },
    { name: 'Biomedical Engineering', kw: ['biomedical engineering', 'biomechanics', 'medical devices', 'bioengineering'] },
    { name: 'Environmental Engineering', kw: ['environmental engineering', 'sustainability', 'water treatment', 'waste management', 'green engineering'] },
    { name: 'Systems & Control Engineering', kw: ['systems engineering', 'control theory', 'automatic control', 'feedback control'] },
  ],
  Economics: [
    { name: 'Microeconomics', kw: ['microeconomics', 'microeconomic', 'supply and demand', 'consumer theory', 'market structure', 'price theory'] },
    { name: 'Macroeconomics', kw: ['macroeconomics', 'macroeconomic', 'gdp', 'monetary policy', 'fiscal policy', 'inflation', 'unemployment', 'keynesian'] },
    { name: 'Econometrics', kw: ['econometrics', 'time series', 'panel data', 'causal inference', 'economic statistics', 'statistical methods in economics'] },
    { name: 'Game Theory', kw: ['game theory', 'strategic behavior', 'mechanism design'] },
    { name: 'International Economics', kw: ['international economics', 'international trade', 'global economy', 'exchange rates', 'trade policy', 'open economy'] },
    { name: 'Development Economics', kw: ['development economics', 'developing countries', 'poverty', 'economic growth', 'institutions', 'economic development'] },
    { name: 'Financial Economics', kw: ['financial economics', 'investment', 'capital markets', 'asset pricing', 'derivatives', 'portfolio'] },
    { name: 'Labor Economics', kw: ['labor economics', 'labor markets', 'wages', 'employment', 'human capital'] },
    { name: 'Public Economics', kw: ['public economics', 'public finance', 'taxation', 'public goods', 'externalities', 'welfare economics'] },
    { name: 'Industrial Organization', kw: ['industrial organization', 'market power', 'antitrust', 'oligopoly', 'monopoly', 'industrial economics'] },
    { name: 'Behavioral & Experimental Economics', kw: ['behavioral economics', 'behavioral finance', 'decision making', 'experimental economics', 'nudge'] },
    { name: 'History of Economic Thought', kw: ['history of economic', 'economic thought', 'political economy', 'classical economics', 'adam smith', 'keynes'] },
  ],
  Psychology: [
    { name: 'Statistics & Research Methods', kw: ['statistics', 'research methods', 'experimental design', 'spss', 'statistical', 'measurement', 'psychological research'] },
    { name: 'Social Psychology', kw: ['social psychology', 'group behavior', 'attitude', 'persuasion', 'social influence', 'conformity', 'prejudice'] },
    { name: 'Clinical & Counseling', kw: ['clinical psychology', 'psychotherapy', 'cognitive behavioral', 'cbt', 'counseling', 'psychopathology', 'therapy'] },
    { name: 'Cognitive Psychology', kw: ['cognitive psychology', 'cognition', 'memory', 'attention', 'perception', 'thinking', 'decision'] },
    { name: 'Developmental Psychology', kw: ['developmental psychology', 'child development', 'lifespan', 'adolescent', 'aging', 'human development'] },
    { name: 'Abnormal Psychology', kw: ['abnormal psychology', 'mental disorders', 'dsm', 'depression', 'anxiety', 'schizophrenia', 'personality disorder'] },
    { name: 'Biological & Neuropsychology', kw: ['biological psychology', 'biopsychology', 'behavioral neuroscience', 'neuropsychology', 'physiological psychology'] },
    { name: 'Personality Psychology', kw: ['personality', 'individual differences', 'trait theory', 'personality theories'] },
    { name: 'Industrial-Organizational', kw: ['industrial-organizational', 'organizational behavior', 'work psychology', 'i-o psychology'] },
    { name: 'Health & Positive Psychology', kw: ['health psychology', 'positive psychology', 'wellbeing', 'happiness', 'stress', 'coping'] },
    { name: 'Educational Psychology', kw: ['educational psychology', 'learning theory', 'motivation', 'intelligence', 'cognitive development'] },
  ],
  Philosophy: [
    { name: 'Ethics & Applied Ethics', kw: ['ethics', 'moral philosophy', 'morality', 'applied ethics', 'bioethics', 'business ethics', 'medical ethics', 'abortion', 'euthanasia', 'environmental ethics'] },
    { name: 'Epistemology', kw: ['epistemology', 'knowledge', 'justified true', 'skepticism', 'theory of knowledge'] },
    { name: 'Metaphysics', kw: ['metaphysics', 'ontology', 'existence', 'reality', 'substance', 'identity', 'free will', 'philosophy of mind', 'consciousness'] },
    { name: 'Logic', kw: ['logic', 'formal logic', 'symbolic logic', 'modal logic', 'deduction', 'reasoning', 'critical thinking'] },
    { name: 'Political Philosophy', kw: ['political philosophy', 'political theory', 'justice', 'rights', 'democracy', 'social contract', 'liberty', 'leviathan', 'republic'] },
    { name: 'Philosophy of Science', kw: ['philosophy of science', 'scientific method', 'falsification', 'paradigm', 'realism', 'kuhn', 'popper'] },
    { name: 'Ancient Philosophy', kw: ['ancient philosophy', 'plato', 'aristotle', 'socrates', 'stoicism', 'pre-socratic', 'gorgias', 'phaedo', 'nicomachean'] },
    { name: 'Continental Philosophy', kw: ['continental philosophy', 'phenomenology', 'heidegger', 'existentialism', 'sartre', 'nietzsche', 'hermeneutics', 'deconstruction', 'foucault', 'kant', 'hegel'] },
    { name: 'Analytic Philosophy', kw: ['analytic philosophy', 'philosophy of language', 'wittgenstein', 'russell', 'frege', 'mind and body'] },
    { name: 'Aesthetics', kw: ['aesthetics', 'beauty', 'philosophy of art', 'sublime'] },
    { name: 'Philosophy of Religion', kw: ['philosophy of religion', 'existence of god', 'god and evil', 'religious belief', 'faith and reason'] },
  ],
  History: [
    { name: 'American History', kw: ['american history', 'united states history', 'colonial america', 'civil war', 'us history', 'history of the united states', 'american heritage', 'give me liberty', 'out of many'] },
    { name: 'World History', kw: ['world history', 'global history', 'comparative history', 'world civilizations', 'world: a brief history'] },
    { name: 'Western Civilization', kw: ['western civilization', 'western heritage', 'civilization in the west', 'western civilizations', 'western society'] },
    { name: 'European History', kw: ['european history', 'europe', 'france history', 'british history', 'german history', 'history of europe', 'modern europe'] },
    { name: 'Ancient & Medieval History', kw: ['ancient', 'antiquity', 'rome', 'greece', 'medieval', 'middle ages', 'byzantine', 'crusades', 'feudalism', 'renaissance'] },
    { name: 'Modern & Contemporary History', kw: ['modern history', 'contemporary', 'world war', 'cold war', 'postwar', '20th century', '21st century', 'since 1945'] },
    { name: 'Asian History', kw: ['asian history', 'china history', 'japan history', 'india history', 'east asia', 'south asia', 'history of china', 'history of japan', 'history of india'] },
    { name: 'African & Latin American History', kw: ['african history', 'africa', 'latin america', 'caribbean', 'colonial africa', 'history of africa'] },
    { name: 'Intellectual & Cultural History', kw: ['intellectual history', 'history of ideas', 'cultural history', 'history of science', 'history of philosophy', 'social history'] },
    { name: 'Historical Methods', kw: ['historical method', 'doing history', 'history: a very short', 'writing history'] },
  ],
  Sociology: [
    { name: 'Research Methods', kw: ['research methods', 'qualitative methods', 'quantitative methods', 'survey', 'ethnography', 'sociological research', 'social research methods'] },
    { name: 'Social Theory', kw: ['social theory', 'sociological theory', 'classical sociological theory', 'marx', 'weber', 'durkheim', 'parsons', 'bourdieu', 'giddens'] },
    { name: 'Race & Ethnicity', kw: ['race', 'ethnicity', 'racism', 'racial', 'ethnic identity', 'whiteness', 'black', 'minority'] },
    { name: 'Gender & Sexuality', kw: ['gender', 'feminism', 'sexuality', 'queer', 'patriarchy', 'feminist', 'sex and gender'] },
    { name: 'Inequality & Social Class', kw: ['stratification', 'inequality', 'class', 'mobility', 'poverty', 'social class', 'power'] },
    { name: 'Urban Sociology', kw: ['urban', 'city', 'neighborhood', 'community', 'gentrification'] },
    { name: 'Deviance & Crime', kw: ['deviance', 'crime', 'criminology', 'delinquency', 'social control', 'labeling'] },
    { name: 'Globalization & World Systems', kw: ['globalization', 'global society', 'transnational', 'world systems', 'global inequality'] },
    { name: 'Sociology of Health', kw: ['medical sociology', 'health disparities', 'sociology of health', 'illness', 'death and dying'] },
    { name: 'Family & Life Course', kw: ['family', 'marriage', 'life course', 'aging', 'childhood'] },
    { name: 'Introduction to Sociology', kw: ['introduction to sociology', 'sociology: a brief', 'the real world', 'you may ask yourself', 'essentials of sociology'] },
  ],
  'Political Science': [
    { name: 'American Government & Politics', kw: ['american government', 'american politics', 'congress', 'elections', 'presidency', 'us government', 'american democracy', 'government in america'] },
    { name: 'Comparative Politics', kw: ['comparative politics', 'comparative government', 'regime types', 'democratization', 'comparative'] },
    { name: 'International Relations', kw: ['international relations', 'foreign policy', 'diplomacy', 'realism', 'liberalism', 'international politics', 'world politics', 'clash of civilizations', 'theory of international'] },
    { name: 'Political Theory & Philosophy', kw: ['political theory', 'political thought', 'normative theory', 'democratic theory', 'hobbes', 'locke', 'rousseau', 'john rawls', 'republic', 'leviathan', 'social contract', 'on liberty'] },
    { name: 'Public Policy & Administration', kw: ['public policy', 'policy analysis', 'policy making', 'public administration', 'bureaucracy'] },
    { name: 'Political Economy', kw: ['political economy', 'international political economy', 'state and market', 'capitalism and democracy'] },
    { name: 'Security Studies', kw: ['security studies', 'conflict', 'war', 'nuclear deterrence', 'terrorism', 'strategy'] },
    { name: 'EU & European Politics', kw: ['european union', 'eu politics', 'eu law', 'europe and', 'european integration'] },
    { name: 'Research Methods', kw: ['research methods', 'statistical', 'designing social inquiry', 'methods in political'] },
  ],
  Law: [
    { name: 'International Law', kw: ['international law', 'treaty', 'human rights law', 'international courts', 'public international', 'international legal'] },
    { name: 'Constitutional Law', kw: ['constitutional law', 'constitution', 'fundamental rights', 'judicial review', 'bill of rights'] },
    { name: 'Criminal Law', kw: ['criminal law', 'criminal', 'crime', 'criminal procedure'] },
    { name: 'Contract Law', kw: ['contracts', 'contract law', 'contract formation', 'consideration', 'breach'] },
    { name: 'Torts', kw: ['torts', 'tort law', 'negligence', 'liability', 'damages'] },
    { name: 'Property Law', kw: ['property law', 'property rights', 'land law', 'real property', 'equity', 'trusts'] },
    { name: 'Corporate & Business Law', kw: ['business law', 'commercial law', 'corporate law', 'company law', 'securities', 'commercial'] },
    { name: 'EU & Comparative Law', kw: ['eu law', 'european law', 'comparative law', 'civil law systems'] },
    { name: 'Administrative & Environmental Law', kw: ['administrative law', 'regulation', 'environmental law', 'climate law', 'natural resources'] },
    { name: 'Trade & Arbitration', kw: ['trade law', 'arbitration', 'dispute resolution', 'world trade', 'wto'] },
    { name: 'Jurisprudence & Legal Theory', kw: ['jurisprudence', 'legal theory', 'philosophy of law', 'natural law', 'positivism'] },
  ],
  'English Literature': [
    { name: 'Writing & Composition', kw: ['writing', 'composition', 'handbook', 'writer\'s reference', 'grammar', 'elements of style', 'bedford', 'norton field guide', 'pocket style'] },
    { name: 'British Literature', kw: ['british literature', 'english literature', 'victorian', 'romantic', 'shakespeare', 'chaucer', 'british novel', 'jane eyre', 'frankenstein', 'hamlet', 'paradise lost', 'wuthering heights', 'great expectations'] },
    { name: 'American Literature', kw: ['american literature', 'american novel', 'american poetry', 'american short', 'modernism', 'great gatsby', 'beloved', 'huckleberry finn', 'scarlet letter'] },
    { name: 'World Literature', kw: ['world literature', 'global literature', 'postcolonial', 'comparative literature', 'things fall apart', 'orientalism'] },
    { name: 'Literary Theory & Criticism', kw: ['literary theory', 'literary criticism', 'narratology', 'structuralism', 'deconstruction', 'norton anthology of theory', 'theory of literature'] },
    { name: 'Poetry', kw: ['poetry', 'poetics', 'lyric', 'versification', 'epic poetry', 'sound and sense'] },
    { name: 'Drama & Theatre', kw: ['drama', 'playwriting', 'theatrical', 'tragedy', 'comedy', 'plays', 'theatre'] },
    { name: 'Rhetoric & Argumentation', kw: ['rhetoric', 'argument', 'persuasion', 'rhetorical', 'ways of reading', 'they say'] },
  ],
  Medicine: [
    { name: 'Pharmacology', kw: ['pharmacology', 'pharmacotherapy', 'pharmacokinetics', 'pharmacodynamics', 'drugs', 'rang', 'clinical pharmacology'] },
    { name: 'Anatomy', kw: ['anatomy', 'gross anatomy', 'histology', 'neuroanatomy', 'regional anatomy', 'gray\'s', 'clinically oriented anatomy', 'atlas of anatomy'] },
    { name: 'Physiology', kw: ['physiology', 'human physiology', 'pathophysiology', 'systems physiology', 'guyton'] },
    { name: 'Pathology', kw: ['pathology', 'pathological', 'disease mechanisms', 'clinical pathology', 'robbins'] },
    { name: 'Public Health & Epidemiology', kw: ['public health', 'epidemiology', 'biostatistics', 'global health', 'preventive medicine', 'population health'] },
    { name: 'Clinical Medicine & Internal Medicine', kw: ['clinical medicine', 'internal medicine', 'harrison\'s', 'oxford handbook', 'davidson\'s', 'clinical examination'] },
    { name: 'Surgery', kw: ['surgery', 'surgical', 'operative', 'general surgery', 'surgical anatomy'] },
    { name: 'Psychiatry', kw: ['psychiatry', 'psychiatric', 'mental health', 'psychopharmacology'] },
    { name: 'Pediatrics & Women\'s Health', kw: ['pediatrics', 'pediatric', 'child health', 'obstetrics', 'gynecology', 'neonatology'] },
    { name: 'Research Methods & Medical Statistics', kw: ['research methods', 'medical statistics', 'evidence-based', 'how to read a paper', 'clinical research', 'systematic review'] },
    { name: 'Physiotherapy & Rehabilitation', kw: ['physiotherapy', 'physical therapy', 'rehabilitation', 'musculoskeletal'] },
  ],
  Business: [
    { name: 'Management & Organizational Behavior', kw: ['management', 'organizational behavior', 'organizational theory', 'leadership', 'strategic management'] },
    { name: 'Finance', kw: ['finance', 'financial management', 'corporate finance', 'investment', 'capital budgeting', 'financial markets'] },
    { name: 'Marketing', kw: ['marketing', 'consumer behavior', 'brand management', 'market research'] },
    { name: 'Entrepreneurship & Innovation', kw: ['entrepreneurship', 'startup', 'new venture', 'innovation', 'business creation', 'technology ventures'] },
    { name: 'International Business', kw: ['international business', 'global business', 'multinational', 'cross-cultural management', 'global strategy'] },
    { name: 'Business Ethics & CSR', kw: ['business ethics', 'corporate social responsibility', 'csr', 'stakeholder', 'ethical business'] },
    { name: 'Human Resources', kw: ['human resources', 'hr management', 'talent management', 'organizational development', 'personnel'] },
    { name: 'Operations & Supply Chain', kw: ['operations management', 'supply chain', 'logistics', 'project management', 'quality management', 'operations research'] },
    { name: 'Strategy', kw: ['strategic management', 'competitive strategy', 'business strategy', 'competitive advantage', 'porter'] },
  ],
  Anthropology: [
    { name: 'Cultural Anthropology', kw: ['cultural anthropology', 'culture counts', 'cultural diversity', 'mirror for humanity', 'appreciating cultural', 'anthropology: the exploration', 'humanity: an introduction'] },
    { name: 'Ethnography & Fieldwork', kw: ['ethnography', 'ethnographic', 'fieldwork', 'writing ethnographic', 'fieldnotes', 'participant observation'] },
    { name: 'Archaeology', kw: ['archaeology', 'archaeological', 'excavation', 'stratigraphy', 'prehistoric', 'material culture', 'field archaeology'] },
    { name: 'Physical & Biological Anthropology', kw: ['physical anthropology', 'biological anthropology', 'osteology', 'skeleton', 'human evolution', 'primate', 'forensic anthropology', 'how humans evolved', 'essentials of physical', 'our origins'] },
    { name: 'Social Theory & Anthropology', kw: ['social anthropology', 'theory in anthropology', 'history and theory in anthropology', 'outline of a theory', 'imagination', 'identity'] },
    { name: 'Medical & Applied Anthropology', kw: ['medical anthropology', 'health and culture', 'applied anthropology'] },
  ],
  Linguistics: [
    { name: 'Translation Studies', kw: ['translation', 'translating', 'translator', 'interpreting', 'interpretation', 'traductología', 'übersetzen'] },
    { name: 'Phonetics & Phonology', kw: ['phonology', 'phonetics', 'phonological', 'segmental', 'prosody', 'sound', 'pronunciation'] },
    { name: 'Syntax & Grammar', kw: ['syntax', 'grammatical structure', 'sentence structure', 'generative grammar', 'grammar', 'morphology'] },
    { name: 'Semantics & Pragmatics', kw: ['semantics', 'meaning', 'pragmatics', 'discourse', 'speech acts', 'conversation analysis', 'lexical'] },
    { name: 'Sociolinguistics', kw: ['sociolinguistics', 'language variation', 'dialectology', 'language and society', 'language and culture', 'bilingualism'] },
    { name: 'Historical Linguistics', kw: ['historical linguistics', 'language change', 'etymology', 'history of language', 'language history'] },
    { name: 'Second Language Acquisition', kw: ['second language', 'language acquisition', 'language learning', 'applied linguistics', 'language teaching', 'foreign language'] },
    { name: 'Computational Linguistics & NLP', kw: ['computational linguistics', 'natural language processing', 'nlp', 'corpus linguistics', 'language technology'] },
    { name: 'Introduction to Linguistics', kw: ['introduction to linguistics', 'language: an introduction', 'study of language', 'language instinct', 'linguistics: an introduction', 'an introduction to language'] },
  ],
  'Earth Sciences': [
    { name: 'Physical Geology', kw: ['physical geology', 'understanding earth', 'earth: an introduction', 'earth: portrait', 'foundations of earth', 'essentials of geology', 'introduction to physical geology', 'laboratory manual'] },
    { name: 'Structural Geology & Tectonics', kw: ['structural geology', 'tectonics', 'geodynamics', 'global tectonics', 'earth structure', 'plate'] },
    { name: 'Sedimentology & Stratigraphy', kw: ['sedimentology', 'stratigraphy', 'sedimentary', 'basin analysis', 'quaternary'] },
    { name: 'Petrology & Mineralogy', kw: ['petrology', 'mineralogy', 'igneous', 'metamorphic', 'mineral', 'rock-forming'] },
    { name: 'Geophysics & Seismology', kw: ['geophysics', 'seismology', 'earthquake', 'applied geophysics', 'geophysical exploration'] },
    { name: 'Oceanography', kw: ['oceanography', 'ocean', 'marine geology', 'ocean circulation', 'descriptive physical oceanography'] },
    { name: 'Environmental Geology & Hazards', kw: ['environmental geology', 'natural hazards', 'natural disasters', 'environmental hazards', 'earth science'] },
    { name: 'Hydrogeology & Groundwater', kw: ['hydrogeology', 'groundwater', 'hydrology', 'hydrogeology', 'applied hydrogeology', 'physical hydrogeology'] },
    { name: 'Geochemistry & Remote Sensing', kw: ['geochemistry', 'isotope', 'remote sensing', 'remote sensing of the'] },
    { name: 'Historical & Paleontology', kw: ['historical geology', 'paleontology', 'paleobiology', 'fossil record', 'earth through time', 'earth system history'] },
  ],
  'Fine Arts': [
    { name: 'Art History', kw: ['art history', 'art since 1900', 'gardner\'s', 'janson', 'history of art', 'survey of art', 'art movement', 'art criticism', 'visual culture'] },
    { name: 'Drawing & Painting', kw: ['drawing', 'painting', 'figure drawing', 'color', 'colour', 'pencil', 'watercolor'] },
    { name: 'Graphic Design & Typography', kw: ['graphic design', 'typography', 'design basics', 'visual design', 'logo'] },
    { name: 'Sculpture & Printmaking', kw: ['sculpture', 'printmaking', 'ceramics', 'three-dimensional'] },
    { name: 'Photography & New Media', kw: ['photography', 'photographic', 'digital photography', 'darkroom', 'new media', 'video art'] },
    { name: 'Contemporary & Modern Art', kw: ['contemporary art', 'modern art', 'installation', 'performance art', 'postmodern', 'avant-garde'] },
    { name: 'Art Theory & Criticism', kw: ['art theory', 'aesthetics', 'ways of seeing', 'work of art', 'visual pleasure', 'theory of art'] },
  ],
  Music: [
    { name: 'Music Theory & Harmony', kw: ['music theory', 'harmony', 'tonal harmony', 'counterpoint', 'musical form', 'ear training', 'sight singing', 'analysis'] },
    { name: 'Music History', kw: ['music history', 'history of music', 'western music', 'baroque', 'classical period', 'romantic music', 'listen to this', 'listen: a history'] },
    { name: 'Music Performance & Conducting', kw: ['performance', 'conducting', 'orchestration', 'ensemble', 'instrument', 'voice', 'singing'] },
    { name: 'Ethnomusicology & World Music', kw: ['ethnomusicology', 'world music', 'folk music', 'music and culture', 'global music'] },
    { name: 'Music Technology & Recording', kw: ['music technology', 'music production', 'audio engineering', 'recording', 'sound design', 'daw', 'modern recording'] },
    { name: 'Jazz & Popular Music', kw: ['jazz', 'popular music', 'pop music', 'rock', 'hip-hop', 'blues', 'american popular music'] },
  ],
  Education: [
    { name: 'Research Methods in Education', kw: ['research methods', 'educational research', 'research in education', 'research design', 'qualitative research', 'quantitative research', 'pedagogický výzkum'] },
    { name: 'Language Teaching & TESOL', kw: ['language teaching', 'tesol', 'teaching english', 'second language', 'esl', 'language pedagogy', 'foreign language teaching', 'didaktika'] },
    { name: 'Curriculum & Instruction', kw: ['curriculum', 'instruction', 'teaching methods', 'pedagogy', 'lesson planning', 'teaching and learning'] },
    { name: 'Educational Psychology', kw: ['educational psychology', 'learning theory', 'motivation', 'cognitive development', 'student learning', 'psychology of education'] },
    { name: 'Special & Inclusive Education', kw: ['special education', 'disability', 'inclusive education', 'learning disabilities', 'special needs', 'exceptional'] },
    { name: 'Early Childhood Education', kw: ['early childhood', 'kindergarten', 'preschool', 'early learning', 'young children', 'early education'] },
    { name: 'Higher Education', kw: ['higher education', 'university', 'college teaching', 'academic', 'tertiary education'] },
    { name: 'Educational Leadership & Policy', kw: ['school leadership', 'educational administration', 'principal', 'educational policy', 'educational management', 'school management'] },
  ],
  Architecture: [
    { name: 'Architectural History & Theory', kw: ['history of architecture', 'modern architecture', 'classical architecture', 'architectural theory', 'postmodern', 'towards a new architecture', 'complexity and contradiction', 'theory and design'] },
    { name: 'Interior Design', kw: ['interior design', 'interior space', 'interiors: an introduction', 'residential interior', 'interior visualization', 'codes guidebook for interiors'] },
    { name: 'Urban Design & Planning', kw: ['urban design', 'urban planning', 'city planning', 'cities', 'city shaped', 'life between buildings', 'image of the city', 'death and life', 'cities for people', 'city in history'] },
    { name: 'Building Construction & Technology', kw: ['building construction', 'construction', 'building technology', 'structural systems', 'materials and methods', 'mechanical and electrical', 'heating', 'building codes'] },
    { name: 'Sustainable & Environmental Design', kw: ['sustainable', 'green', 'energy efficiency', 'environmental design', 'green studio', 'green imperative', 'cradle to cradle'] },
    { name: 'Drawing & Representation', kw: ['drawing', 'graphics', 'drafting', 'architectural graphic', 'color drawing', 'color', 'architectural drawing', 'design drawing', 'representation'] },
    { name: 'Landscape Architecture', kw: ['landscape', 'landscape architecture', 'site planning', 'landscape graphics', 'landscape man', 'design with nature'] },
    { name: 'Design Process & Methodology', kw: ['design process', 'how designers think', 'analyzing architecture', 'architectural research', 'design of everyday', 'pattern language'] },
  ],
  Geography: [
    { name: 'GIS & Cartography', kw: ['gis', 'geographic information', 'remote sensing', 'arcgis', 'cartography', 'mapping', 'geospatial', 'digital image processing', 'map design'] },
    { name: 'Human Geography', kw: ['human geography', 'cultural geography', 'social geography', 'human geographies', 'introducing human'] },
    { name: 'Urban Geography', kw: ['urban geography', 'urban social geography', 'city', 'urban'] },
    { name: 'Physical Geography', kw: ['physical geography', 'geomorphology', 'climate', 'biogeography', 'hydrology', 'geosystems', 'introducing physical'] },
    { name: 'Economic Geography', kw: ['economic geography', 'global shift', 'regional development', 'world economy', 'development geography', 'globalization and diversity'] },
    { name: 'Political Geography', kw: ['political geography', 'geopolitics', 'borders', 'territory', 'sovereignty'] },
    { name: 'World Regional Geography', kw: ['world regional geography', 'world regions', 'regional geography', 'geography: realms', 'fundamentals of world'] },
    { name: 'Research Methods', kw: ['research methods', 'qualitative research', 'statistical methods in geography', 'quantitative methods'] },
    { name: 'Surveying & Geomatics', kw: ['surveying', 'elementary surveying', 'geomatics'] },
  ],
  'Social Work': [
    { name: 'Social Work Practice', kw: ['social work practice', 'direct social work', 'practice of social work', 'social work skills', 'social work methods', 'essential theory for social work'] },
    { name: 'Social Work Theory', kw: ['modern social work theory', 'social work theories', 'social work theory', 'a brief introduction to social work theory'] },
    { name: 'Research Methods', kw: ['research methods', 'research design', 'research for social work', 'essential research methods', 'social research'] },
    { name: 'Social Policy', kw: ['social policy', 'welfare', 'american social welfare', 'social welfare policy', 'student companion to social policy'] },
    { name: 'Child & Family', kw: ['child', 'family', 'child protection', 'child abuse', 'child development', 'child welfare', 'effective child protection'] },
    { name: 'Group & Community Work', kw: ['group work', 'group psychotherapy', 'community', 'organizing', 'community change'] },
    { name: 'Ethics & Values', kw: ['ethics', 'values and ethics', 'anti-discriminatory', 'anti-oppressive', 'equality', 'promoting equality'] },
    { name: 'Field Placement & Professional Development', kw: ['field placement', 'field instruction', 'reflective', 'supervision', 'internship'] },
  ],
  Accounting: [
    { name: 'Financial Accounting', kw: ['financial accounting', 'financial statements', 'gaap', 'ifrs', 'balance sheet', 'financial reporting', 'introduction to financial accounting', 'fundamentals of financial', 'advanced accounting', 'financial and managerial'] },
    { name: 'Managerial & Cost Accounting', kw: ['managerial accounting', 'management accounting', 'cost accounting', 'manažerské', 'cost management', 'advanced management accounting', 'accounting for managers'] },
    { name: 'Auditing & Assurance', kw: ['auditing', 'audit', 'assurance', 'external audit', 'internal controls', 'modern auditing', 'principles of auditing', 'the audit process'] },
    { name: 'Taxation', kw: ['taxation', 'tax accounting', 'corporate tax', 'tax law', 'tax planning', 'australian taxation', 'australian tax', 'taxation of individuals'] },
    { name: 'Accounting Information Systems', kw: ['accounting information systems', 'ais', 'erp', 'enterprise systems', 'management control systems'] },
    { name: 'Accounting Theory & Ethics', kw: ['accounting theory', 'positive accounting theory', 'ethical obligations', 'ethics and decision making', 'contemporary issues in accounting'] },
  ],
  Marketing: [
    { name: 'Core Marketing', kw: ['principles of marketing', 'marketing management', 'marketing: an introduction', 'marketing: the core', 'basic marketing', 'foundations of marketing', 'essentials of marketing', 'framework for marketing', 'contemporary marketing', 'market-based management'] },
    { name: 'Consumer Behavior', kw: ['consumer behavior', 'consumer behaviour', 'consumer decision', 'consumer psychology'] },
    { name: 'Advertising & IMC', kw: ['advertising', 'integrated marketing', 'integrated advertising', 'promotion', 'marketing communications', 'marketingová komunikace'] },
    { name: 'International & Global Marketing', kw: ['international marketing', 'global marketing', 'international marketing strategy', 'marketing across cultures', 'global marketing and advertising'] },
    { name: 'Brand Management', kw: ['brand management', 'brand', 'branding', 'brand equity', 'building strong brands', 'strategic brand management'] },
    { name: 'Digital & Social Media Marketing', kw: ['digital marketing', 'social media marketing', 'e-marketing', 'internet marketing', 'online marketing', 'new rules of marketing'] },
    { name: 'Services Marketing', kw: ['services marketing', 'service management', 'services marketing: integrating'] },
    { name: 'Marketing Research', kw: ['marketing research', 'market research', 'marketing research essentials', 'multivariate data analysis'] },
    { name: 'Strategic Marketing', kw: ['strategic marketing', 'marketing strategy', 'competitive positioning', 'strategic market management'] },
  ],
  Nursing: [
    { name: 'Medical-Surgical Nursing', kw: ['medical-surgical', 'adult health', 'clinical nursing', 'nursing care', 'medical surgical'] },
    { name: 'Pharmacology & Medications', kw: ['pharmacology', 'drug guide', 'pharmacological', 'medication', 'nurse\'s drug', 'pharmacotherapy', 'clinical pharmacology', 'drug handbook'] },
    { name: 'Fundamentals of Nursing', kw: ['fundamentals of nursing', 'fundamentals:', 'foundations of nursing', 'kozier', 'introduction to nursing', 'basic nursing'] },
    { name: 'Research & Evidence-Based Practice', kw: ['research', 'evidence-based', 'nursing research', 'statistics', 'quantitative', 'qualitative'] },
    { name: 'Psychiatric & Mental Health Nursing', kw: ['psychiatric nursing', 'mental health nursing', 'psychiatric-mental', 'mental health'] },
    { name: 'Maternal, Pediatric & Family Nursing', kw: ['maternal', 'pediatric nursing', 'maternal-newborn', 'obstetric', 'women\'s health', 'child health nursing', 'neonatal'] },
    { name: 'Pathophysiology & Assessment', kw: ['pathophysiology', 'health assessment', 'physical assessment', 'physical examination', 'health history'] },
    { name: 'Community & Leadership', kw: ['community health nursing', 'public health nursing', 'leadership', 'management', 'nursing management', 'community nursing'] },
  ],
  Religion: [
    { name: 'World Religions & Comparative Religion', kw: ['world religions', 'comparative religion', 'living religions', 'religions of the world', 'world\'s religions', 'invitation to world religions', 'experiencing the world', 'global religions'] },
    { name: 'Christianity & Bible Studies', kw: ['christian', 'bible', 'new testament', 'old testament', 'protestant', 'catholic', 'church', 'gospel', 'testament', 'biblical', 'encountering the new', 'essence of the new', 'everyday bible'] },
    { name: 'Islam', kw: ['islam', 'islamic', 'quran', 'qurʼan', 'koran', 'muslim', 'hadith', 'arabic literature'] },
    { name: 'Buddhism', kw: ['buddhism', 'buddhist', 'dharma', 'nirvana', 'meditation', 'mahayana', 'what the buddha'] },
    { name: 'Hinduism', kw: ['hinduism', 'hindu', 'vedas', 'upanishads', 'bhagavad-gita', 'yoga'] },
    { name: 'Judaism', kw: ['judaism', 'jewish', 'talmud', 'torah', 'old testament', 'hebrew bible', 'sinai'] },
    { name: 'Sociology & Psychology of Religion', kw: ['sociology of religion', 'sacred', 'secular', 'protestant ethic', 'varieties of religious', 'elementary forms of religious', 'sacred canopy', 'public religions'] },
    { name: 'Religion & Culture/Politics', kw: ['religion and culture', 'religion, religions', 'invention of world religions', 'civil religion', 'religious violence', 'secular age', 'formations of the secular'] },
  ],
  Theology: [
    { name: 'Biblical Studies & Hermeneutics', kw: ['biblical', 'bible', 'old testament', 'new testament', 'exegesis', 'hermeneutics', 'interpretation', 'how to read the bible', 'grasping god\'s word', 'biblical preaching', 'biblical narrative'] },
    { name: 'Systematic & Dogmatic Theology', kw: ['systematic theology', 'christian theology', 'christian doctrine', 'theology for', 'christian theology: an introduction', 'faith seeking understanding', 'church dogmatics'] },
    { name: 'Church Leadership & Ministry', kw: ['leadership', 'church', 'ministry', 'pastoral', 'preaching', 'church planting', 'purpose driven', 'simple church', 'leading change', 'courageous leadership', 'lead like'] },
    { name: 'Spiritual Formation & Discipleship', kw: ['spiritual', 'discipleship', 'spiritual disciplines', 'celebration of discipline', 'spiritual leadership', 'cost of discipleship', 'knowing god', 'christian life'] },
    { name: 'Church History & Historical Theology', kw: ['history of christianity', 'church history', 'early christian', 'backgrounds of early christianity', 'turning points', 'christian tradition', 'story of christianity'] },
    { name: 'Missiology & Evangelism', kw: ['mission', 'evangelism', 'missional', 'transforming mission', 'celtic way of evangelism', 'master plan of evangelism', 'global christianity'] },
  ],
  'Media / Communications': [
    { name: 'Public Speaking', kw: ['public speaking', 'speech', 'communication: making connections', 'fundamentals of public', 'speaking with confidence', 'art of public speaking'] },
    { name: 'Interpersonal Communication', kw: ['interpersonal communication', 'interpersonal', 'communication skills', 'human communication'] },
    { name: 'Mass Communication & Media Studies', kw: ['mass communication', 'media studies', 'mass media', 'media theory', 'introduction to mass', 'media and culture', 'mass media in a changing'] },
    { name: 'Public Relations', kw: ['public relations', 'pr', 'strategic communication', 'crisis communication', 'public relations: strategies'] },
    { name: 'Digital & Social Media', kw: ['digital media', 'social media', 'new media', 'online communication', 'internet communication', 'media convergence'] },
    { name: 'Media & Society', kw: ['media and society', 'political communication', 'media effects', 'agenda setting', 'media literacy', 'power without responsibility', 'media history'] },
    { name: 'Intercultural Communication', kw: ['intercultural communication', 'cross-cultural communication', 'cultural communication', 'communicating across'] },
  ],
  Astronomy: [
    { name: 'Introductory Astronomy', kw: ['cosmic perspective', 'astronomy today', 'foundations of astronomy', 'astronomy: a beginner', 'discovering the universe', 'horizons: exploring', 'explorations: an introduction', 'pathways to astronomy', 'astronomy:', 'introductory astronomy'] },
    { name: 'Astrophysics', kw: ['astrophysics', 'astrophysical', 'foundations of astrophysics', 'modern astrophysics', 'introduction to modern astrophysics', 'high energy astrophysics', 'theoretical astrophysics'] },
    { name: 'Cosmology', kw: ['cosmology', 'big bang', 'dark matter', 'early universe', 'modern cosmology', 'introduction to cosmology', 'cosmological', 'foundations of modern cosmology', 'physical foundations of cosmology'] },
    { name: 'Stellar Physics', kw: ['stellar', 'stars', 'galactic', 'galaxy formation', 'stellar structure', 'stellar evolution', 'stellar astrophysics'] },
    { name: 'Planetary Science & Solar System', kw: ['solar system', 'planetary', 'planets', 'life in the universe', 'new solar system'] },
    { name: 'Observational & Radio Astronomy', kw: ['observational', 'observational astronomy', 'radio astronomy', 'spectroscopy', 'telescope', 'ccd astronomy', 'nightwatch'] },
    { name: 'Relativity & Black Holes', kw: ['relativity', 'black holes', 'gravitation', 'general relativity', 'einstein', 'time warps', 'brief history of time'] },
  ],
  Agriculture: [
    { name: 'Soil Science', kw: ['soil', 'půdoznalství', 'půdoznalosti', 'soil science', 'nature and properties of soils', 'elements of the nature', 'fundamentals of soil', 'soil science and management', 'principles of soil'] },
    { name: 'Plant Science & Crops', kw: ['plant', 'crop', 'agronomy', 'rostlinná', 'produkce rostlinná', 'zelinářství', 'ovocnictví', 'plant physiology', 'plant pathology', 'agronomic', 'pícninářství', 'botanika'] },
    { name: 'Animal Science & Livestock', kw: ['animal science', 'livestock', 'chov', 'produkce masa', 'animal nutrition', 'animal husbandry', 'scientific farm', 'chov koní', 'chov prasat', 'poultry', 'dairy'] },
    { name: 'Viticulture & Wine', kw: ['wine', 'viticulture', 'winemaking', 'réva', 'winery', 'vino', 'wein', 'vineyard', 'grape', 'wine science', 'encyklopedie révy', 'wine tasting'] },
    { name: 'Agricultural Economics', kw: ['agricultural economics', 'farm management', 'agribusiness', 'agricultural marketing', 'marketing of agricultural', 'farm economics'] },
    { name: 'Food Science & Technology', kw: ['food science', 'food technology', 'food processing', 'food safety', 'dairy science', 'food processing technology', 'sensory evaluation of food'] },
    { name: 'Ecology & Sustainable Agriculture', kw: ['agroecology', 'ecology', 'organic farming', 'environmental', 'sustainable agriculture', 'multifunctional agriculture', 'ekologické zemědělství', 'krajinná ekologie'] },
    { name: 'Plant Protection & Pests', kw: ['pathology', 'pest', 'entomology', 'herbicide', 'herbologie', 'plant protection', 'chorob', 'škůdců'] },
    { name: 'Horticulture & Landscape', kw: ['horticulture', 'horticultural', 'arboriculture', 'landscape plants', 'floral design', 'ornamental'] },
  ],
  'Criminal Justice': [
    { name: 'Introduction to Criminal Justice', kw: ['introduction to criminal justice', 'criminal justice today', 'criminal justice: a brief', 'essentials of criminal justice', 'american system of criminal justice', 'criminal justice in action', 'criminal justice in america'] },
    { name: 'Criminology', kw: ['criminology', 'crime theories', 'criminal behavior', 'oxford handbook of criminology', 'criminology:', 'culture of control', 'new jim crow'] },
    { name: 'Policing', kw: ['policing', 'police', 'law enforcement', 'patrol', 'investigation', 'an introduction to policing', 'handbook of policing', 'intelligence-led'] },
    { name: 'Corrections', kw: ['corrections', 'prisons', 'incarceration', 'probation', 'parole', 'rehabilitation', 'corrections in america', 'american corrections', 'life without parole', 'correctional'] },
    { name: 'Forensic Science', kw: ['forensic', 'forensic science', 'crime scene', 'criminalistics', 'forensic investigation', 'crime scene investigation'] },
    { name: 'Juvenile Justice', kw: ['juvenile', 'youth and crime', 'juvenile delinquency', 'juvenile justice'] },
    { name: 'Courts & Criminal Procedure', kw: ['courts', 'criminal procedure', 'criminal law', 'criminal evidence', 'criminal process', 'court'] },
    { name: 'Research Methods', kw: ['research methods', 'research in criminology', 'basics of research', 'practice of research', 'fundamentals of research'] },
  ],
  'Public Safety': [
    { name: 'Fire Science', kw: ['fire', 'firefight', 'fire protection', 'fire behavior', 'fire dynamics', 'fire prevention', 'principles of fire', 'fire investigation', 'enclosure fire', 'fire department', 'firefighter', 'wildland fire', 'fire phenomenon'] },
    { name: 'Emergency Management', kw: ['emergency management', 'emergency services', 'disaster response', 'disaster', 'introduction to emergency', 'preparedness', 'national incident', 'all-hazards', 'critical infrastructure'] },
    { name: 'Homeland Security & Terrorism', kw: ['homeland security', 'terrorism', 'terrorist', 'jihadist', 'counterterrorism', 'understanding terrorism', 'cyberterrorism', 'al qaeda'] },
    { name: 'Hazardous Materials', kw: ['hazardous materials', 'hazmat', 'fire and emergency'] },
  ],
  'Health Technician': [
    { name: 'Radiography & Imaging', kw: ['radiograph', 'radiology', 'radiologic', 'mri', 'computed tomography', 'imaging', 'ultrasound', 'sonography', 'echocardiograph', 'diagnostic imaging', 'ct ', 'nuclear medicine', 'positional', 'bontrager', 'merrill'] },
    { name: 'Respiratory Therapy', kw: ['respiratory', 'respiratory care', 'pulmonary', 'egan\'s fundamentals', 'respiratory therapy'] },
    { name: 'Emergency & Paramedic Care', kw: ['paramedic', 'emergency care', 'prehospital', 'emergency care in the streets', 'advanced cardiac'] },
    { name: 'Occupational Therapy', kw: ['occupational therapy', 'willard and spackman', 'creek\'s', 'occupational therapy and physical'] },
    { name: 'Anatomy & Physiology', kw: ['anatomy', 'physiology', 'anatomy and physiology', 'clinically oriented anatomy', 'gray\'s anatomy', 'atlas of human anatomy', 'principles of anatomy'] },
    { name: 'Physical Therapy & Rehabilitation', kw: ['physical rehabilitation', 'therapeutic exercise', 'orthopedic physical assessment', 'physical therapy', 'therapeutic exercises'] },
    { name: 'Clinical Lab & Phlebotomy', kw: ['laboratory', 'phlebotomy', 'hematology', 'urinalysis', 'clinical lab', 'medical laboratory'] },
    { name: 'Medical Terminology & Practice', kw: ['medical language', 'medical terminology', 'medical insurance', 'law and ethics', 'medical office'] },
  ],
  'Film and Photography': [
    { name: 'Film Studies & History', kw: ['film history', 'history of narrative film', 'history of film', 'film studies', 'cinema studies', 'a history of american cinema', 'short history of the movies', 'film experience', 'looking at movies', 'film art', 'introduction to film', 'how to read a film', 'what is cinema'] },
    { name: 'Film Theory & Criticism', kw: ['film theory', 'cinema book', 'film/genre', 'visual pleasure', 'narration in the fiction', 'film theory and criticism', 'oxford guide to film'] },
    { name: 'Directing', kw: ['directing', 'director', 'film directing', 'on directing', 'on film-making'] },
    { name: 'Screenwriting', kw: ['screenwriting', 'screenplay', 'screenwriter', 'script', 'save the cat', 'story: substance', 'writer\'s journey', 'art of dramatic writing'] },
    { name: 'Documentary', kw: ['documentary', 'directing the documentary', 'documentary storytelling', 'new documentary', 'representing reality'] },
    { name: 'Photography', kw: ['photography', 'photographic', 'camera lucida', 'on photography', 'photograph', 'world history of photography', 'a short course in photography'] },
    { name: 'Animation', kw: ['animation', 'animator', 'cartoons', 'illusion of life', 'acting for animators', 'timing for animation'] },
    { name: 'Production & Editing', kw: ['production', 'filmmaker', 'cinematography', 'lighting', 'sound', 'editing', 'film editing', 'blink of an eye', 'visual story'] },
  ],
  Spanish: [
    { name: 'Grammar & Language Reference', kw: ['gramática', 'grammar', 'gramatika', 'gramatik', 'gramática didáctica', 'spanish verbs', 'conjugat', 'diccionario', 'uso de la gramática', 'reference grammar'] },
    { name: 'Textbooks & Language Learning', kw: ['vistas', 'plazas', 'mosaicos', 'dos mundos', 'puntos de partida', 'imagina', 'panorama', 'anda!', 'cuadros', 'conexiones', 'unidos', 'conectados', 'hola, amigos', 'español sin fronteras', 'nuevos mundos', 'review and', 'introductory', 'beginning', 'intermediate', 'advanced'] },
    { name: 'Spanish Literature', kw: ['literatura', 'literatura hispanoamérica', 'historia y crítica', 'don quijote', 'la celestina', 'la vida es sueño', 'pedro páramo', 'soldados de salamina', 'ficciones', 'teatro español', 'épocas de la literatura'] },
    { name: 'Translation Studies', kw: ['translation', 'traductología', 'thinking spanish translation', 'introducción a la traductología', 'translation studies'] },
    { name: 'Linguistics & Culture', kw: ['lingüística', 'linguistics', 'fonología', 'fonética', 'history of spanish', 'historia de la lengua', 'dialectología', 'pragmática', 'contemporary spain', 'new spaniards', 'hispanic culture'] },
    { name: 'Cinema & Media', kw: ['cinema', 'film', 'spanish cinema', 'contemporary spain'] },
  ],
  German: [
    { name: 'Grammar & Language Reference', kw: ['grammatik', 'grammar', 'gramatika', 'lehr- und übungsbuch', 'deutsche grammatik', 'übungsgrammatik', 'hammer\'s german grammar', 'handbuch zur deutschen grammatik', 'grundriss', 'lexikon der sprachwissenschaft', 'structure of german'] },
    { name: 'Textbooks & Language Learning', kw: ['kontakte', 'vorsprung', 'deutsch an der uni', 'stationen', 'wie geht\'s', 'sag mal', 'daf kompakt', 'studio d', 'motive', 'mittelstufe deutsch', 'deutsch eins zwei', 'dreimal deutsch', 'blick auf deutschland'] },
    { name: 'German Literature', kw: ['literatur', 'literaturgeschichte', 'deutsche literatur', 'epochen', 'literary', 'kleine geschichte', 'lesebuch', 'die verwandlung', 'faust', 'death in venice', 'reader:', 'sandmann', 'blonde eckbert'] },
    { name: 'Translation Studies', kw: ['translation', 'übersetzung', 'dolmetschen', 'thinking german translation', 'umění překladu', 'handbuch didaktik des übersetzens'] },
    { name: 'Linguistics & Language History', kw: ['sprachwissenschaft', 'sprachgeschichte', 'linguistik', 'textanalyse', 'linguistische', 'studien', 'gesprochenes deutsch', 'phonetik', 'phraseologie', 'history of german language', 'german language'] },
    { name: 'Business & Specialized German', kw: ['wirtschaftsdeutsch', 'wirtschaftskommunikation', 'deutsch für juristen', 'fachsprachen', 'business german'] },
    { name: 'Culture & Society', kw: ['geschichte', 'concise history of germany', 'anatomy of a dictatorship', 'reálie', 'deutschland und die tschechen'] },
  ],
  French: [
    { name: 'Grammar & Language Reference', kw: ['grammaire', 'grammar', 'grammatik', 'bon usage', 'grammaire progressive', 'grammaire méthodique', 'nouvelle grammaire', 'comprehensive french grammar', 'grammaire du sens', 'grammaire française'] },
    { name: 'Textbooks & Language Learning', kw: ['horizons', 'motifs', 'chez nous', 'deux mondes', 'vis-a-vis', 'promenades', 'imaginez', 'contacts', 'interaction', 'contrastes', 'en avant', 'french in action', 'parlons français'] },
    { name: 'French Literature', kw: ['littérature', 'literary', 'madame bovary', 'les fleurs du mal', 'histoire de la littérature', 'dějiny francouzské literatury', 'grands auteurs', 'étranger', 'second sex', 'nausée', 'candide', 'phèdre', 'en attendant godot', 'liaisons dangereuses', 'la place', 'la princesse de clèves'] },
    { name: 'Translation Studies', kw: ['translation', 'traduction', 'thinking french translation', 'les problèmes théoriques', 'stylistique comparée', 'teorie a praxe překladu'] },
    { name: 'Linguistics & Phonetics', kw: ['linguistique', 'phonétique', 'français dans tous les sens', 'le français correct', 'préçis de lexicologie', 'grammatique textuelle', 'fonetika', 'morphosyntaxe', 'grammaire critique'] },
    { name: 'Culture & Society', kw: ['france', 'vie en bleu', 'france since 1945', 'studying and working in france', 'fast cars', 'reálie', 'geography of france', 'francoscopy'] },
  ],
  'Theatre Arts': [
    { name: 'Acting', kw: ['acting', 'actor', 'an actor prepares', 'actor speaks', 'to the actor', 'sanford meisner', 'stanislavski', 'audition', 'challenge for the actor', 'respect for acting', 'practical handbook for the actor', 'actor and the target'] },
    { name: 'Voice & Movement', kw: ['voice', 'freeing the natural voice', 'right to speak', 'freeing shakespeare', 'physical theatre', 'body', 'movement', 'through the body', 'viewpoints'] },
    { name: 'Design & Technical Theatre', kw: ['design', 'production', 'lighting', 'scene design', 'stage lighting', 'backstage', 'costum', 'scenic', 'scenograph', 'stage management', 'sound and music for'] },
    { name: 'Directing & Devising', kw: ['directing', 'director', 'devising', 'devised', 'making a performance', 'different every night', 'director prepares', 'director\'s craft'] },
    { name: 'Theatre Theory & History', kw: ['theory', 'theatre history', 'history of the theatre', 'theatre histories', 'performance studies', 'postdramatic', 'performance theory', 'empty space'] },
    { name: 'Plays & Repertoire', kw: ['hamlet', 'waiting for godot', 'doll\'s house', 'streetcar named desire', 'raisin in the sun', 'oedipus', 'death of a salesman', 'angels in america', 'fences', 'importance of being', 'midsummer', 'mother courage', 'theatre of the absurd', 'poetics'] },
    { name: 'Applied & Community Theatre', kw: ['applied drama', 'applied theatre', 'theatre of the oppressed', 'community', 'games for actors', 'impro'] },
    { name: 'Playwriting & Dramaturgy', kw: ['playwriting', 'dramaturgy', 'how plays work', 'art of dramatic writing', 'script', 'backwards and forwards'] },
  ],
  'Basic Skills': [
    { name: 'College Success', kw: ['college', 'master student', 'on course', 'focus on community college', 'keys to success', 'your college experience', 'foundations of academic', 'student success', 'achieve college', 'step to college', 'power learning', 'community college experience'] },
    { name: 'Reading Comprehension', kw: ['reading skills', 'reading comprehension', 'ten steps', 'college reading', 'effective reader', 'reading across', 'opening doors', 'bridging the gap', 'breaking through', 'groundwork for college reading', 'essential reading skills'] },
    { name: 'Writing & Grammar', kw: ['writing', 'grammar', 'english grammar', 'grammar in context', 'fundamentals of english grammar', 'basic english grammar', 'academic writing', 'writing in college', 'about writing', 'grammar sense'] },
    { name: 'Vocabulary', kw: ['vocabulary', 'word power', 'vocabulary skills', 'building vocabulary', 'advancing vocabulary', 'groundwork for a better vocabulary'] },
    { name: 'Study Skills', kw: ['study skills', 'essential study skills', 'how to study', 'good study guide', 'study guide'] },
  ],
  'Criminal Justice': [
    { name: 'Introduction to Criminal Justice', kw: ['introduction to criminal justice', 'criminal justice today', 'criminal justice: a brief', 'essentials of criminal justice', 'american system of criminal justice', 'criminal justice in action', 'criminal justice in america'] },
    { name: 'Criminology', kw: ['criminology', 'crime theories', 'criminal behavior', 'oxford handbook of criminology', 'criminology:', 'culture of control', 'new jim crow'] },
    { name: 'Policing', kw: ['policing', 'police', 'law enforcement', 'patrol', 'an introduction to policing', 'handbook of policing', 'intelligence-led'] },
    { name: 'Corrections', kw: ['corrections', 'prisons', 'incarceration', 'probation', 'parole', 'corrections in america', 'american corrections', 'life without parole'] },
    { name: 'Forensic Science', kw: ['forensic', 'crime scene', 'criminalistics', 'forensic investigation', 'forensic fire'] },
    { name: 'Juvenile Justice', kw: ['juvenile', 'youth and crime', 'juvenile delinquency', 'juvenile justice'] },
    { name: 'Courts & Criminal Procedure', kw: ['courts', 'criminal procedure', 'criminal law', 'criminal evidence', 'criminal process'] },
    { name: 'Research Methods', kw: ['research methods', 'research in criminology', 'basics of research', 'fundamentals of research'] },
  ],
  'Mechanic / Repair Tech': [
    { name: 'Automotive Technology', kw: ['automotive technology', 'automotive service', 'automotive', 'auto', 'vehicle', 'modern automotive', 'fundamentals of automotive', 'auto body', 'collision repair'] },
    { name: 'Diesel & Heavy Vehicles', kw: ['diesel', 'heavy duty', 'truck', 'medium/heavy', 'commercial vehicle', 'tractor-trailer', 'bus'] },
    { name: 'Automotive Electrical & Electronics', kw: ['automotive electricity', 'automotive electronics', 'electrical wiring', 'computerized engine', 'advanced automotive electrical', 'automotive electrical'] },
    { name: 'Heating, Ventilation & Air Conditioning', kw: ['refrigeration', 'air conditioning', 'hvac', 'heating', 'hvacr', 'electricity for refrigeration'] },
    { name: 'Aviation Maintenance', kw: ['aircraft', 'aviation', 'airframe', 'powerplant', 'aircraft gas turbine', 'aviation maintenance', 'technician general'] },
    { name: 'Welding', kw: ['welding', 'welding skills', 'modern welding', 'blueprint reading for welders'] },
    { name: 'Machine Tools & Manufacturing', kw: ['machine tool', 'machining', 'precision machining', 'machinery', 'millwrights', 'metalsmith', 'manufacturing'] },
    { name: 'Engine & Drivetrain', kw: ['engine', 'drivetrain', 'transmissions', 'transaxles', 'diesel engine', 'internal combustion', 'small gas engine'] },
  ],
  'Basic Computer Skills': [
    { name: 'Microsoft Office', kw: ['microsoft office', 'microsoft word', 'microsoft excel', 'microsoft windows', 'office 2007', 'office 2010', 'office 2013', 'office 2016', 'office 365', 'powerpoint', 'access 2002', 'word 2002', 'excel 2013', 'go! with microsoft', 'exploring microsoft', 'illustrated microsoft'] },
    { name: 'Keyboarding & Word Processing', kw: ['keyboarding', 'keyboard', 'gregg college keyboarding', 'keyboarding course', 'typing', 'word processing', 'skillbuilding', 'college keyboarding', 'document processing'] },
    { name: 'Computing Essentials & Internet', kw: ['technology in action', 'using information technology', 'discovering computers', 'internet', 'computing essentials', 'the practical pc', 'computer concepts', 'understanding computers', 'our digital world', 'practical computer literacy'] },
  ],
  Theology: [
    { name: 'Biblical Studies & Hermeneutics', kw: ['biblical', 'bible', 'old testament', 'new testament', 'exegesis', 'hermeneutics', 'how to read the bible', 'grasping god\'s word', 'art of biblical narrative', 'introduction to biblical interpretation', 'biblical preaching'] },
    { name: 'Systematic & Dogmatic Theology', kw: ['systematic theology', 'christian theology', 'christian doctrine', 'theology for the community', 'faith seeking understanding', 'church dogmatics', 'institutes of the christian', 'evangelical dictionary of theology'] },
    { name: 'Church Leadership & Ministry', kw: ['leadership', 'church', 'ministry', 'pastoral', 'preaching', 'church planting', 'purpose driven', 'simple church', 'leading change', 'courageous leadership', 'lead like', 'five dysfunctions'] },
    { name: 'Spiritual Formation & Discipleship', kw: ['spiritual', 'discipleship', 'spiritual disciplines', 'celebration of discipline', 'cost of discipleship', 'knowing god', 'foundations of spiritual'] },
    { name: 'Church History & Historical Theology', kw: ['history of christianity', 'church history', 'early christian', 'backgrounds of early', 'turning points', 'christian tradition', 'story of christianity', 'next christendom'] },
    { name: 'Missiology & Evangelism', kw: ['mission', 'evangelism', 'missional', 'transforming mission', 'celtic way of evangelism', 'master plan of evangelism', 'building a contagious church'] },
  ],
  Dentistry: [
    { name: 'Dental Assisting', kw: ['dental assisting', 'modern dental assisting', 'torres and ehrlich', 'comprehensive approach'] },
    { name: 'Dental Hygiene', kw: ['dental hygiene', 'clinical practice of the dental hygienist', 'dental hygiene theory', 'foundations of periodontics for the dental hygienist', 'mosby\'s dental hygiene', 'comprehensive review of dental hygiene', 'clinical textbook of dental hygiene'] },
    { name: 'Dental Radiology', kw: ['radiograph', 'radiology', 'radiolog', 'dental radiography', 'oral radiology', 'radiographic pathology', 'sectional anatomy for imaging'] },
    { name: 'Periodontics', kw: ['periodontics', 'periodontology', 'periodontal', 'carranza', 'clinical periodontology', 'foundations of periodontics'] },
    { name: 'Prosthodontics & Implants', kw: ['prosthodontics', 'prosthetic', 'dentures', 'implant', 'fixed prosthodontics', 'removable partial', 'edentulous', 'mccracken'] },
    { name: 'Orthodontics & Endodontics', kw: ['orthodontics', 'endodontics', 'endodontology', 'pulp', 'contemporary orthodontics', 'an introduction to orthodontics'] },
    { name: 'Oral Pathology & Surgery', kw: ['oral pathology', 'oral and maxillofacial', 'oral medicine', 'color atlas of common oral', 'paediatric dentistry', 'pediatric dentistry'] },
    { name: 'Dental Materials', kw: ['dental materials', 'dental technology', 'applied dental materials', 'introduction to dental materials', 'craig\'s restorative', 'phillips\''] },
    { name: 'Community & Public Health Dentistry', kw: ['dental public health', 'community oral', 'community dental', 'jong\'s community', 'essential dental public health', 'prevention'] },
    { name: 'Oral Anatomy & Histology', kw: ['oral histology', 'oral anatomy', 'anatomy of orofacial', 'ten cate\'s', 'dental morphology', 'illustrated dental embryology', 'woelfel\'s dental anatomy'] },
  ],
  Classics: [
    { name: 'Latin Language', kw: ['latin', 'wheelock', 'latin grammar', 'latin dictionary', 'latin primer', 'oxford latin', 'propedeutica al latino', 'latin stories', 'latina pro', 'learn to read latin', 'new latin grammar'] },
    { name: 'Greek Language', kw: ['greek grammar', 'greek language', 'attic greek', 'biblical greek', 'oxford grammar of classical greek', 'introduction to attic greek', 'ancient greek', 'greek-english lexicon'] },
    { name: 'Classical Literature & Texts', kw: ['odyssey', 'iliad', 'aeneis', 'metamorphoses', 'oedipus', 'medea', 'lysistrata', 'oresteia', 'antigone', 'theogony', 'poetics', 'republic', 'gorgias', 'satyricon', 'history of the peloponnesian'] },
    { name: 'Classical History & Culture', kw: ['rome', 'ancient greece', 'roman', 'greek world', 'augustan', 'greek religion', 'women\'s life in greece', 'classical mythology', 'beginnings of rome', 'lives of the caesars'] },
    { name: 'Classical Art & Archaeology', kw: ['greek art', 'classical art', 'roman sculpture', 'archaeology of ancient greece', 'archaeology of athens', 'archaic and classical', 'athenian red figure', 'athenian black figure'] },
    { name: 'Mythology', kw: ['mythology', 'myth', 'imaginary greece', 'classical mythology', 'uses of greek mythology', 'art and myth in ancient'] },
  ],
  Nutrition: [
    { name: 'General & Introductory Nutrition', kw: ['understanding nutrition', 'nutrition: concepts', 'nutrition: an applied', 'nutrition and you', 'science of nutrition', 'human nutrition', 'contemporary nutrition', 'essentials of human nutrition', 'nutrition:', 'introduction to nutrition', 'basic nutrition'] },
    { name: 'Sports & Exercise Nutrition', kw: ['sport nutrition', 'sports nutrition', 'exercise nutrition', 'clinical sports nutrition', 'sports and exercise', 'practical sports nutrition', 'advanced sports nutrition', 'nutrition for sport', 'nutrition for health, fitness'] },
    { name: 'Clinical Nutrition & Dietetics', kw: ['clinical', 'medical nutrition', 'nutrition therapy', 'klinická', 'diet therapy', 'krause', 'dietetic', 'manual of dietetic', 'counselling skills for dietitians'] },
    { name: 'Community & Public Health Nutrition', kw: ['community nutrition', 'public health nutrition', 'nutritional epidemiology', 'practical public health', 'základy výživy a výživová politika'] },
    { name: 'Food Science & Technology', kw: ['food science', 'food technology', 'food processing', 'food chemistry', 'food microbiology', 'food: the chemistry', 'understanding food'] },
    { name: 'Nutrition Through the Life Cycle', kw: ['nutrition through the life cycle', 'lifespan', 'pediatric', 'clinical paediatric', 'infant', 'maternal', 'adolescent nutrition', 'nutrition for healthy living'] },
    { name: 'Metabolism & Biochemistry', kw: ['metabolism', 'metabolic', 'biochemistry of nutrition', 'advanced nutrition and human metabolism', 'principles of nutritional assessment', 'nutritional assessment', 'molecular nutrition'] },
  ],
  'Veterinary Medicine': [
    { name: 'Veterinary Technology', kw: ['veterinary technician', 'veterinary assisting', 'veterinary nurses', 'mccurnin', 'mosby\'s comprehensive review for veterinary', 'clinical textbook for veterinary', 'veterinary instruments', 'laboratory procedures for veterinary'] },
    { name: 'Anatomy & Physiology', kw: ['veterinary anatomy', 'clinical anatomy and physiology', 'textbook of veterinary anatomy', 'anatomy and physiology of farm', 'physiology of domestic', 'animal anatomy', 'histology', 'guide to the dissection'] },
    { name: 'Internal Medicine & Diagnostics', kw: ['internal medicine', 'small animal internal medicine', 'large animal internal medicine', 'equine internal medicine', 'textbook of veterinary internal', 'merck veterinary manual', 'clinical biochemistry', 'veterinary epidemiology'] },
    { name: 'Surgery & Anesthesia', kw: ['surgery', 'surgical', 'anesthesia', 'equine surgery', 'small animal surgery', 'farm animal surgery'] },
    { name: 'Pathology & Microbiology', kw: ['pathology', 'veterinary pathology', 'pathologic basis', 'microbiology', 'virology', 'parasitology', 'veterinary microbiology', 'immunology'] },
    { name: 'Reproduction & Obstetrics', kw: ['reproduction', 'theriogenology', 'reproductive technologies', 'canine and feline theriogenology', 'veterinary reproduction', 'reproductive technologies in farm'] },
    { name: 'Pharmacology & Toxicology', kw: ['pharmacology', 'veterinary pharmacology', 'drug', 'toxicology', 'plumb\'s'] },
    { name: 'Species-Specific Medicine', kw: ['equine', 'canine', 'feline', 'swine', 'poultry', 'fish', 'bovine', 'diseases of swine', 'choroby hovädzieho', 'diseases of cattle'] },
  ],
  Writing: [
    { name: 'Academic Writing & Research', kw: ['research', 'academic writing', 'writing for social scientists', 'dissertat', 'thesis', 'diplomov', 'jak napsat', 'pedagogický výzkum', 'research design', 'qualitative research'] },
    { name: 'Composition & Rhetoric', kw: ['rhetoric', 'argument', 'composition', 'handbook', 'writer\'s reference', 'pocket style', 'rules for writers', 'they say', 'norton field guide', 'patterns for college writing', 'norton sampler', 'bedford handbook', 'allyn and bacon', 'harbrace', 'st. martin\'s'] },
    { name: 'Creative Writing', kw: ['creative writing', 'fiction', 'screenwriting', 'screenplay', 'story:', 'on writing', 'writing book: a practical', 'passion for narrative', 'writing experiment', 'art of creative', 'habits of the creative'] },
    { name: 'Technical Communication', kw: ['technical communication', 'technical writing', 'writing in the technical', 'practical strategies for technical'] },
    { name: 'Literary Reading & Literature', kw: ['literature', 'norton introduction to literature', 'portable literature', 'signs of life in the usa', 'acting out culture', 'from inquiry to academic'] },
  ],
  Japanese: [
    { name: 'Language Learning Textbooks', kw: ['genki', 'yookoso', 'tobira', 'integrated course', 'nakama', 'japanese for everyone', 'an integrated approach', 'learn japanese', 'nihongo', 'colloquial japanese', 'continuing with contemporary japanese'] },
    { name: 'Grammar & Linguistics', kw: ['grammar', 'grammatica', 'bunpō', 'dictionary of basic japanese grammar', 'reference grammar of japanese', 'a dictionary of intermediate', 'structure of the japanese language', 'all about particles', 'japanese verbs', 'japanese sentence patterns'] },
    { name: 'Kanji & Writing', kw: ['kanji', 'characters', 'japanese characters', 'guide to remembering', 'basic kanji book', 'intermediate kanji book', 'reading and writing japanese', 'power up your kanji', 'kodansha kanji'] },
    { name: 'Culture & Society', kw: ['japanese society', 'japanese culture', 'japanese mind', 'introduction to japanese society', 'understanding japanese society', 'images of japanese society', 'japanese today', 'communicating with the japanese', 'sociology of work in japan', 'japanese economy'] },
    { name: 'History & Literature', kw: ['history of japan', 'modern history of japan', 'modern japan', 'literature', 'dawn to the west', 'embracing defeat', 'kitchen', 'in praise of shadows', 'anime'] },
  ],
  Journalism: [
    { name: 'News Writing & Reporting', kw: ['inside reporting', 'journalism: principles', 'universal journalist', 'writing and reporting news', 'writing for journalists', 'reporting', 'elements of journalism', 'journalism:', 'news writing', 'news reporting'] },
    { name: 'Broadcast Journalism', kw: ['broadcast', 'radio', 'television', 'tv news', 'broadcast journalism', 'news handbook'] },
    { name: 'Online & Digital Journalism', kw: ['digital journalism', 'online journalism', 'multimedia journalism', 'online news', 'data journalism', 'journalism next', 'online newsgathering'] },
    { name: 'Photojournalism & Visual', kw: ['photojournalism', 'photo', 'videojournalism', 'video journalism'] },
    { name: 'Ethics & Law', kw: ['ethics', 'law for journalists', 'journalism ethics', 'ethical journalist'] },
    { name: 'Feature Writing & Specializations', kw: ['feature writing', 'feature articles', 'investigative journalism', 'sports journalism', 'magazine', 'war correspondent', 'new journalism'] },
    { name: 'Media & Industry', kw: ['media industry', 'manufacturing consent', 'power without responsibility', 'news and journalism', 'journalism: a critical history', 'convergence culture'] },
  ],
  'Library Science': [
    { name: 'Reference & Information Services', kw: ['reference', 'information services', 'reference and information', 'introduction to reference', 'information services today'] },
    { name: 'Cataloging & Classification', kw: ['cataloging', 'classification', 'metadata', 'organizing knowledge', 'organizing information', 'marc', 'frbr', 'introduction to cataloging'] },
    { name: 'Collection Development', kw: ['collection development', 'collection management', 'crash course in collection', 'fundamentals of collection'] },
    { name: 'Archives & Records Management', kw: ['archives', 'archival', 'manuscripts', 'records management', 'arranging and describing', 'developing and maintaining', 'managing archival'] },
    { name: 'Information Retrieval', kw: ['information retrieval', 'indexing', 'abstracting', 'introduction to modern information retrieval', 'introduction to information retrieval', 'text information retrieval'] },
    { name: 'Digital Libraries & Curation', kw: ['digital libraries', 'digital curation', 'digital asset management', 'how to build a digital library', 'metadata for digital'] },
    { name: 'Library Management', kw: ['management', 'library management', 'foundations of library', 'management basics for information', 'strategic planning', 'library media'] },
    { name: 'Information Literacy & Services', kw: ['information literacy', 'information seeking', 'looking for information', 'extreme searcher', 'librarian\'s guide', 'college student\'s research'] },
  ],
  'English as a Second Language': [
    { name: 'Grammar', kw: ['grammar in use', 'english grammar in use', 'grammar', 'english grammar', 'practical english grammar', 'fundamentals of english grammar', 'basic english grammar', 'grammar and vocabulary', 'oxford grammar', 'how english works', 'cambridge grammar of english'] },
    { name: 'Vocabulary', kw: ['vocabulary in use', 'vocabulary', 'english vocabulary', 'academic vocabulary', 'business vocabulary', 'word skills', 'collocations in use'] },
    { name: 'Pronunciation & Phonetics', kw: ['pronunciation', 'phonetics', 'phonology', 'phonetic', 'sound foundations', 'longman pronunciation', 'english pronunciation', 'better english pronunciation', 'ship or sheep'] },
    { name: 'Academic English & Writing', kw: ['academic', 'eap', 'ielts', 'academic writing', 'oxford eap', 'cambridge academic english', 'academic lecture', 'academic vocabulary in use', 'writing academic english'] },
    { name: 'Language Teaching Methods', kw: ['teaching', 'language teaching', 'course in language teaching', 'learning teaching', 'teaching by principles', 'practice of english language teaching', 'how languages are learned', 'principles of language learning'] },
    { name: 'Business & Professional English', kw: ['business english', 'business vocabulary', 'professional english', 'english for business', 'english for presentations', 'business grammar', 'telephone english'] },
    { name: 'Medical & Specialized English', kw: ['english in medicine', 'english for nurses', 'english for medical', 'nursing', 'english for health', 'medical english', 'oxford english for information technology'] },
  ],
  Chinese: [
    { name: 'Language Learning Textbooks', kw: ['integrated chinese', 'new practical chinese', 'chinese in steps', 'ni hao', 'chinese made easy', 'discover china', 'mastering chinese', 'mandarin chinese', 'learn chinese', 'chinese odyssey', 'chinese link', 'practical chinese reader'] },
    { name: 'Grammar & Linguistics', kw: ['grammar', 'grammatica', 'modern mandarin chinese grammar', 'a practical chinese grammar', 'chinese language:', 'grammar of spoken chinese', 'outline of classical chinese grammar', 'modern chinese: history and sociolinguistics', 'discourse analysis', 'chinese language: fact and fantasy'] },
    { name: 'Culture & Society', kw: ['chinese culture', 'culture shock! china', 'china in the 21st century', 'understanding contemporary china', 'china:', 'understanding china', 'social connections in china', 'chinese economy', 'religion and chinese society', 'in the red'] },
    { name: 'History & Literature', kw: ['history of china', 'cambridge illustrated history of china', 'search for modern china', 'history of modern chinese fiction', 'chinese literature', 'anthology of chinese literature', 'literature of china', 'story of the stone', 'love in a fallen city'] },
    { name: 'Translation Studies', kw: ['translation', 'in other words', 'textbook of translation', 'thinking chinese translation', 'translation studies', 'about translation', 'theory and practice of translation', 'translingual practice', 'introducing translation studies'] },
    { name: 'Chinese Medicine', kw: ['chinese medicine', 'chinese herbal medicine', 'acupuncture', 'manual of acupuncture', 'foundations of chinese medicine', 'practice of chinese medicine'] },
  ],
  Dance: [
    { name: 'Ballet', kw: ['ballet', 'classical ballet', 'ballet companion', 'basic principles of classical ballet', 'ballet and modern dance'] },
    { name: 'Modern & Contemporary Dance', kw: ['modern dance', 'contemporary dance', 'choreograph', 'contemporary choreography', 'postmodern dance', 'terpsichore', 'dancer prepares', 'introduction to modern dance'] },
    { name: 'Jazz, Tap & Social Dance', kw: ['jazz dance', 'tap', 'folk', 'social dance', 'jazz:', 'jumping into jazz', 'aerobik', 'dance a while'] },
    { name: 'Improvisation', kw: ['improvisation', 'improvis', 'moment of movement', 'contact improvisation', 'choreography: a basic approach using improvisation'] },
    { name: 'Dance Education', kw: ['dance education', 'teaching dance', 'learning about dance', 'dance as education', 'creative dance', 'appreciating dance', 'partnering dance and education'] },
    { name: 'Dance Science & Anatomy', kw: ['dance anatomy', 'dance kinesiology', 'conditioning for dance', 'dynamic alignment', 'dance technique and injury', 'anatomy, dance technique', 'bodystories', 'dance kinesiology'] },
    { name: 'Dance History & Theory', kw: ['dance history', 'dance theory', 'dance studies', 'moving history', 'rethinking dance history', 'history of dance', 'no fixed points', 'meaning in motion', 'what is dance'] },
    { name: 'Choreography & Composition', kw: ['choreography', 'composition', 'intimate act of choreography', 'a choreographer\'s handbook', 'dance composition', 'art of making dances'] },
  ],
  'Culinary Arts': [
    { name: 'Cooking Fundamentals', kw: ['on cooking', 'professional cooking', 'culinary fundamentals', 'practical cookery', 'textbook of culinary', 'classical cooking', 'international cooking', 'practical professional cookery'] },
    { name: 'Baking & Pastry', kw: ['baking', 'pastry', 'bread', 'cake', 'chocolat', 'on baking', 'professional baking', 'professional pastry', 'advanced bread', 'how baking works'] },
    { name: 'Wine, Beer & Beverages', kw: ['wine', 'beer', 'spirits', 'brewing', 'viticulture', 'world atlas of wine', 'oxford companion to wine', 'wine bible', 'wine tasting', 'raw materials and brewhouse'] },
    { name: 'Food Science & Nutrition', kw: ['food science', 'food and cooking', 'on food and cooking', 'science of cooking', 'molecular gastronomy', 'food microbiology', 'understanding food', 'nutrition for foodservice', 'introductory foods'] },
    { name: 'Food Service Management', kw: ['foodservice', 'food service', 'menu planning', 'beverage management', 'restaurant', 'food and beverage', 'dining room', 'food for fifty', 'purchasing', 'profitable menu', 'fundamentals of menu'] },
    { name: 'Culinary Math & Costing', kw: ['culinary math', 'math principles for food', 'food costing', 'book of yields', 'culinary calculations', 'principles of food, beverage, and labor cost'] },
  ],
  Transportation: [
    { name: 'Aviation', kw: ['pilot', 'flight', 'aviation', 'aircraft', 'airframe', 'instrument rating', 'air traffic', 'air transportation', 'commercial pilot', 'private pilot', 'helicopter', 'airline', 'airport', 'aviation maintenance'] },
    { name: 'Urban & Public Transit', kw: ['urban transportation', 'urban transit', 'public transport', 'city transportation', 'transportation and urban form', 'geography of urban transportation'] },
    { name: 'Transport Economics & Policy', kw: ['transport economics', 'transportation economics', 'applied transport economics', 'principles of transport', 'concepts of transportation economics', 'modelling transport'] },
    { name: 'Logistics & Freight', kw: ['logistics', 'freight', 'intermodal', 'kombinovaná', 'intermodal freight', 'intermodal transport', 'airport systems', 'air cargo'] },
    { name: 'Maritime Transport', kw: ['maritime', 'seamanship', 'tanker', 'námořní', 'navigator', 'marine', 'seafaring', 'ship', 'collision avoidance'] },
    { name: 'Traffic Safety & Road Transport', kw: ['traffic safety', 'road', 'truck', 'tractor-trailer', 'driver', 'traffic', 'silniční'] },
  ],
  'Women\'s Studies': [
    { name: 'Feminist Theory', kw: ['feminist theory', 'feminism', 'gender trouble', 'feminist thought', 'feminine mystique', 'second sex', 'dialectic of sex', 'vindication of the rights', 'a cyborg manifesto', 'simians, cyborgs', 'feminist methods'] },
    { name: 'Gender & Sexuality', kw: ['gender', 'sexuality', 'queer', 'transgender', 'doing gender', 'undoing gender', 'night to his day', 'masculinities', 'bodies that matter', 'performative acts', 'epistemology of the closet', 'queer theory'] },
    { name: 'Race, Class & Intersectionality', kw: ['intersectionality', 'race', 'black feminist', 'ain\'t i a woman', 'sister outsider', 'black feminist thought', 'mapping the margins', 'women, race and class', 'white privilege', 'age, race, class'] },
    { name: 'Body, Media & Culture', kw: ['body', 'beauty', 'beauty myth', 'media', 'unbearable weight', 'female chauvinist pigs', 'living dolls', 'visual pleasure', 'gender and the media', 'postfeminist'] },
    { name: 'Global & Postcolonial Feminism', kw: ['postcolonial', 'third world', 'global woman', 'under western eyes', 'decolonizing', 'dislocating cultures', 'feminism without borders', 'bananas, beaches', 'borderlands', 'can the subaltern speak'] },
    { name: 'Sexuality & Queer Theory', kw: ['compulsory heterosexuality', 'thinking sex', 'history of sexuality', 'traffic in women', 'queer theory', 'female masculinity', 'dude, you\'re a fag', 'terrorist assemblages'] },
  ],
  Cosmetology: [
    { name: 'Cosmetology Fundamentals', kw: ['standard cosmetology', 'milady', 'cosmetology', 'salon fundamentals', 'standard textbook', 'master educator', 'standard foundations', 'milady standard'] },
    { name: 'Esthetics & Skin Care', kw: ['esthetics', 'skin care', 'dermatology', 'cosmetic dermatology', 'standard esthetics', 'estheticians', 'cosmetic science', 'cosmetic formulation', 'cosmetics ingredients', 'aesthetic medicine'] },
    { name: 'Reflexology & Massage', kw: ['reflexology', 'massage', 'spa', 'spa bodywork', 'natural spa', 'reflexology for', 'clinical reflexology'] },
    { name: 'Hair & Makeup', kw: ['makeup', 'make-up', 'hair', 'long hair', 'wig', 'stage makeup', 'bridal hair', 'drawing fashion', 'salon professional'] },
    { name: 'Salon Business & Management', kw: ['salon management', 'salon business', 'business management for hairdressers', 'spa business', 'ultimate salon management', 'beauty therapy'] },
  ],
  'Sign Language': [
    { name: 'ASL Language Learning', kw: ['signing naturally', 'learning american sign language', 'basic course in american sign language', 'master asl', 'a basic course', 'asl at work', 'vista american sign language', 'joy of signing', 'american sign language handshape', 'american sign language dictionary'] },
    { name: 'Deaf Culture & Studies', kw: ['deaf culture', 'deaf community', 'deaf in america', 'deafhood', 'inside deaf culture', 'deaf again', 'train go sorry', 'deaf like me', 'seeing voices', 'when the mind hears', 'deaf world', 'deaf heritage', 'for hearing people only', 'journey into the deaf'] },
    { name: 'Interpreting', kw: ['interpreting', 'interpreter', 'interpretation', 'conference interpreting', 'court interpreting', 'community interpreting', 'dialogue interpreting', 'simultaneous interpreting', 'sign language interpreting', 'medical interpreting'] },
    { name: 'Linguistics of Sign Language', kw: ['linguistics of american sign language', 'linguistic', 'structure of sign', 'grammar of sign', 'australian sign language', 'british sign language'] },
  ],
  'Atmospheric Sciences': [
    { name: 'Meteorology & Weather', kw: ['meteorology', 'weather', 'synoptic', 'mesoscale', 'essentials of meteorology', 'meteorology today', 'introduction to dynamic meteorology', 'dynamic meteorology', 'mid-latitude', 'severe and hazardous weather', 'world of weather'] },
    { name: 'Climatology & Climate Change', kw: ['climatology', 'climate', 'global warming', 'climate change', 'earth\'s climate', 'global physical climatology', 'paleoclimatology', 'extreme weather and climate', 'introduction to modern climate'] },
    { name: 'Atmospheric Physics & Thermodynamics', kw: ['atmospheric physics', 'atmospheric thermodynamics', 'atmospheric radiation', 'thermodynamics of atmospheres', 'first course in atmospheric', 'physics of climate', 'fundamentals of atmospheric'] },
    { name: 'Atmospheric Chemistry', kw: ['atmospheric chemistry', 'air pollution', 'chemistry of clouds', 'atmospheric chemistry and physics', 'introduction to atmospheric chemistry', 'basic physical chemistry for the atmospheric'] },
    { name: 'Cloud Physics & Dynamics', kw: ['cloud', 'precipitation', 'microphysics', 'cloud dynamics', 'physics of clouds', 'short course in cloud physics'] },
    { name: 'Fluid Dynamics & Boundary Layer', kw: ['fluid dynamics', 'boundary layer', 'geophysical fluid dynamics', 'atmospheric boundary layer', 'ocean dynamics', 'dynamics of atmospheric', 'circulating atmospheres'] },
    { name: 'Remote Sensing & Radar', kw: ['remote sensing', 'radar', 'doppler', 'polarimetric', 'satellite'] },
  ],
  Arabic: [
    { name: 'Language Learning Textbooks', kw: ['al-kitaab', 'alif baa', 'mastering arabic', 'ahlan wa sahlan', 'standard arabic', 'elementary modern standard arabic', 'arabic for life', 'arabic:', 'arabiyyat al-naas', 'gateway to arabic', 'easy arabic', 'mastering arabic 1', 'mastering arabic 2'] },
    { name: 'Grammar & Language Reference', kw: ['grammar', 'grammatica', 'reference grammar', 'modern written arabic', 'new arabic grammar', 'phonology and morphology of arabic', 'student grammar of modern standard arabic', 'arabic verbs', 'arabic grammar'] },
    { name: 'Arabic Literature', kw: ['arabic literature', 'arabic stories', 'modern arabic', 'modern arabic short stories', 'modern arabic literature', 'history of arabic', 'classical arabic', 'arabic literary heritage', 'early arabic poetry'] },
    { name: 'Culture & Society', kw: ['arab world', 'arabic language and national', 'history of the arab', 'arab nationalism', 'islamic history', 'history of islamic societies', 'islam:', 'beyond the veil', 'women and the family in the middle east'] },
    { name: 'Media & Business Arabic', kw: ['media arabic', 'business arabic', 'advanced media arabic', 'media arabic: an essential vocabulary'] },
  ],
  Hebrew: [
    { name: 'Biblical Hebrew Grammar', kw: ['basics of biblical hebrew', 'biblical hebrew', 'introduction to biblical hebrew', 'grammar of biblical hebrew', 'grammar for biblical hebrew', 'biblical hebrew: an introductory', 'introducing biblical hebrew', 'a biblical hebrew reference grammar', 'grammar', 'gesenius', 'hebrew grammar'] },
    { name: 'Hebrew Lexicons & Dictionaries', kw: ['lexicon', 'dictionary', 'concordance', 'vocabulary guide to biblical hebrew', 'student\'s vocabulary', 'reader\'s hebrew-english', 'hebrew-english lexicon', 'concise dictionary', 'theological dictionary', 'lexical aids'] },
    { name: 'Textual Criticism & Manuscripts', kw: ['textual criticism', 'bhs', 'biblia hebraica', 'text of the old testament', 'textual criticism of the hebrew bible', 'masorah'] },
    { name: 'Modern Hebrew', kw: ['modern hebrew', 'reference grammar of modern hebrew', 'grammar of modern hebrew', 'modern hebrew for beginners', 'modern hebrew: an essential grammar', 'encounters in modern hebrew'] },
    { name: 'Biblical Studies & Exegesis', kw: ['exegesis', 'from exegesis', 'old testament exegesis', 'art of biblical narrative', 'workbook for intermediate hebrew', 'how biblical languages work', 'biblical words and their meaning', 'learning biblical hebrew'] },
  ],
  'Military Science': [
    { name: 'Leadership', kw: ['leadership', 'leader', 'on becoming a leader', 'on leadership', 'developing adaptive leaders', 'geeks and geezers', 'discover your true north', 'triple crown leadership', 'primal leadership', 'research findings, practice', 'theory and practice'] },
    { name: 'Military Ethics & Just War', kw: ['just and unjust wars', 'ethical issues in', 'ethics', 'moral argument', 'unjust wars'] },
    { name: 'Military Strategy & History', kw: ['war', 'strategic', 'bombing to win', 'naval officer', 'military history', 'strategy'] },
    { name: 'Organizational Management', kw: ['leading change', 'organizational', 'management', 'good to great', 'five dysfunctions', 'organizational culture'] },
  ],
  'Fitness and Leisure': [
    { name: 'Exercise Physiology', kw: ['exercise physiology', 'physiology of sport', 'physiology of exercise', 'exercise and sport', 'essentials of exercise physiology'] },
    { name: 'Biomechanics', kw: ['biomechanics', 'sport biomechanics', 'biomechanical', 'sports biomechanics', 'kinesiology'] },
    { name: 'Sports Coaching & Management', kw: ['coaching', 'sports coaching', 'sport management', 'sport psychology', 'sports psychology', 'coaching science', 'principles of coaching'] },
    { name: 'Strength & Conditioning', kw: ['strength training', 'conditioning', 'strength and conditioning', 'resistance training', 'weight training', 'nsca', 'essentials of strength'] },
    { name: 'Motor Learning & Control', kw: ['motor learning', 'motor control', 'motor behavior', 'motor development', 'movement control'] },
    { name: 'Physical Education & Recreation', kw: ['physical education', 'recreation', 'health and physical', 'foundations of sport', 'adapted physical', 'introduction to kinesiology'] },
    { name: 'Anatomy & Injury Prevention', kw: ['anatomy', 'injury prevention', 'sports medicine', 'athletic training', 'prevention and care', 'trail guide'] },
  ],
};

// Group field → discipline
const fieldToGroup = {};
for (const [group, fields] of Object.entries(DISCIPLINE_GROUPS)) {
  for (const f of fields) fieldToGroup[f] = group;
}

function matchSubfields(title, fieldName) {
  const defs = SUBFIELD_DEFS[fieldName];
  if (!defs) return [];
  const lower = title.toLowerCase();
  const matched = [];
  for (const def of defs) {
    for (const kw of def.kw) {
      if (kw && lower.includes(kw.toLowerCase())) {
        matched.push(def.name);
        break;
      }
    }
  }
  // Fallback: unmatched titles go to General & Introductory
  if (matched.length === 0) {
    matched.push('General & Introductory');
  }
  return matched;
}

// Build the constants
const fields = raw.fields.map(f => ({ id: f.id, name: f.name, syllabi: f.syllabi, group: fieldToGroup[f.name] || 'Other' }));
fields.sort((a, b) => b.syllabi - a.syllabi);

const titlesByField = {};
const subfieldsByField = {};

for (const f of fields) {
  const rawTitles = raw.byField[f.name] || [];
  const titles = rawTitles.map((t, i) => {
    const subs = matchSubfields(t.title, f.name);
    return {
      rank: t.rank || (i + 1),
      title: t.title,
      authors: t.authors || '',
      score: t.score || 0,
      appearances: t.appearances || 0,
      year: t.year || null,
      subfields: subs,
    };
  });
  titlesByField[f.name] = titles;

  // Build subfield index: subfield name → title indices
  const sfMap = {};
  if (SUBFIELD_DEFS[f.name]) {
    for (const def of SUBFIELD_DEFS[f.name]) sfMap[def.name] = [];
    // Also ensure General & Introductory exists in the map
    if (!sfMap['General & Introductory']) sfMap['General & Introductory'] = [];
  }
  for (let i = 0; i < titles.length; i++) {
    for (const sf of titles[i].subfields) {
      if (!sfMap[sf]) sfMap[sf] = [];
      sfMap[sf].push(i);
    }
  }
  // Remove empty subfields
  for (const key of Object.keys(sfMap)) {
    if (sfMap[key].length === 0) delete sfMap[key];
  }
  subfieldsByField[f.name] = sfMap;
}

const globalTop = raw.globalTop100 || [];

// Build subfield names list per field (only non-empty ones)
const subfieldNamesObj = {};
for (const [fieldName, sfMap] of Object.entries(subfieldsByField)) {
  const defs = SUBFIELD_DEFS[fieldName];
  if (defs) {
    // Preserve original order from SUBFIELD_DEFS, then add General if present
    const ordered = defs.map(d => d.name).filter(n => sfMap[n] && sfMap[n].length > 0);
    if (sfMap['General & Introductory'] && sfMap['General & Introductory'].length > 0 && !ordered.includes('General & Introductory')) {
      ordered.push('General & Introductory');
    }
    subfieldNamesObj[fieldName] = ordered;
  }
}

const out = `// Auto-generated by scripts/generate-osp-data.mjs — do not edit
// Crawled: ${raw.crawledAt}
// ${raw.meta.totalSyllabi.toLocaleString()} total syllabi · ${raw.meta.totalTitles.toLocaleString()} total titles · ${fields.length} fields

export const OSP_CRAWL_DATE = ${JSON.stringify(raw.crawledAt)};
export const OSP_META = ${JSON.stringify(raw.meta)};
export const OSP_FIELDS = ${JSON.stringify(fields)};
export const OSP_TITLES_BY_FIELD = ${JSON.stringify(titlesByField)};
export const OSP_SUBFIELDS_BY_FIELD = ${JSON.stringify(subfieldsByField)};
export const OSP_GLOBAL_TOP = ${JSON.stringify(globalTop)};

export const OSP_DISCIPLINE_GROUPS = ${JSON.stringify(DISCIPLINE_GROUPS)};

export const OSP_SUBFIELD_NAMES = ${JSON.stringify(subfieldNamesObj)};
`;

writeFileSync(join(__dirname, '..', 'src', 'constants', 'ospData.js'), out, 'utf8');
console.log('Generated src/constants/ospData.js');
console.log('Fields:', fields.length);
console.log('Fields with subfields:', Object.keys(SUBFIELD_DEFS).length);

// Coverage stats
let totalTitles = 0;
let subfieldMatched = 0;
let generalCount = 0;
for (const f of fields) {
  const titles = titlesByField[f.name];
  totalTitles += titles.length;
  const matched = titles.filter(t => t.subfields.length > 0 && !(t.subfields.length === 1 && t.subfields[0] === 'General & Introductory'));
  const genOnly = titles.filter(t => t.subfields.length === 1 && t.subfields[0] === 'General & Introductory');
  subfieldMatched += matched.length;
  generalCount += genOnly.length;
}
console.log(`Total titles: ${totalTitles}`);
console.log(`Matched to specific subfield: ${subfieldMatched} (${Math.round(subfieldMatched/totalTitles*100)}%)`);
console.log(`General & Introductory fallback: ${generalCount} (${Math.round(generalCount/totalTitles*100)}%)`);
console.log(`Total with some subfield: ${totalTitles} (100% — every title is categorized)`);
