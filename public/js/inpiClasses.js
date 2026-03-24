const INPI_CLASSES = [
    // PRODUTOS (1-34)
    {
        id: 1,
        type: 'Produto',
        description: 'Produtos químicos destinados à indústria, às ciências, à fotografia, assim como à agricultura, à horticultura e à silvicultura; resinas artificiais não processadas, matérias plásticas não processadas; composições para extinção de incêndios e prevenção de incêndios; preparações para têmpera e soldadura de metais; substâncias para curtir couro e peles de animais; adesivos destinados à indústria; massas e outras substâncias de preenchimento; composto, preparações biológicas para uso industrial e científico.'
    },
    {
        id: 2,
        type: 'Produto',
        description: 'Tintas, vernizes, lacas; preservativos contra a oxidação e contra a deterioração da madeira; matérias tintoriais, tinturas; tintas para impressão, marcação e gravação; resinas naturais em estado bruto; metais em folhas e em pó para uso em pintura, decoração, impressão e arte.'
    },
    {
        id: 3,
        type: 'Produto',
        description: 'Cosméticos e produtos de toalete não medicinais; dentifrícios não medicinais; perfumaria, óleos essenciais; preparações para branquear e outras substâncias para uso em lavanderia; produtos para limpar, polir, decapar e arear.'
    },
    {
        id: 4,
        type: 'Produto',
        description: 'Óleos e gorduras industriais, ceras; lubrificantes; produtos para absorver, molhar e ligar pó; combustíveis e materiais para iluminação; velas e pavios para iluminação.'
    },
    {
        id: 5,
        type: 'Produto',
        description: 'Produtos farmacêuticos, medicinais e veterinários; produtos higiênicos para uso medicinal; alimentos e substâncias dietéticas adaptados para uso medicinal ou veterinário, alimentos para bebês; suplementos alimentares para seres humanos e animais; emplastros, materiais para curativos; material para obturações dentárias, cera dentária; desinfetantes; produtos para eliminar animais nocivos; fungicidas, herbicidas.'
    },
    {
        id: 6,
        type: 'Produto',
        description: 'Metais comuns e suas ligas, minérios; materiais de construção metálicos; construções transportáveis metálicas; cabos e fios não elétricos de metais comuns; pequenos artigos de ferragem metálicos; recipientes metálicos para armazenamento ou transporte; cofres.'
    },
    {
        id: 7,
        type: 'Produto',
        description: 'Máquinas, máquinas-ferramentas, ferramentas mecânicas; motores, exceto para veículos terrestres; engates de máquinas e componentes de transmissão, exceto para veículos terrestres; instrumentos agrícolas, exceto ferramentas manuais impulsionadas manualmente; chocadeiras para ovos; máquinas automáticas de venda.'
    },
    {
        id: 8,
        type: 'Produto',
        description: 'Ferramentas e instrumentos manuais, impulsionados manualmente; cutelaria; armas portáteis, exceto armas de fogo; aparelhos de barbear.'
    },
    {
        id: 9,
        type: 'Produto',
        description: 'Aparelhos e instrumentos científicos, de pesquisa, de navegação, geodésicos, fotográficos, cinematográficos, audiovisuais, ópticos, de pesagem, de medição, de sinalização, de detecção, de teste, de inspeção, de salvamento e de ensino; aparelhos e instrumentos para conduzir, interromper, transformar, acumular, regular ou controlar a distribuição ou o uso de eletricidade; aparelhos e instrumentos para gravação, transmissão, reprodução ou processamento de som, imagens ou dados; mídia gravada e baixável, software de computador, mídia digital ou analógica virgem de gravação e armazenamento; mecanismos para aparelhos acionados por moedas; caixas registradoras, dispositivos de cálculo; computadores e equipamentos periféricos de computadores; trajes de mergulho, máscaras de mergulho, tampões de ouvido para mergulhadores, clipes nasais para mergulhadores e nadadores, luvas de mergulho, aparelhos de respiração para nado subaquático; aparelhos de extinção de incêndio.'
    },
    {
        id: 10,
        type: 'Produto',
        description: 'Aparelhos e instrumentos cirúrgicos, médicos, odontológicos e veterinários; membros, olhos e dentes artificiais; artigos ortopédicos; material de sutura; dispositivos terapêuticos e de assistência adaptados para pessoas com deficiência; aparelhos de massagem; aparelhos, dispositivos e artigos para amamentação; aparelhos, dispositivos e artigos para atividades sexuais.'
    },
    {
        id: 11,
        type: 'Produto',
        description: 'Aparelhos e instalações para fins de iluminação, aquecimento, resfriamento, produção de vapor, cozimento, secagem, ventilação, fornecimento de água e sanitários.'
    },
    {
        id: 12,
        type: 'Produto',
        description: 'Veículos; aparelhos de locomoção por terra, por ar ou por água.'
    },
    {
        id: 13,
        type: 'Produto',
        description: 'Armas de fogo; munições e projéteis; explosivos; fogos de artifício.'
    },
    {
        id: 14,
        type: 'Produto',
        description: 'Metais preciosos e suas ligas; joias, bijuterias, pedras preciosas e semipreciosas; relojoaria e instrumentos cronométricos.'
    },
    {
        id: 15,
        type: 'Produto',
        description: 'Instrumentos musicais; estantes para partituras e suportes para instrumentos musicais; bastões para regência.'
    },
    {
        id: 16,
        type: 'Produto',
        description: 'Papel, papelão; material impresso; material para encadernação; fotografias; papelaria e material de escritório, exceto móveis; adesivos para papelaria ou uso doméstico; material para desenho e para artistas; pincéis; material de instrução e didático; folhas, filmes e bolsas de plástico para embrulho e embalagem; caracteres de imprensa, clichês.'
    },
    {
        id: 17,
        type: 'Produto',
        description: 'Borracha, guta-percha, goma, amianto, mica ou substitutos destes materiais, não processados ou semiprocessados; plásticos e resinas extrudados para uso na industrialização; materiais para calafetar, vedar e isolar; canos, tubos e mangueiras flexíveis, não metálicos.'
    },
    {
        id: 18,
        type: 'Produto',
        description: 'Couro e imitações de couro; peles de animais; malas e bolsas de transporte; guarda-chuvas e guarda-sóis; bengalas; chicotes, arreios e selaria; coleiras, guias e roupas para animais.'
    },
    {
        id: 19,
        type: 'Produto',
        description: 'Materiais de construção não metálicos; canos rígidos não metálicos para construção; asfalto, piche, alcatrão e betume; construções transportáveis não metálicas; monumentos não metálicos.'
    },
    {
        id: 20,
        type: 'Produto',
        description: 'Móveis, espelhos, molduras; contêineres não metálicos para armazenamento ou transporte; osso, chifre, barbatana de baleia ou madrepérola, não trabalhados ou semitrabalhados; conchas; espuma do mar; âmbar amarelo.'
    },
    {
        id: 21,
        type: 'Produto',
        description: 'Utensílios e recipientes para a casa ou cozinha; utensílios de cozinha e de mesa, exceto garfos, facas e colheres; pentes e esponjas; escovas, exceto pincéis; material para fabricação de escovas; material de limpeza; vidro em bruto ou semitrabalhado, exceto vidro para construção; artigos de vidro, porcelana e louça.'
    },
    {
        id: 22,
        type: 'Produto',
        description: 'Cordas e barbantes; redes; tendas e lonas; toldos de materiais têxteis ou sintéticos; velas para barcos; sacos para transporte e armazenagem de mercadorias a granel; materiais de acolchoamento e enchimento, exceto de papel, papelão, borracha ou plástico; matérias têxteis fibrosas em bruto e sucedâneos das mesmas.'
    },
    {
        id: 23,
        type: 'Produto',
        description: 'Fios e linhas para uso têxtil.'
    },
    {
        id: 24,
        type: 'Produto',
        description: 'Tecidos e sucedâneos de tecidos; roupa de cama, mesa e banho; cortinas de têxteis ou de matérias plásticas.'
    },
    {
        id: 25,
        type: 'Produto',
        description: 'Vestuário, calçados, chapelaria.'
    },
    {
        id: 26,
        type: 'Produto',
        description: 'Rendas, tranças e bordados, e fitas e laços de armarinho; botões, ganchos e ilhós, alfinetes e agulhas; flores artificiais; enfeites para o cabelo; cabelos falsos.'
    },
    {
        id: 27,
        type: 'Produto',
        description: 'Carpetes, tapetes, capachos e esteiras, linóleo e outros revestimentos de pisos; tapeçarias murais, não de material têxtil.'
    },
    {
        id: 28,
        type: 'Produto',
        description: 'Jogos, brinquedos; aparelhos de videogame; artigos de ginástica e esporte; decorações para árvores de Natal.'
    },
    {
        id: 29,
        type: 'Produto',
        description: 'Carne, peixe, aves e caça; extratos de carne; frutas, legumes e outras vegetais em conserva, congelados, secos e cozidos; geleias, doces, compotas; ovos; leite, queijo, manteiga, iogurte e outros laticínios; óleos e gorduras comestíveis.'
    },
    {
        id: 30,
        type: 'Produto',
        description: 'Café, chá, cacau e sucedâneos do café; arroz, massas alimentícias e macarrão; tapioca e sagu; farinhas e preparações feitas de cereais; pão, produtos de pastelaria e confeitaria; chocolate; sorvetes, sherbets e outros gelados comestíveis; açúcar, mel, xarope de melaço; levedura, fermento em pó; sal, temperos, especiarias, ervas em conserva; vinagre, molhos e outros condimentos; gelo (água congelada).'
    },
    {
        id: 31,
        type: 'Produto',
        description: 'Produtos agrícolas, aquícolas, hortícolas e florestais em estado bruto e não processados; grãos e sementes em estado bruto e não processados; frutas, legumes e outros vegetais frescos, ervas frescas; plantas e flores naturais; bulbos, mudas e sementes para plantio; animais vivos; alimentos e bebidas para animais; malte.'
    },
    {
        id: 32,
        type: 'Produto',
        description: 'Cervejas; bebidas não alcoólicas; águas minerais e gasosas; bebidas de fruta e sucos de fruta; xaropes e outras preparações não alcoólicas para fazer bebidas.'
    },
    {
        id: 33,
        type: 'Produto',
        description: 'Bebidas alcoólicas, exceto cervejas; preparações alcoólicas para fazer bebidas.'
    },
    {
        id: 34,
        type: 'Produto',
        description: 'Tabaco e sucedâneos de tabaco; cigarros e charutos; cigarros eletrônicos e vaporizadores orais para fumantes; artigos para fumantes; fósforos.'
    },

    // SERVIÇOS (35-45)
    {
        id: 35,
        type: 'Serviço',
        description: 'Propaganda; gestão de negócios comerciais; administração comercial; funções de escritório.'
    },
    {
        id: 36,
        type: 'Serviço',
        description: 'Serviços financeiros, monetários e bancários; serviços de seguros; serviços imobiliários.'
    },
    {
        id: 37,
        type: 'Serviço',
        description: 'Serviços de construção; serviços de instalação e reparo; extração de minérios, de petróleo e de gás.'
    },
    {
        id: 38,
        type: 'Serviço',
        description: 'Serviços de telecomunicações.'
    },
    {
        id: 39,
        type: 'Serviço',
        description: 'Transporte; embalagem e armazenagem de mercadorias; organização de viagens.'
    },
    {
        id: 40,
        type: 'Serviço',
        description: 'Tratamento de materiais; reciclagem de lixo e de resíduos; purificação do ar e tratamento de água; serviços de impressão; conservação de alimentos e bebidas.'
    },
    {
        id: 41,
        type: 'Serviço',
        description: 'Educação; provimento de treinamento; entretenimento; atividades desportivas e culturais.'
    },
    {
        id: 42,
        type: 'Serviço',
        description: 'Serviços científicos e tecnológicos, de pesquisa e desenho; serviços de análise industrial, pesquisa industrial e desenho industrial; controle de qualidade e serviços de autenticação; projeto e desenvolvimento de hardware e software de computador.'
    },
    {
        id: 43,
        type: 'Serviço',
        description: 'Serviços de fornecimento de comida e bebida; acomodação temporária.'
    },
    {
        id: 44,
        type: 'Serviço',
        description: 'Serviços médicos; serviços veterinários; cuidados de higiene e beleza para seres humanos ou animais; serviços de agricultura, aquicultura, horticultura e silvicultura.'
    },
    {
        id: 45,
        type: 'Serviço',
        description: 'Serviços jurídicos; serviços de segurança para a proteção física de bens materiais e pessoas; serviços de encontros, serviços de redes sociais online; serviços de funerária; babá de crianças.'
    }
];
