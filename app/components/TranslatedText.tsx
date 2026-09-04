"use client";

import { useEffect, useState } from "react";

const translations = {
  en: {
    howItWorks: "How it Works",
    businessEyebrow: "Built around your business",
businessTitle: "One place to move your business forward.",
businessDescription:
  "You don’t need to understand complex tools or connect disconnected systems. Start with one business brief and Buzypeezy coordinates what your business needs around the same clear direction.",

startStrong: "Start Strong",
startStrongDescription:
  "Turn an idea into a clear business direction.",

lookProfessional: "Look Professional",
lookProfessionalDescription:
  "Build a credible, consistent presence customers can trust.",

reachMore: "Reach More People",
reachMoreDescription:
  "Create the systems needed to attract the right customers.",

keepGrowing: "Keep Growing",
keepGrowingDescription:
  "Understand what is working and what Buzypeezy recommends next.",
    forBusiness: "For Business",
    pricing: "Pricing",
    about: "About",
    login: "Log in",
    findIdea: "Find a Business Idea",
    startBuilding: "Start Building",
    tagline: "Business, made easier",
    hero1: "Your business.",
    hero2: "Built intelligently.",
    description:
      "Tell Buzypeezy what you do and where you want to go. We'll turn it into a complete digital business system — ready to build, grow and improve.",
    seeHow: "Watch Demo",
  },

  es: {
    howItWorks: "Cómo funciona",
    businessEyebrow: "Diseñado alrededor de tu negocio",
businessTitle: "Un solo lugar para impulsar tu negocio.",
businessDescription:
  "No necesitas entender herramientas complejas ni conectar sistemas separados. Empieza con una breve descripción de tu negocio y Buzypeezy coordina lo que necesitas en torno a una misma dirección clara.",

startStrong: "Empieza con fuerza",
startStrongDescription:
  "Convierte una idea en una dirección empresarial clara.",

lookProfessional: "Proyecta una imagen profesional",
lookProfessionalDescription:
  "Crea una presencia creíble y coherente en la que tus clientes puedan confiar.",

reachMore: "Llega a más personas",
reachMoreDescription:
  "Crea los sistemas necesarios para atraer a los clientes adecuados.",

keepGrowing: "Sigue creciendo",
keepGrowingDescription:
  "Comprende qué está funcionando y qué recomienda Buzypeezy como siguiente paso.",
    forBusiness: "Para empresas",
    pricing: "Precios",
    about: "Acerca de",
    login: "Iniciar sesión",
    findIdea: "Encontrar una idea de negocio",
    startBuilding: "Empezar",
    tagline: "Negocios, más fáciles",
    hero1: "Tu negocio.",
    hero2: "Construido inteligentemente.",
    description:
      "Dile a Buzypeezy qué haces y adónde quieres llegar. Lo convertiremos en un sistema empresarial digital completo.",
    seeHow: "Ver cómo funciona",
  },

  fr: {
    howItWorks: "Comment ça marche",
    businessEyebrow: "Conçu autour de votre entreprise",
businessTitle: "Un seul endroit pour faire avancer votre entreprise.",
businessDescription:
  "Vous n’avez pas besoin de comprendre des outils complexes ni de connecter des systèmes séparés. Commencez par une brève description de votre entreprise et Buzypeezy coordonne ce dont vous avez besoin autour d’une même direction claire.",

startStrong: "Bien démarrer",
startStrongDescription:
  "Transformez une idée en une direction d’entreprise claire.",

lookProfessional: "Ayez une image professionnelle",
lookProfessionalDescription:
  "Créez une présence crédible et cohérente à laquelle vos clients peuvent faire confiance.",

reachMore: "Touchez plus de personnes",
reachMoreDescription:
  "Créez les systèmes nécessaires pour attirer les bons clients.",

keepGrowing: "Continuez à grandir",
keepGrowingDescription:
  "Comprenez ce qui fonctionne et ce que Buzypeezy recommande ensuite.",
    forBusiness: "Pour les entreprises",
    pricing: "Tarifs",
    about: "À propos",
    login: "Se connecter",
    findIdea: "Trouver une idée d'entreprise",
    startBuilding: "Commencer",
    tagline: "L'entreprise, simplifiée",
    hero1: "Votre entreprise.",
    hero2: "Construite intelligemment.",
    description:
      "Dites à Buzypeezy ce que vous faites et où vous voulez aller. Nous le transformerons en un système d'entreprise numérique complet.",
    seeHow: "Voir comment ça marche",
  },

  de: {
    howItWorks: "So funktioniert es",
    businessEyebrow: "Rund um Ihr Unternehmen entwickelt",
businessTitle: "Ein Ort, um Ihr Unternehmen voranzubringen.",
businessDescription:
  "Sie müssen keine komplexen Tools verstehen oder getrennte Systeme verbinden. Beginnen Sie mit einer kurzen Beschreibung Ihres Unternehmens und Buzypeezy koordiniert alles entlang einer klaren gemeinsamen Richtung.",

startStrong: "Stark starten",
startStrongDescription:
  "Verwandeln Sie eine Idee in eine klare Geschäftsrichtung.",

lookProfessional: "Professionell auftreten",
lookProfessionalDescription:
  "Bauen Sie einen glaubwürdigen und einheitlichen Auftritt auf, dem Kunden vertrauen können.",

reachMore: "Mehr Menschen erreichen",
reachMoreDescription:
  "Erstellen Sie die Systeme, die nötig sind, um die richtigen Kunden zu gewinnen.",

keepGrowing: "Weiter wachsen",
keepGrowingDescription:
  "Verstehen Sie, was funktioniert und was Buzypeezy als Nächstes empfiehlt.",
    forBusiness: "Für Unternehmen",
    pricing: "Preise",
    about: "Über uns",
    login: "Anmelden",
    findIdea: "Geschäftsidee finden",
    startBuilding: "Jetzt starten",
    tagline: "Business, einfacher gemacht",
    hero1: "Ihr Unternehmen.",
    hero2: "Intelligent aufgebaut.",
    description:
      "Sagen Sie Buzypeezy, was Sie tun und wohin Sie möchten. Wir verwandeln es in ein vollständiges digitales Geschäftssystem.",
    seeHow: "So funktioniert es",
  },

  pt: {
    howItWorks: "Como funciona",
    businessEyebrow: "Criado em torno do seu negócio",
businessTitle: "Um só lugar para fazer seu negócio avançar.",
businessDescription:
  "Você não precisa entender ferramentas complexas nem conectar sistemas separados. Comece com uma breve descrição do seu negócio e a Buzypeezy coordena o que você precisa em torno de uma direção clara.",

startStrong: "Comece com força",
startStrongDescription:
  "Transforme uma ideia em uma direção de negócio clara.",

lookProfessional: "Tenha uma imagem profissional",
lookProfessionalDescription:
  "Crie uma presença confiável e consistente em que seus clientes possam confiar.",

reachMore: "Alcance mais pessoas",
reachMoreDescription:
  "Crie os sistemas necessários para atrair os clientes certos.",

keepGrowing: "Continue crescendo",
keepGrowingDescription:
  "Entenda o que está funcionando e o que a Buzypeezy recomenda a seguir.",
    forBusiness: "Para empresas",
    pricing: "Preços",
    about: "Sobre",
    login: "Entrar",
    findIdea: "Encontrar uma ideia de negócio",
    startBuilding: "Começar",
    tagline: "Negócios mais simples",
    hero1: "Seu negócio.",
    hero2: "Construído com inteligência.",
    description:
      "Conte à Buzypeezy o que você faz e onde quer chegar. Vamos transformar isso em um sistema empresarial digital completo.",
    seeHow: "Veja como funciona",
  },

  ar: {
    howItWorks: "كيف يعمل",
    businessEyebrow: "مصمم حول عملك",
businessTitle: "مكان واحد لدفع عملك إلى الأمام.",
businessDescription:
  "لست بحاجة إلى فهم أدوات معقدة أو ربط أنظمة منفصلة. ابدأ بوصف بسيط لعملك، وسيقوم Buzypeezy بتنسيق ما تحتاجه ضمن اتجاه واضح واحد.",

startStrong: "ابدأ بقوة",
startStrongDescription:
  "حوّل فكرتك إلى اتجاه عمل واضح.",

lookProfessional: "اظهر بصورة احترافية",
lookProfessionalDescription:
  "أنشئ حضورًا موثوقًا ومتناسقًا يمكن لعملائك الوثوق به.",

reachMore: "الوصول إلى المزيد من الأشخاص",
reachMoreDescription:
  "أنشئ الأنظمة اللازمة لجذب العملاء المناسبين.",

keepGrowing: "واصل النمو",
keepGrowingDescription:
  "اعرف ما الذي يعمل وما الذي يوصي به Buzypeezy كخطوة تالية.",
    forBusiness: "للأعمال",
    pricing: "الأسعار",
    about: "حول",
    login: "تسجيل الدخول",
    findIdea: "ابحث عن فكرة عمل",
    startBuilding: "ابدأ الآن",
    tagline: "الأعمال أصبحت أسهل",
    hero1: "عملك.",
    hero2: "مبني بذكاء.",
    description:
      "أخبر Buzypeezy بما تقوم به وإلى أين تريد الوصول، وسنحوّله إلى نظام أعمال رقمي متكامل.",
    seeHow: "شاهد العرض",
  },

  hi: {
    howItWorks: "यह कैसे काम करता है",
    businessEyebrow: "आपके व्यवसाय के अनुसार बनाया गया",
businessTitle: "आपके व्यवसाय को आगे बढ़ाने के लिए एक ही जगह।",
businessDescription:
  "आपको जटिल टूल समझने या अलग-अलग सिस्टम जोड़ने की जरूरत नहीं है। अपने व्यवसाय का एक छोटा सा विवरण दें और Buzypeezy आपकी जरूरतों को एक स्पष्ट दिशा में व्यवस्थित करेगा।",

startStrong: "मजबूत शुरुआत करें",
startStrongDescription:
  "एक विचार को स्पष्ट व्यवसाय दिशा में बदलें।",

lookProfessional: "प्रोफेशनल दिखें",
lookProfessionalDescription:
  "एक भरोसेमंद और एकसमान उपस्थिति बनाएं जिस पर ग्राहक विश्वास कर सकें।",

reachMore: "अधिक लोगों तक पहुँचें",
reachMoreDescription:
  "सही ग्राहकों को आकर्षित करने के लिए जरूरी सिस्टम बनाएं।",

keepGrowing: "लगातार बढ़ते रहें",
keepGrowingDescription:
  "समझें कि क्या काम कर रहा है और Buzypeezy आगे क्या करने की सलाह देता है।",
    forBusiness: "व्यवसाय के लिए",
    pricing: "मूल्य",
    about: "हमारे बारे में",
    login: "लॉग इन",
    findIdea: "बिज़नेस आइडिया खोजें",
    startBuilding: "शुरू करें",
    tagline: "व्यवसाय अब आसान",
    hero1: "आपका व्यवसाय।",
    hero2: "समझदारी से बनाया गया।",
    description:
      "Buzypeezy को बताएं कि आप क्या करते हैं और कहाँ पहुँचना चाहते हैं। हम इसे एक संपूर्ण डिजिटल बिज़नेस सिस्टम में बदल देंगे।",
    seeHow: "डेमो देखें",
  },

  ja: {
    howItWorks: "仕組み",
    businessEyebrow: "あなたのビジネスに合わせて設計",
businessTitle: "ビジネスを前進させるための一つの場所。",
businessDescription:
  "複雑なツールを理解したり、別々のシステムを接続したりする必要はありません。ビジネスの概要を伝えるだけで、Buzypeezy が必要なものを一つの明確な方向に整理します。",

startStrong: "力強くスタート",
startStrongDescription:
  "アイデアを明確なビジネスの方向性に変えます。",

lookProfessional: "プロフェッショナルに見せる",
lookProfessionalDescription:
  "顧客が信頼できる、一貫性のある信頼性の高い存在感を作ります。",

reachMore: "より多くの人に届ける",
reachMoreDescription:
  "適切な顧客を引きつけるために必要な仕組みを作ります。",

keepGrowing: "成長を続ける",
keepGrowingDescription:
  "何が機能しているかを把握し、Buzypeezy が次に何を勧めるか確認します。",
    forBusiness: "ビジネス向け",
    pricing: "料金",
    about: "概要",
    login: "ログイン",
    findIdea: "ビジネスアイデアを探す",
    startBuilding: "始める",
    tagline: "ビジネスをもっと簡単に",
    hero1: "あなたのビジネス。",
    hero2: "スマートに構築。",
    description:
      "Buzypeezy にあなたのビジネスと目標を伝えてください。完全なデジタルビジネスシステムへと変換します。",
    seeHow: "仕組みを見る",
  },

  ko: {
    howItWorks: "작동 방식",
    businessEyebrow: "당신의 비즈니스에 맞춰 설계",
businessTitle: "비즈니스를 앞으로 나아가게 하는 하나의 공간.",
businessDescription:
  "복잡한 도구를 이해하거나 서로 다른 시스템을 연결할 필요가 없습니다. 비즈니스에 대한 간단한 설명만 입력하면 Buzypeezy가 필요한 내용을 하나의 명확한 방향으로 정리합니다.",

startStrong: "강하게 시작하기",
startStrongDescription:
  "아이디어를 명확한 비즈니스 방향으로 바꿉니다.",

lookProfessional: "전문적으로 보이기",
lookProfessionalDescription:
  "고객이 신뢰할 수 있는 일관되고 믿을 만한 이미지를 구축합니다.",

reachMore: "더 많은 사람에게 도달",
reachMoreDescription:
  "적합한 고객을 끌어들이는 데 필요한 시스템을 만듭니다.",

keepGrowing: "계속 성장하기",
keepGrowingDescription:
  "무엇이 잘 작동하는지 파악하고 Buzypeezy가 다음에 무엇을 추천하는지 확인합니다.",
    forBusiness: "비즈니스용",
    pricing: "가격",
    about: "소개",
    login: "로그인",
    findIdea: "비즈니스 아이디어 찾기",
    startBuilding: "시작하기",
    tagline: "비즈니스를 더 쉽게",
    hero1: "당신의 비즈니스.",
    hero2: "스마트하게 구축.",
    description:
      "Buzypeezy에 당신의 비즈니스와 목표를 알려주세요. 완전한 디지털 비즈니스 시스템으로 만들어드립니다.",
    seeHow: "작동 방식 보기",
  },

  zh: {
    howItWorks: "如何运作",
    businessEyebrow: "围绕您的业务而设计",
businessTitle: "一个地方，让您的业务不断前进。",
businessDescription:
  "您不需要理解复杂的工具，也不需要连接分散的系统。只需提供一份简要的业务说明，Buzypeezy 就会围绕一个清晰的方向协调您所需要的一切。",

startStrong: "强势起步",
startStrongDescription:
  "把一个想法转化为清晰的业务方向。",

lookProfessional: "展现专业形象",
lookProfessionalDescription:
  "建立可信且一致的品牌形象，让客户更愿意信任您。",

reachMore: "触达更多人",
reachMoreDescription:
  "建立吸引合适客户所需要的系统。",

keepGrowing: "持续增长",
keepGrowingDescription:
  "了解哪些方法有效，以及 Buzypeezy 建议您下一步做什么。",
    forBusiness: "企业服务",
    pricing: "价格",
    about: "关于",
    login: "登录",
    findIdea: "寻找商业创意",
    startBuilding: "开始构建",
    tagline: "让商业更简单",
    hero1: "您的业务。",
    hero2: "智能构建。",
    description:
      "告诉 Buzypeezy 您的业务和目标，我们会将其转化为完整的数字化商业系统。",
    seeHow: "了解如何运作",
  },

  kn: {
    howItWorks: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
    businessEyebrow: "ನಿಮ್ಮ ವ್ಯವಹಾರವನ್ನು ಕೇಂದ್ರವಾಗಿಟ್ಟುಕೊಂಡು ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ",
businessTitle: "ನಿಮ್ಮ ವ್ಯವಹಾರವನ್ನು ಮುಂದೆ ಕೊಂಡೊಯ್ಯಲು ಒಂದೇ ಸ್ಥಳ.",
businessDescription:
  "ನೀವು ಸಂಕೀರ್ಣ ಸಾಧನಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಬೇಕಾಗಿಲ್ಲ ಅಥವಾ ಬೇರೆ ಬೇರೆ ವ್ಯವಸ್ಥೆಗಳನ್ನು ಸಂಪರ್ಕಿಸಬೇಕಾಗಿಲ್ಲ. ನಿಮ್ಮ ವ್ಯವಹಾರದ ಚಿಕ್ಕ ವಿವರಣೆ ನೀಡಿ, Buzypeezy ನಿಮ್ಮ ಅಗತ್ಯಗಳನ್ನು ಒಂದೇ ಸ್ಪಷ್ಟ ದಿಕ್ಕಿನಲ್ಲಿ ಸಮನ್ವಯಗೊಳಿಸುತ್ತದೆ.",

startStrong: "ಬಲವಾಗಿ ಆರಂಭಿಸಿ",
startStrongDescription:
  "ಒಂದು ಕಲ್ಪನೆಯನ್ನು ಸ್ಪಷ್ಟ ವ್ಯವಹಾರ ದಿಕ್ಕಾಗಿ ಪರಿವರ್ತಿಸಿ.",

lookProfessional: "ವೃತ್ತಿಪರವಾಗಿ ಕಾಣಿಸಿ",
lookProfessionalDescription:
  "ಗ್ರಾಹಕರು ನಂಬಬಹುದಾದ ವಿಶ್ವಾಸಾರ್ಹ ಮತ್ತು ಸತತ ಹಾಜರಾತಿಯನ್ನು ನಿರ್ಮಿಸಿ.",

reachMore: "ಹೆಚ್ಚು ಜನರನ್ನು ತಲುಪಿ",
reachMoreDescription:
  "ಸರಿಯಾದ ಗ್ರಾಹಕರನ್ನು ಆಕರ್ಷಿಸಲು ಬೇಕಾದ ವ್ಯವಸ್ಥೆಗಳನ್ನು ನಿರ್ಮಿಸಿ.",

keepGrowing: "ಬೆಳೆಯುತ್ತಲೇ ಇರಿ",
keepGrowingDescription:
  "ಯಾವುದು ಕೆಲಸ ಮಾಡುತ್ತಿದೆ ಎಂಬುದನ್ನು ತಿಳಿದು, Buzypeezy ಮುಂದೇನು ಶಿಫಾರಸು ಮಾಡುತ್ತದೆ ಎಂಬುದನ್ನು ನೋಡಿ.",
    forBusiness: "ವ್ಯವಹಾರಕ್ಕಾಗಿ",
    pricing: "ಬೆಲೆ",
    about: "ನಮ್ಮ ಬಗ್ಗೆ",
    login: "ಲಾಗಿನ್",
    findIdea: "ವ್ಯವಹಾರ ಕಲ್ಪನೆ ಹುಡುಕಿ",
    startBuilding: "ಪ್ರಾರಂಭಿಸಿ",
    tagline: "ವ್ಯವಹಾರ ಈಗ ಸುಲಭ",
    hero1: "ನಿಮ್ಮ ವ್ಯವಹಾರ.",
    hero2: "ಬುದ್ಧಿವಂತಿಕೆಯಿಂದ ನಿರ್ಮಿಸಲಾಗಿದೆ.",
    description:
      "ನೀವು ಏನು ಮಾಡುತ್ತೀರಿ ಮತ್ತು ಎಲ್ಲಿ ತಲುಪಲು ಬಯಸುತ್ತೀರಿ ಎಂಬುದನ್ನು Buzypeezyಗೆ ತಿಳಿಸಿ. ನಾವು ಅದನ್ನು ಸಂಪೂರ್ಣ ಡಿಜಿಟಲ್ ವ್ಯವಹಾರ ವ್ಯವಸ್ಥೆಯಾಗಿ ರೂಪಿಸುತ್ತೇವೆ.",
    seeHow: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ ನೋಡಿ",
  },

  ta: {
    howItWorks: "இது எப்படி செயல்படுகிறது",
    businessEyebrow: "உங்கள் வணிகத்தை மையமாகக் கொண்டு வடிவமைக்கப்பட்டது",
businessTitle: "உங்கள் வணிகத்தை முன்னேற்ற ஒரே இடம்.",
businessDescription:
  "சிக்கலான கருவிகளைப் புரிந்துகொள்ளவோ, தனித்தனி அமைப்புகளை இணைக்கவோ தேவையில்லை. உங்கள் வணிகத்தைப் பற்றிய ஒரு சுருக்கமான விளக்கத்தைத் தொடக்கமாக வழங்குங்கள்; Buzypeezy அனைத்தையும் ஒரே தெளிவான திசையில் ஒருங்கிணைக்கும்.",

startStrong: "வலுவாக தொடங்குங்கள்",
startStrongDescription:
  "ஒரு யோசனையை தெளிவான வணிக திசையாக மாற்றுங்கள்.",

lookProfessional: "தொழில்முறை தோற்றத்தை உருவாக்குங்கள்",
lookProfessionalDescription:
  "வாடிக்கையாளர்கள் நம்பக்கூடிய நம்பகமான மற்றும் ஒரே மாதிரியான இருப்பை உருவாக்குங்கள்.",

reachMore: "மேலும் பலரை அடையுங்கள்",
reachMoreDescription:
  "சரியான வாடிக்கையாளர்களை ஈர்க்க தேவையான அமைப்புகளை உருவாக்குங்கள்.",

keepGrowing: "தொடர்ந்து வளருங்கள்",
keepGrowingDescription:
  "எது செயல்படுகிறது என்பதை அறிந்து, அடுத்ததாக Buzypeezy என்ன பரிந்துரைக்கிறது என்பதைப் பாருங்கள்.",
    forBusiness: "வணிகத்திற்காக",
    pricing: "விலை",
    about: "எங்களைப் பற்றி",
    login: "உள்நுழைக",
    findIdea: "வணிக யோசனையை கண்டறியவும்",
    startBuilding: "தொடங்குங்கள்",
    tagline: "வணிகம் இப்போது எளிது",
    hero1: "உங்கள் வணிகம்.",
    hero2: "புத்திசாலித்தனமாக உருவாக்கப்பட்டது.",
    description:
      "நீங்கள் என்ன செய்கிறீர்கள் மற்றும் எங்கு செல்ல விரும்புகிறீர்கள் என்பதை Buzypeezyக்கு சொல்லுங்கள். அதை முழுமையான டிஜிட்டல் வணிக அமைப்பாக மாற்றுகிறோம்.",
    seeHow: "இது எப்படி செயல்படுகிறது என்பதைப் பாருங்கள்",
  },

  te: {
    howItWorks: "ఇది ఎలా పనిచేస్తుంది",
    businessEyebrow: "మీ వ్యాపారాన్ని కేంద్రంగా ఉంచి రూపొందించబడింది",
businessTitle: "మీ వ్యాపారాన్ని ముందుకు తీసుకెళ్లడానికి ఒకే స్థలం.",
businessDescription:
  "మీరు క్లిష్టమైన సాధనాలను అర్థం చేసుకోవాల్సిన అవసరం లేదు లేదా వేరువేరు వ్యవస్థలను కలపాల్సిన అవసరం లేదు. మీ వ్యాపారం గురించి చిన్న వివరణ ఇవ్వండి; Buzypeezy మీ అవసరాలను ఒక స్పష్టమైన దిశలో సమన్వయం చేస్తుంది.",

startStrong: "బలంగా ప్రారంభించండి",
startStrongDescription:
  "ఒక ఆలోచనను స్పష్టమైన వ్యాపార దిశగా మార్చండి.",

lookProfessional: "ప్రొఫెషనల్‌గా కనిపించండి",
lookProfessionalDescription:
  "కస్టమర్లు నమ్మగల విశ్వసనీయమైన మరియు స్థిరమైన ఉనికిని నిర్మించండి.",

reachMore: "ఇంకా ఎక్కువ మందిని చేరుకోండి",
reachMoreDescription:
  "సరైన కస్టమర్లను ఆకర్షించడానికి అవసరమైన వ్యవస్థలను రూపొందించండి.",

keepGrowing: "నిరంతరం ఎదగండి",
keepGrowingDescription:
  "ఏది పనిచేస్తోందో తెలుసుకుని, తదుపరి ఏమి చేయాలని Buzypeezy సూచిస్తుందో చూడండి.",
    forBusiness: "వ్యాపారం కోసం",
    pricing: "ధరలు",
    about: "మా గురించి",
    login: "లాగిన్",
    findIdea: "వ్యాపార ఆలోచనను కనుగొనండి",
    startBuilding: "ప్రారంభించండి",
    tagline: "వ్యాపారం ఇప్పుడు సులభం",
    hero1: "మీ వ్యాపారం.",
    hero2: "తెలివిగా నిర్మించబడింది.",
    description:
      "మీరు ఏమి చేస్తారు మరియు ఎక్కడికి వెళ్లాలనుకుంటున్నారు అనే విషయాన్ని Buzypeezyకి చెప్పండి. దాన్ని పూర్తి డిజిటల్ వ్యాపార వ్యవస్థగా మార్చుతాము.",
    seeHow: "ఇది ఎలా పనిచేస్తుందో చూడండి",
  },

  ml: {
    howItWorks: "ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു",
    businessEyebrow: "നിങ്ങളുടെ ബിസിനസിനെ ചുറ്റിപ്പറ്റി രൂപകൽപ്പന ചെയ്തത്",
businessTitle: "നിങ്ങളുടെ ബിസിനസിനെ മുന്നോട്ട് കൊണ്ടുപോകാൻ ഒരൊറ്റ സ്ഥലം.",
businessDescription:
  "സങ്കീർണ്ണമായ ടൂളുകൾ മനസ്സിലാക്കാനോ വേർതിരിഞ്ഞ സിസ്റ്റങ്ങൾ ബന്ധിപ്പിക്കാനോ ആവശ്യമില്ല. നിങ്ങളുടെ ബിസിനസിന്റെ ചെറിയൊരു വിവരണം നൽകൂ; Buzypeezy നിങ്ങളുടെ ആവശ്യങ്ങളെ ഒരേ വ്യക്തമായ ദിശയിൽ ഏകോപിപ്പിക്കും.",

startStrong: "ശക്തമായി ആരംഭിക്കുക",
startStrongDescription:
  "ഒരു ആശയത്തെ വ്യക്തമായ ബിസിനസ് ദിശയാക്കി മാറ്റുക.",

lookProfessional: "പ്രൊഫഷണൽ ഇമേജ് സൃഷ്ടിക്കുക",
lookProfessionalDescription:
  "ഉപഭോക്താക്കൾക്ക് വിശ്വസിക്കാവുന്ന സ്ഥിരതയുള്ള വിശ്വസനീയമായ സാന്നിധ്യം നിർമ്മിക്കുക.",

reachMore: "കൂടുതൽ ആളുകളിലേക്ക് എത്തുക",
reachMoreDescription:
  "ശരിയായ ഉപഭോക്താക്കളെ ആകർഷിക്കാൻ ആവശ്യമായ സംവിധാനങ്ങൾ സൃഷ്ടിക്കുക.",

keepGrowing: "തുടർന്ന് വളരുക",
keepGrowingDescription:
  "എന്താണ് പ്രവർത്തിക്കുന്നത് എന്ന് മനസ്സിലാക്കി, Buzypeezy അടുത്തതായി എന്താണ് ശുപാർശ ചെയ്യുന്നത് എന്ന് കാണുക.",
    forBusiness: "ബിസിനസിന്",
    pricing: "വില",
    about: "ഞങ്ങളെക്കുറിച്ച്",
    login: "ലോഗിൻ",
    findIdea: "ബിസിനസ് ആശയം കണ്ടെത്തുക",
    startBuilding: "ആരംഭിക്കുക",
    tagline: "ബിസിനസ് ഇനി എളുപ്പം",
    hero1: "നിങ്ങളുടെ ബിസിനസ്.",
    hero2: "ബുദ്ധിപൂർവ്വം നിർമ്മിച്ചത്.",
    description:
      "നിങ്ങൾ എന്ത് ചെയ്യുന്നു, എവിടേക്കാണ് എത്തേണ്ടത് എന്ന് Buzypeezyയോട് പറയൂ. അത് ഒരു പൂർണ്ണ ഡിജിറ്റൽ ബിസിനസ് സംവിധാനമാക്കി മാറ്റാം.",
    seeHow: "ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു എന്ന് കാണുക",
  },
};

type Language = keyof typeof translations;

const extraKeys = [
  "howTitle", "stepTellTitle", "stepTellDescription", "stepUnderstandTitle", "stepUnderstandDescription", "stepCreateTitle", "stepCreateDescription", "stepReviewTitle", "stepReviewDescription",
  "beginNaturally", "beginTitle", "beginDescription", "briefLabel", "briefExample", "continueWithBuzypeezy",
  "connectedOutcomes", "connectedTitle", "connectedDescription", "overviewDirection", "overviewPresence", "overviewGrowth", "overviewContent", "overviewPerformance", "overviewActions",
  "simplePlans", "pricingTitle", "pricingDescription", "mostSelected", "planPro", "planBusiness", "periodPro", "periodBusiness", "planProDescription", "planBusinessDescription",
  "proFeatureConnected", "proFeatureAi", "proFeatureSaved", "businessFeatureStarter", "businessFeatureCapacity", "businessFeatureSupport", "choosePro", "chooseBusiness", "secureCheckout",
  "designedForClarity", "aboutTitle", "benefitSecure", "benefitOrganised", "benefitControl", "benefitGrowth", "finalTitle", "finalDescription", "footerTagline",
  "privacyPolicy", "termsOfService", "refundCancellation", "contactSupport",
] as const;

const extraValues: Record<Language, readonly string[]> = {
  en: "From what you know to what your business needs.|Tell us about your business|Write naturally. You don’t need to know technical terms.|Buzypeezy understands what you need|Your goals, customers and direction are organised automatically.|Your business system is created|Everything works together from one shared business understanding.|Review, improve and launch|You stay in control and can refine anything later.|Begin naturally|Start with what you already know.|You don’t need a strategy document. Just tell Buzypeezy about your business in your own words.|Tell Buzypeezy about your business|“I run a luxury real estate company in Bangalore and want to attract more serious buyers.”|Continue with Buzypeezy|Connected outcomes|See your business as one complete picture.|Everything stays connected to the same business understanding, so every next action has context.|Your direction|Your digital presence|Your customer growth system|Your business content|Your performance overview|Recommended next actions|Simple plans|Choose what fits your business.|Start with the capacity you need today and move forward as your business grows.|Most selected|Starter|Growth|/month|/month|The complete Buzypeezy workspace for growing your business.|Expanded capacity for established businesses and teams.|Connected business workspace|AI business tools|Saved projects and outputs|Everything in Starter|Expanded business capacity|Priority business support|Choose Starter|Choose Growth|Continue to secure checkout|Designed for clarity|Built for businesses that want simplicity without losing control.|Secure account access|Your projects stay organised|You remain in control|Built to grow with your business|Ready to make your business easier?|Start with what you know. Buzypeezy will help organise what comes next.|Built to make business simpler.|Privacy Policy|Terms of Service|Refund & Cancellation|Contact & Support".split("|"),
  es: "De lo que sabes a lo que tu negocio necesita.|Cuéntanos sobre tu negocio|Escribe con naturalidad. No necesitas términos técnicos.|Buzypeezy entiende lo que necesitas|Tus objetivos, clientes y dirección se organizan automáticamente.|Se crea tu sistema empresarial|Todo funciona desde una comprensión compartida del negocio.|Revisa, mejora y lanza|Mantienes el control y puedes perfeccionarlo después.|Empieza con naturalidad|Empieza con lo que ya sabes.|No necesitas un documento estratégico. Cuéntale a Buzypeezy sobre tu negocio con tus propias palabras.|Cuéntale a Buzypeezy sobre tu negocio|“Dirijo una inmobiliaria de lujo en Bangalore y quiero atraer compradores más serios.”|Continuar con Buzypeezy|Resultados conectados|Ve tu negocio como una imagen completa.|Todo permanece conectado a la misma comprensión del negocio, dando contexto a cada acción.|Tu dirección|Tu presencia digital|Tu sistema de crecimiento de clientes|Tu contenido empresarial|Tu resumen de rendimiento|Próximas acciones recomendadas|Planes sencillos|Elige lo que se adapta a tu negocio.|Empieza con la capacidad que necesitas hoy y avanza mientras crece tu negocio.|Más elegido|Inicial|Crecimiento|/mes|/mes|El espacio completo de Buzypeezy para hacer crecer tu negocio.|Mayor capacidad para empresas y equipos consolidados.|Espacio empresarial conectado|Herramientas empresariales de IA|Proyectos y resultados guardados|Todo lo del plan Inicial|Mayor capacidad empresarial|Soporte empresarial prioritario|Elegir Inicial|Elegir Crecimiento|Continuar al pago seguro|Diseñado para la claridad|Para empresas que quieren sencillez sin perder el control.|Acceso seguro a la cuenta|Tus proyectos permanecen organizados|Mantienes el control|Creado para crecer con tu negocio|¿Listo para simplificar tu negocio?|Empieza con lo que sabes. Buzypeezy organizará lo que sigue.|Creado para simplificar los negocios.|Política de privacidad|Términos del servicio|Reembolsos y cancelaciones|Contacto y soporte".split("|"),
  fr: "De ce que vous savez à ce dont votre entreprise a besoin.|Parlez-nous de votre entreprise|Écrivez naturellement, sans termes techniques.|Buzypeezy comprend vos besoins|Vos objectifs, clients et orientation sont organisés automatiquement.|Votre système d’entreprise est créé|Tout fonctionne à partir d’une même compréhension de l’entreprise.|Vérifiez, améliorez et lancez|Vous gardez le contrôle et pouvez tout affiner ensuite.|Commencez naturellement|Commencez par ce que vous savez déjà.|Aucun document stratégique n’est nécessaire. Décrivez simplement votre entreprise à Buzypeezy avec vos mots.|Parlez de votre entreprise à Buzypeezy|« Je dirige une agence immobilière de luxe à Bangalore et souhaite attirer des acheteurs plus sérieux. »|Continuer avec Buzypeezy|Résultats connectés|Voyez votre entreprise comme un ensemble complet.|Tout reste lié à la même compréhension, donnant du contexte à chaque action.|Votre orientation|Votre présence numérique|Votre système de croissance client|Votre contenu d’entreprise|Votre aperçu des performances|Prochaines actions recommandées|Des offres simples|Choisissez l’offre adaptée à votre entreprise.|Commencez avec la capacité nécessaire aujourd’hui et évoluez avec votre entreprise.|Le plus choisi|Démarrage|Croissance|/mois|/mois|L’espace Buzypeezy complet pour développer votre entreprise.|Une capacité accrue pour les entreprises établies et les équipes.|Espace d’entreprise connecté|Outils d’entreprise IA|Projets et résultats enregistrés|Tout dans Démarrage|Capacité accrue|Assistance prioritaire|Choisir Démarrage|Choisir Croissance|Continuer vers le paiement sécurisé|Conçu pour la clarté|Pour les entreprises qui veulent la simplicité sans perdre le contrôle.|Accès sécurisé au compte|Vos projets restent organisés|Vous gardez le contrôle|Conçu pour évoluer avec votre entreprise|Prêt à simplifier votre entreprise ?|Commencez par ce que vous savez. Buzypeezy organisera la suite.|Conçu pour simplifier l’entreprise.|Politique de confidentialité|Conditions d’utilisation|Remboursement et annulation|Contact et assistance".split("|"),
  de: "Von Ihrem Wissen zu dem, was Ihr Unternehmen braucht.|Erzählen Sie uns von Ihrem Unternehmen|Schreiben Sie natürlich. Fachbegriffe sind nicht nötig.|Buzypeezy versteht Ihren Bedarf|Ziele, Kunden und Ausrichtung werden automatisch geordnet.|Ihr Geschäftssystem wird erstellt|Alles arbeitet auf Basis eines gemeinsamen Geschäftsverständnisses.|Prüfen, verbessern und starten|Sie behalten die Kontrolle und können später alles anpassen.|Ganz natürlich beginnen|Beginnen Sie mit dem, was Sie bereits wissen.|Sie brauchen kein Strategiedokument. Beschreiben Sie Buzypeezy Ihr Unternehmen in eigenen Worten.|Erzählen Sie Buzypeezy von Ihrem Unternehmen|„Ich führe ein Luxusimmobilienunternehmen in Bangalore und möchte mehr ernsthafte Käufer erreichen.“|Mit Buzypeezy fortfahren|Verbundene Ergebnisse|Sehen Sie Ihr Unternehmen als vollständiges Bild.|Alles bleibt mit demselben Geschäftsverständnis verbunden, damit jede Aktion Kontext hat.|Ihre Ausrichtung|Ihre digitale Präsenz|Ihr Kundenwachstumssystem|Ihre Geschäftsinhalte|Ihre Leistungsübersicht|Empfohlene nächste Schritte|Einfache Tarife|Wählen Sie, was zu Ihrem Unternehmen passt.|Starten Sie mit der heute benötigten Kapazität und wachsen Sie weiter.|Am häufigsten gewählt|Starter|Wachstum|/Monat|/Monat|Der vollständige Buzypeezy-Arbeitsbereich für Ihr Wachstum.|Mehr Kapazität für etablierte Unternehmen und Teams.|Verbundener Geschäftsbereich|KI-Geschäftstools|Gespeicherte Projekte und Ergebnisse|Alles aus Starter|Mehr Geschäftskapazität|Bevorzugter Support|Starter wählen|Wachstum wählen|Weiter zur sicheren Zahlung|Für Klarheit entwickelt|Für Unternehmen, die Einfachheit ohne Kontrollverlust wollen.|Sicherer Kontozugang|Ihre Projekte bleiben organisiert|Sie behalten die Kontrolle|Wächst mit Ihrem Unternehmen|Bereit, Ihr Geschäft einfacher zu machen?|Beginnen Sie mit Ihrem Wissen. Buzypeezy organisiert die nächsten Schritte.|Entwickelt, um Geschäfte zu vereinfachen.|Datenschutzerklärung|Nutzungsbedingungen|Erstattung und Stornierung|Kontakt und Support".split("|"),
  pt: "Do que você sabe ao que seu negócio precisa.|Conte sobre seu negócio|Escreva naturalmente. Você não precisa de termos técnicos.|Buzypeezy entende o que você precisa|Seus objetivos, clientes e direção são organizados automaticamente.|Seu sistema de negócios é criado|Tudo funciona com base no mesmo entendimento do negócio.|Revise, melhore e lance|Você mantém o controle e pode ajustar tudo depois.|Comece naturalmente|Comece com o que você já sabe.|Você não precisa de um documento estratégico. Conte à Buzypeezy sobre seu negócio com suas palavras.|Conte à Buzypeezy sobre seu negócio|“Tenho uma imobiliária de luxo em Bangalore e quero atrair compradores mais sérios.”|Continuar com Buzypeezy|Resultados conectados|Veja seu negócio como um todo.|Tudo permanece ligado ao mesmo entendimento, dando contexto a cada ação.|Sua direção|Sua presença digital|Seu sistema de crescimento de clientes|Seu conteúdo empresarial|Seu resumo de desempenho|Próximas ações recomendadas|Planos simples|Escolha o que combina com seu negócio.|Comece com a capacidade necessária hoje e avance conforme seu negócio cresce.|Mais escolhido|Inicial|Crescimento|/mês|/mês|O espaço completo da Buzypeezy para expandir seu negócio.|Mais capacidade para empresas e equipes estabelecidas.|Espaço de negócios conectado|Ferramentas empresariais de IA|Projetos e resultados salvos|Tudo do plano Inicial|Mais capacidade empresarial|Suporte prioritário|Escolher Inicial|Escolher Crescimento|Continuar para pagamento seguro|Feito para dar clareza|Para empresas que querem simplicidade sem perder o controle.|Acesso seguro à conta|Seus projetos ficam organizados|Você mantém o controle|Feito para crescer com seu negócio|Pronto para facilitar seu negócio?|Comece com o que sabe. A Buzypeezy organiza o próximo passo.|Feito para simplificar os negócios.|Política de Privacidade|Termos de Serviço|Reembolso e Cancelamento|Contato e Suporte".split("|"),
  ar: "من معرفتك إلى ما يحتاجه عملك.|أخبرنا عن عملك|اكتب بطبيعتك، ولا حاجة لمصطلحات تقنية.|يفهم Buzypeezy احتياجاتك|تُنظَّم أهدافك وعملاؤك واتجاهك تلقائياً.|يُنشأ نظام عملك|يعمل كل شيء وفق فهم مشترك لعملك.|راجع وحسّن وانطلق|تبقى مسيطراً ويمكنك التحسين لاحقاً.|ابدأ بطبيعتك|ابدأ بما تعرفه بالفعل.|لا تحتاج إلى وثيقة استراتيجية. أخبر Buzypeezy عن عملك بكلماتك.|أخبر Buzypeezy عن عملك|«أدير شركة عقارات فاخرة في بنغالور وأريد جذب مشترين أكثر جدية.»|تابع مع Buzypeezy|نتائج مترابطة|شاهد عملك كصورة متكاملة.|يبقى كل شيء مرتبطاً بفهم واحد لعملك، فتكون لكل خطوة خلفية واضحة.|اتجاهك|حضورك الرقمي|نظام نمو العملاء|محتوى عملك|ملخص أدائك|الخطوات التالية المقترحة|خطط بسيطة|اختر ما يناسب عملك.|ابدأ بالسعة التي تحتاجها اليوم وتقدم مع نمو عملك.|الأكثر اختياراً|البداية|النمو|/شهرياً|/شهرياً|مساحة Buzypeezy المتكاملة لتنمية عملك.|سعة أكبر للشركات والفرق القائمة.|مساحة عمل مترابطة|أدوات أعمال بالذكاء الاصطناعي|مشاريع ونتائج محفوظة|كل مزايا البداية|سعة أعمال أكبر|دعم أعمال أولوية|اختر البداية|اختر النمو|تابع إلى الدفع الآمن|مصمم للوضوح|للشركات التي تريد البساطة دون فقدان السيطرة.|دخول آمن للحساب|تبقى مشاريعك منظمة|تبقى مسيطراً|مصمم لينمو مع عملك|هل أنت مستعد لتسهيل عملك؟|ابدأ بما تعرفه، وسينظم Buzypeezy ما يأتي بعده.|مصمم لتبسيط الأعمال.|سياسة الخصوصية|شروط الخدمة|الاسترداد والإلغاء|التواصل والدعم".split("|"),
  hi: "आपकी जानकारी से आपके व्यवसाय की ज़रूरतों तक।|अपने व्यवसाय के बारे में बताएं|स्वाभाविक रूप से लिखें; तकनीकी शब्द ज़रूरी नहीं हैं।|Buzypeezy आपकी ज़रूरत समझता है|आपके लक्ष्य, ग्राहक और दिशा अपने आप व्यवस्थित होते हैं।|आपकी व्यवसाय प्रणाली बनती है|सब कुछ व्यवसाय की एक साझा समझ से काम करता है।|समीक्षा करें, सुधारें और लॉन्च करें|नियंत्रण आपके पास रहता है और बाद में बदलाव कर सकते हैं।|स्वाभाविक रूप से शुरू करें|जो आप जानते हैं, वहीं से शुरू करें।|रणनीति दस्तावेज़ की ज़रूरत नहीं। अपने शब्दों में Buzypeezy को व्यवसाय बताएं।|Buzypeezy को अपने व्यवसाय के बारे में बताएं|“मैं बेंगलुरु में लक्ज़री रियल एस्टेट कंपनी चलाता हूं और गंभीर खरीदार चाहता हूं।”|Buzypeezy के साथ जारी रखें|जुड़े हुए परिणाम|अपने व्यवसाय की पूरी तस्वीर देखें।|सब कुछ एक ही व्यावसायिक समझ से जुड़ा रहता है, इसलिए हर कदम का संदर्भ होता है।|आपकी दिशा|आपकी डिजिटल उपस्थिति|ग्राहक वृद्धि प्रणाली|व्यावसायिक सामग्री|प्रदर्शन सारांश|सुझाए गए अगले कदम|सरल योजनाएं|अपने व्यवसाय के अनुरूप चुनें।|आज की ज़रूरत की क्षमता से शुरू करें और व्यवसाय के साथ आगे बढ़ें।|सबसे लोकप्रिय|स्टार्टर|ग्रोथ|/माह|/माह|व्यवसाय बढ़ाने के लिए पूरा Buzypeezy कार्यक्षेत्र।|स्थापित व्यवसायों और टीमों के लिए अधिक क्षमता।|जुड़ा व्यवसाय कार्यक्षेत्र|AI व्यवसाय टूल|सहेजे गए प्रोजेक्ट और परिणाम|स्टार्टर की सभी सुविधाएं|अधिक व्यवसाय क्षमता|प्राथमिकता सहायता|स्टार्टर चुनें|ग्रोथ चुनें|सुरक्षित भुगतान पर जाएं|स्पष्टता के लिए बनाया गया|नियंत्रण खोए बिना सरलता चाहने वाले व्यवसायों के लिए।|सुरक्षित खाता पहुंच|आपके प्रोजेक्ट व्यवस्थित रहते हैं|नियंत्रण आपके पास|आपके व्यवसाय के साथ बढ़ने के लिए निर्मित|व्यवसाय आसान बनाने के लिए तैयार हैं?|जो जानते हैं उससे शुरू करें। Buzypeezy आगे का काम व्यवस्थित करेगा।|व्यवसाय को सरल बनाने के लिए निर्मित।|गोपनीयता नीति|सेवा की शर्तें|रिफंड और रद्दीकरण|संपर्क और सहायता".split("|"),
  ja: "知っていることから、ビジネスに必要なものへ。|ビジネスについて教えてください|自然な言葉で書けます。専門用語は不要です。|Buzypeezyがニーズを理解|目標、顧客、方向性を自動で整理します。|ビジネスシステムを作成|一つの共通理解をもとにすべてが連携します。|確認、改善、公開|主導権を保ち、後からいつでも調整できます。|自然に始める|すでに知っていることから始めましょう。|戦略書は不要です。自分の言葉でBuzypeezyにビジネスを伝えてください。|Buzypeezyにビジネスを伝える|「バンガロールで高級不動産会社を経営し、より真剣な購入者を集めたい。」|Buzypeezyで続ける|つながる成果|ビジネスの全体像を確認。|すべてが同じビジネス理解につながり、次の行動に文脈が生まれます。|方向性|デジタルプレゼンス|顧客成長システム|ビジネスコンテンツ|パフォーマンス概要|おすすめの次の行動|シンプルなプラン|ビジネスに合うものを選択。|今必要な容量から始め、成長に合わせて進めます。|人気|スターター|グロース|/月|/月|成長のための完全なBuzypeezyワークスペース。|確立した企業やチーム向けの拡張容量。|連携型ワークスペース|AIビジネスツール|保存済みプロジェクトと成果|スターターの全機能|拡張ビジネス容量|優先サポート|スターターを選択|グロースを選択|安全な決済へ進む|明快さを重視した設計|管理を失わずシンプルさを求める企業向け。|安全なアカウントアクセス|プロジェクトを整理|主導権を維持|ビジネスと共に成長|ビジネスをもっと簡単にしませんか？|知っていることから始めれば、Buzypeezyが次を整理します。|ビジネスをより簡単に。|プライバシーポリシー|利用規約|返金とキャンセル|お問い合わせとサポート".split("|"),
  ko: "아는 것에서 비즈니스에 필요한 것까지.|비즈니스를 알려주세요|자연스럽게 작성하세요. 전문 용어는 필요 없습니다.|Buzypeezy가 필요를 이해합니다|목표, 고객, 방향이 자동으로 정리됩니다.|비즈니스 시스템이 만들어집니다|하나의 공통된 비즈니스 이해를 바탕으로 모두 연결됩니다.|검토하고 개선한 뒤 출시하세요|통제권을 유지하며 나중에 언제든 수정할 수 있습니다.|자연스럽게 시작하기|이미 아는 것부터 시작하세요.|전략 문서는 필요 없습니다. 자신의 말로 Buzypeezy에 비즈니스를 알려주세요.|Buzypeezy에 비즈니스 알려주기|“방갈로르에서 고급 부동산 회사를 운영하며 진지한 구매자를 더 유치하고 싶습니다.”|Buzypeezy로 계속|연결된 성과|비즈니스의 전체 그림을 확인하세요.|모든 것이 같은 비즈니스 이해에 연결되어 다음 행동에 맥락이 생깁니다.|방향|디지털 존재감|고객 성장 시스템|비즈니스 콘텐츠|성과 개요|추천 다음 단계|간단한 요금제|비즈니스에 맞는 것을 선택하세요.|오늘 필요한 용량으로 시작해 성장에 맞춰 나아가세요.|가장 많이 선택|스타터|성장|/월|/월|성장을 위한 완전한 Buzypeezy 작업 공간.|기존 기업과 팀을 위한 확장 용량.|연결된 작업 공간|AI 비즈니스 도구|저장된 프로젝트와 결과|스타터의 모든 기능|확장된 비즈니스 용량|우선 지원|스타터 선택|성장 선택|안전한 결제로 계속|명확성을 위한 설계|통제력을 잃지 않고 단순함을 원하는 비즈니스를 위해.|안전한 계정 접근|프로젝트가 정리됩니다|통제권 유지|비즈니스와 함께 성장|비즈니스를 더 쉽게 만들 준비가 되셨나요?|아는 것부터 시작하세요. Buzypeezy가 다음을 정리합니다.|비즈니스를 더 단순하게.|개인정보 처리방침|서비스 약관|환불 및 취소|문의 및 지원".split("|"),
  zh: "从您了解的内容到企业所需的一切。|介绍您的业务|自然书写，无需专业术语。|Buzypeezy了解您的需求|自动整理目标、客户和方向。|创建您的业务系统|一切基于共同的业务理解协同运作。|审查、改进并发布|您始终掌控，并可随时调整。|自然开始|从您已经了解的内容开始。|无需战略文档，只需用自己的话向Buzypeezy介绍业务。|向Buzypeezy介绍您的业务|“我在班加罗尔经营一家高端房地产公司，希望吸引更认真的买家。”|使用Buzypeezy继续|互联成果|查看完整的业务全景。|一切都与同一业务理解相连，让每个行动都有背景。|您的方向|数字形象|客户增长系统|业务内容|绩效概览|推荐的后续行动|简单方案|选择适合您业务的方案。|从今天所需的容量开始，随业务成长前进。|最受欢迎|入门版|成长版|/月|/月|助力业务增长的完整Buzypeezy工作空间。|为成熟企业和团队提供更大容量。|互联业务空间|AI业务工具|已保存的项目与成果|入门版全部功能|扩展业务容量|优先业务支持|选择入门版|选择成长版|继续安全结账|为清晰而设计|适合追求简单又不失掌控的企业。|安全账户访问|项目保持井然有序|您始终掌控|随业务共同成长|准备好让业务更简单了吗？|从已知开始，Buzypeezy会整理下一步。|让经营更简单。|隐私政策|服务条款|退款与取消|联系与支持".split("|"),
  kn: "ನಿಮಗೆ ತಿಳಿದಿರುವುದರಿಂದ ವ್ಯವಹಾರಕ್ಕೆ ಬೇಕಾದುದರವರೆಗೆ.|ನಿಮ್ಮ ವ್ಯವಹಾರದ ಬಗ್ಗೆ ತಿಳಿಸಿ|ಸಹಜವಾಗಿ ಬರೆಯಿರಿ. ತಾಂತ್ರಿಕ ಪದಗಳು ಬೇಡ.|Buzypeezy ನಿಮ್ಮ ಅಗತ್ಯವನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ|ಗುರಿ, ಗ್ರಾಹಕರು ಮತ್ತು ದಿಕ್ಕು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ವ್ಯವಸ್ಥೆಯಾಗುತ್ತವೆ.|ನಿಮ್ಮ ವ್ಯವಹಾರ ವ್ಯವಸ್ಥೆ ಸಿದ್ಧವಾಗುತ್ತದೆ|ಒಂದೇ ವ್ಯವಹಾರ ತಿಳುವಳಿಕೆಯಿಂದ ಎಲ್ಲವೂ ಜೊತೆಯಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ.|ಪರಿಶೀಲಿಸಿ, ಸುಧಾರಿಸಿ ಮತ್ತು ಆರಂಭಿಸಿ|ನಿಯಂತ್ರಣ ನಿಮ್ಮಲ್ಲೇ ಇರುತ್ತದೆ; ನಂತರ ಬದಲಾಯಿಸಬಹುದು.|ಸಹಜವಾಗಿ ಆರಂಭಿಸಿ|ನಿಮಗೆ ಈಗಾಗಲೇ ತಿಳಿದಿರುವುದರಿಂದ ಆರಂಭಿಸಿ.|ತಂತ್ರದ ದಾಖಲೆ ಬೇಡ. ನಿಮ್ಮ ಮಾತುಗಳಲ್ಲಿ Buzypeezyಗೆ ವ್ಯವಹಾರ ತಿಳಿಸಿ.|Buzypeezyಗೆ ನಿಮ್ಮ ವ್ಯವಹಾರ ತಿಳಿಸಿ|“ನಾನು ಬೆಂಗಳೂರಿನಲ್ಲಿ ಐಷಾರಾಮಿ ರಿಯಲ್ ಎಸ್ಟೇಟ್ ಕಂಪನಿ ನಡೆಸುತ್ತೇನೆ ಮತ್ತು ಗಂಭೀರ ಖರೀದಿದಾರರನ್ನು ಬಯಸುತ್ತೇನೆ.”|Buzypeezy ಜೊತೆ ಮುಂದುವರಿಸಿ|ಸಂಪರ್ಕಿತ ಫಲಿತಾಂಶಗಳು|ನಿಮ್ಮ ವ್ಯವಹಾರದ ಸಂಪೂರ್ಣ ಚಿತ್ರ ನೋಡಿ.|ಎಲ್ಲವೂ ಒಂದೇ ವ್ಯವಹಾರ ತಿಳುವಳಿಕೆಗೆ ಸಂಪರ್ಕಗೊಂಡಿರುವುದರಿಂದ ಪ್ರತಿ ಹೆಜ್ಜೆಗೆ ಸಂದರ್ಭ ಇರುತ್ತದೆ.|ನಿಮ್ಮ ದಿಕ್ಕು|ಡಿಜಿಟಲ್ ಉಪಸ್ಥಿತಿ|ಗ್ರಾಹಕ ಬೆಳವಣಿಗೆ ವ್ಯವಸ್ಥೆ|ವ್ಯವಹಾರ ವಿಷಯ|ಕಾರ್ಯಕ್ಷಮತೆ ಅವಲೋಕನ|ಶಿಫಾರಸು ಮಾಡಿದ ಮುಂದಿನ ಕ್ರಮಗಳು|ಸರಳ ಯೋಜನೆಗಳು|ನಿಮ್ಮ ವ್ಯವಹಾರಕ್ಕೆ ಹೊಂದುವುದನ್ನು ಆರಿಸಿ.|ಇಂದಿನ ಅಗತ್ಯ ಸಾಮರ್ಥ್ಯದಿಂದ ಆರಂಭಿಸಿ ಬೆಳವಣಿಗೆಯೊಂದಿಗೆ ಮುಂದುವರಿಯಿರಿ.|ಹೆಚ್ಚು ಆಯ್ಕೆಯಾದ|ಆರಂಭಿಕ|ಬೆಳವಣಿಗೆ|/ತಿಂಗಳು|/ತಿಂಗಳು|ಬೆಳವಣಿಗೆಗಾಗಿ ಸಂಪೂರ್ಣ Buzypeezy ಕಾರ್ಯಸ್ಥಳ.|ಸ್ಥಾಪಿತ ವ್ಯವಹಾರ ಮತ್ತು ತಂಡಗಳಿಗೆ ಹೆಚ್ಚಿನ ಸಾಮರ್ಥ್ಯ.|ಸಂಪರ್ಕಿತ ಕಾರ್ಯಸ್ಥಳ|AI ವ್ಯವಹಾರ ಸಾಧನಗಳು|ಉಳಿಸಿದ ಯೋಜನೆಗಳು ಮತ್ತು ಫಲಿತಾಂಶಗಳು|ಆರಂಭಿಕದ ಎಲ್ಲವೂ|ಹೆಚ್ಚಿನ ಸಾಮರ್ಥ್ಯ|ಆದ್ಯತಾ ಬೆಂಬಲ|ಆರಂಭಿಕ ಆರಿಸಿ|ಬೆಳವಣಿಗೆ ಆರಿಸಿ|ಸುರಕ್ಷಿತ ಪಾವತಿಗೆ ಮುಂದುವರಿಸಿ|ಸ್ಪಷ್ಟತೆಗಾಗಿ ವಿನ್ಯಾಸ|ನಿಯಂತ್ರಣ ಕಳೆದುಕೊಳ್ಳದೆ ಸರಳತೆ ಬಯಸುವ ವ್ಯವಹಾರಗಳಿಗೆ.|ಸುರಕ್ಷಿತ ಖಾತೆ ಪ್ರವೇಶ|ಯೋಜನೆಗಳು ವ್ಯವಸ್ಥಿತವಾಗಿರುತ್ತವೆ|ನಿಯಂತ್ರಣ ನಿಮ್ಮಲ್ಲೇ|ನಿಮ್ಮ ವ್ಯವಹಾರದೊಂದಿಗೆ ಬೆಳೆಯಲು ನಿರ್ಮಿತ|ವ್ಯವಹಾರವನ್ನು ಸುಲಭಗೊಳಿಸಲು ಸಿದ್ಧವೇ?|ತಿಳಿದಿರುವುದರಿಂದ ಆರಂಭಿಸಿ. ಮುಂದಿನದನ್ನು Buzypeezy ವ್ಯವಸ್ಥೆಗೊಳಿಸುತ್ತದೆ.|ವ್ಯವಹಾರ ಸರಳಗೊಳಿಸಲು ನಿರ್ಮಿತ.|ಗೌಪ್ಯತಾ ನೀತಿ|ಸೇವಾ ನಿಯಮಗಳು|ಮರುಪಾವತಿ ಮತ್ತು ರದ್ದತಿ|ಸಂಪರ್ಕ ಮತ್ತು ಬೆಂಬಲ".split("|"),
  ta: "உங்களுக்குத் தெரிந்ததிலிருந்து வணிகத்திற்குத் தேவையானது வரை.|உங்கள் வணிகத்தைப் பற்றி கூறுங்கள்|இயல்பாக எழுதுங்கள்; தொழில்நுட்பச் சொற்கள் தேவையில்லை.|Buzypeezy உங்கள் தேவையைப் புரிந்துகொள்கிறது|இலக்குகள், வாடிக்கையாளர்கள், திசை தானாக ஒழுங்குபடுத்தப்படும்.|உங்கள் வணிக அமைப்பு உருவாக்கப்படும்|ஒரே வணிகப் புரிதலிலிருந்து அனைத்தும் இணைந்து செயல்படும்.|மதிப்பாய்வு செய்து மேம்படுத்தி தொடங்குங்கள்|கட்டுப்பாடு உங்களிடமே; பின்னர் மாற்றலாம்.|இயல்பாகத் தொடங்குங்கள்|உங்களுக்கு ஏற்கனவே தெரிந்ததிலிருந்து தொடங்குங்கள்.|உத்தி ஆவணம் தேவையில்லை. உங்கள் சொற்களில் Buzypeezyக்கு வணிகத்தைக் கூறுங்கள்.|Buzypeezyக்கு உங்கள் வணிகத்தைக் கூறுங்கள்|“பெங்களூரில் ஆடம்பர ரியல் எஸ்டேட் நிறுவனம் நடத்துகிறேன்; தீவிர வாங்குபவர்களை ஈர்க்க விரும்புகிறேன்.”|Buzypeezy உடன் தொடரவும்|இணைந்த முடிவுகள்|உங்கள் வணிகத்தின் முழுப் படத்தைக் காணுங்கள்.|அனைத்தும் ஒரே வணிகப் புரிதலுடன் இணைந்து ஒவ்வொரு செயலுக்கும் சூழல் தருகிறது.|உங்கள் திசை|டிஜிட்டல் இருப்பு|வாடிக்கையாளர் வளர்ச்சி அமைப்பு|வணிக உள்ளடக்கம்|செயல்திறன் பார்வை|பரிந்துரைக்கப்பட்ட அடுத்த செயல்கள்|எளிய திட்டங்கள்|உங்கள் வணிகத்திற்குப் பொருத்தமானதைத் தேர்ந்தெடுங்கள்.|இன்றைய தேவையான திறனுடன் தொடங்கி வளர்ச்சியுடன் முன்னேறுங்கள்.|அதிகம் தேர்ந்தெடுக்கப்பட்டது|தொடக்கம்|வளர்ச்சி|/மாதம்|/மாதம்|வளர்ச்சிக்கான முழுமையான Buzypeezy பணியிடம்.|நிறுவப்பட்ட வணிகங்களுக்கும் அணிகளுக்கும் கூடுதல் திறன்.|இணைந்த பணியிடம்|AI வணிகக் கருவிகள்|சேமித்த திட்டங்கள் மற்றும் முடிவுகள்|தொடக்கத்தின் அனைத்தும்|கூடுதல் வணிகத் திறன்|முன்னுரிமை ஆதரவு|தொடக்கத்தைத் தேர்ந்தெடு|வளர்ச்சியைத் தேர்ந்தெடு|பாதுகாப்பான கட்டணத்திற்குத் தொடரவும்|தெளிவுக்காக வடிவமைப்பு|கட்டுப்பாட்டை இழக்காமல் எளிமை விரும்பும் வணிகங்களுக்கு.|பாதுகாப்பான கணக்கு அணுகல்|திட்டங்கள் ஒழுங்காக இருக்கும்|கட்டுப்பாடு உங்களிடம்|வணிகத்துடன் வளர உருவாக்கப்பட்டது|வணிகத்தை எளிதாக்கத் தயாரா?|தெரிந்ததிலிருந்து தொடங்குங்கள். அடுத்ததை Buzypeezy ஒழுங்குபடுத்தும்.|வணிகத்தை எளிதாக்க உருவாக்கப்பட்டது.|தனியுரிமைக் கொள்கை|சேவை விதிமுறைகள்|பணத்தைத் திரும்பப் பெறுதல் மற்றும் ரத்து|தொடர்பு மற்றும் ஆதரவு".split("|"),
  te: "మీకు తెలిసిన దాని నుంచి వ్యాపారానికి అవసరమైన దాని వరకు.|మీ వ్యాపారం గురించి చెప్పండి|సహజంగా రాయండి. సాంకేతిక పదాలు అవసరం లేదు.|Buzypeezy మీ అవసరాన్ని అర్థం చేసుకుంటుంది|లక్ష్యాలు, కస్టమర్లు, దిశ స్వయంచాలకంగా క్రమబద్ధమవుతాయి.|మీ వ్యాపార వ్యవస్థ తయారవుతుంది|ఒకే వ్యాపార అవగాహనతో అన్నీ కలిసి పనిచేస్తాయి.|సమీక్షించి, మెరుగుపరచి ప్రారంభించండి|నియంత్రణ మీ వద్దే; తర్వాత మార్చవచ్చు.|సహజంగా ప్రారంభించండి|మీకు ఇప్పటికే తెలిసిన దానితో ప్రారంభించండి.|వ్యూహ పత్రం అవసరం లేదు. మీ మాటల్లో Buzypeezyకి వ్యాపారం చెప్పండి.|Buzypeezyకి మీ వ్యాపారం చెప్పండి|“నేను బెంగళూరులో లగ్జరీ రియల్ ఎస్టేట్ కంపెనీ నడుపుతున్నాను; గంభీరమైన కొనుగోలుదారులను ఆకర్షించాలనుకుంటున్నాను.”|Buzypeezyతో కొనసాగండి|అనుసంధాన ఫలితాలు|మీ వ్యాపార పూర్తి చిత్రాన్ని చూడండి.|అన్నీ ఒకే వ్యాపార అవగాహనకు అనుసంధానమై ప్రతి చర్యకు సందర్భాన్ని ఇస్తాయి.|మీ దిశ|డిజిటల్ ఉనికి|కస్టమర్ వృద్ధి వ్యవస్థ|వ్యాపార కంటెంట్|పనితీరు అవలోకనం|సిఫార్సు చేసిన తదుపరి చర్యలు|సరళమైన ప్లాన్‌లు|మీ వ్యాపారానికి సరిపోయేదాన్ని ఎంచుకోండి.|నేడు అవసరమైన సామర్థ్యంతో మొదలై వృద్ధితో ముందుకు సాగండి.|ఎక్కువగా ఎంచుకున్నది|ప్రారంభం|వృద్ధి|/నెల|/నెల|వృద్ధి కోసం పూర్తి Buzypeezy కార్యస్థలం.|స్థిరపడిన వ్యాపారాలు, బృందాలకు అధిక సామర్థ్యం.|అనుసంధాన కార్యస్థలం|AI వ్యాపార సాధనాలు|భద్రపరిచిన ప్రాజెక్టులు, ఫలితాలు|ప్రారంభంలోని అన్నీ|అధిక వ్యాపార సామర్థ్యం|ప్రాధాన్య మద్దతు|ప్రారంభం ఎంచుకోండి|వృద్ధి ఎంచుకోండి|సురక్షిత చెల్లింపుకు కొనసాగండి|స్పష్టత కోసం రూపొందించబడింది|నియంత్రణ కోల్పోకుండా సరళత కోరే వ్యాపారాల కోసం.|సురక్షిత ఖాతా ప్రవేశం|ప్రాజెక్టులు క్రమంగా ఉంటాయి|నియంత్రణ మీ వద్దే|మీ వ్యాపారంతో పెరిగేలా నిర్మితం|వ్యాపారాన్ని సులభం చేయడానికి సిద్ధమా?|తెలిసిన దానితో మొదలవండి. తదుపరి దాన్ని Buzypeezy క్రమబద్ధం చేస్తుంది.|వ్యాపారాన్ని సరళం చేయడానికి నిర్మితం.|గోప్యతా విధానం|సేవా నిబంధనలు|వాపసు మరియు రద్దు|సంప్రదింపు మరియు మద్దతు".split("|"),
  ml: "നിങ്ങൾക്കറിയുന്നതിൽ നിന്ന് ബിസിനസിന് വേണ്ടതിലേക്ക്.|നിങ്ങളുടെ ബിസിനസിനെക്കുറിച്ച് പറയൂ|സ്വാഭാവികമായി എഴുതൂ. സാങ്കേതിക പദങ്ങൾ വേണ്ട.|Buzypeezy നിങ്ങളുടെ ആവശ്യം മനസ്സിലാക്കുന്നു|ലക്ഷ്യങ്ങളും ഉപഭോക്താക്കളും ദിശയും സ്വയം ക്രമീകരിക്കും.|നിങ്ങളുടെ ബിസിനസ് സംവിധാനം സൃഷ്ടിക്കും|ഒരേ ബിസിനസ് ധാരണയിൽ നിന്ന് എല്ലാം ഒരുമിച്ച് പ്രവർത്തിക്കും.|അവലോകനം ചെയ്ത് മെച്ചപ്പെടുത്തി ആരംഭിക്കൂ|നിയന്ത്രണം നിങ്ങളിൽ; പിന്നീട് മാറ്റാം.|സ്വാഭാവികമായി തുടങ്ങൂ|നിങ്ങൾക്ക് അറിയുന്നതിൽ നിന്ന് തുടങ്ങൂ.|തന്ത്രരേഖ വേണ്ട. സ്വന്തം വാക്കുകളിൽ Buzypeezyയോട് ബിസിനസ് പറയൂ.|Buzypeezyയോട് നിങ്ങളുടെ ബിസിനസ് പറയൂ|“ഞാൻ ബെംഗളൂരുവിൽ ആഡംബര റിയൽ എസ്റ്റേറ്റ് കമ്പനി നടത്തുന്നു; ഗൗരവമുള്ള വാങ്ങുന്നവരെ ആകർഷിക്കണം.”|Buzypeezyയോടൊപ്പം തുടരൂ|ബന്ധിപ്പിച്ച ഫലങ്ങൾ|ബിസിനസിന്റെ പൂർണ്ണ ചിത്രം കാണൂ.|എല്ലാം ഒരേ ബിസിനസ് ധാരണയുമായി ബന്ധിച്ച് ഓരോ പ്രവർത്തനത്തിനും സാഹചര്യം നൽകുന്നു.|നിങ്ങളുടെ ദിശ|ഡിജിറ്റൽ സാന്നിധ്യം|ഉപഭോക്തൃ വളർച്ചാ സംവിധാനം|ബിസിനസ് ഉള്ളടക്കം|പ്രകടന അവലോകനം|ശുപാർശ ചെയ്ത അടുത്ത നടപടികൾ|ലളിതമായ പ്ലാനുകൾ|ബിസിനസിന് അനുയോജ്യമായത് തിരഞ്ഞെടുക്കൂ.|ഇന്നാവശ്യമായ ശേഷിയിൽ തുടങ്ങി വളർച്ചയ്ക്കൊപ്പം മുന്നേറൂ.|ഏറ്റവും തിരഞ്ഞെടുത്തത്|തുടക്കം|വളർച്ച|/മാസം|/മാസം|വളർച്ചയ്ക്കുള്ള സമ്പൂർണ്ണ Buzypeezy പ്രവർത്തനസ്ഥലം.|സ്ഥാപിത ബിസിനസുകൾക്കും ടീമുകൾക്കും കൂടുതൽ ശേഷി.|ബന്ധിപ്പിച്ച പ്രവർത്തനസ്ഥലം|AI ബിസിനസ് ഉപകരണങ്ങൾ|സംരക്ഷിച്ച പ്രോജക്റ്റുകളും ഫലങ്ങളും|തുടക്കത്തിലെ എല്ലാം|കൂടുതൽ ബിസിനസ് ശേഷി|മുൻഗണനാ പിന്തുണ|തുടക്കം തിരഞ്ഞെടുക്കൂ|വളർച്ച തിരഞ്ഞെടുക്കൂ|സുരക്ഷിത പേയ്‌മെന്റിലേക്ക് തുടരൂ|വ്യക്തതയ്ക്കായി രൂപകൽപ്പന|നിയന്ത്രണം നഷ്ടമാക്കാതെ ലാളിത്യം ആഗ്രഹിക്കുന്ന ബിസിനസുകൾക്കായി.|സുരക്ഷിത അക്കൗണ്ട് പ്രവേശനം|പ്രോജക്റ്റുകൾ ക്രമത്തിലായിരിക്കും|നിയന്ത്രണം നിങ്ങളിൽ|ബിസിനസിനൊപ്പം വളരാൻ നിർമ്മിച്ചത്|ബിസിനസ് എളുപ്പമാക്കാൻ തയ്യാറാണോ?|അറിയുന്നതിൽ നിന്ന് തുടങ്ങൂ. അടുത്തത് Buzypeezy ക്രമീകരിക്കും.|ബിസിനസ് ലളിതമാക്കാൻ നിർമ്മിച്ചത്.|സ്വകാര്യതാ നയം|സേവന നിബന്ധനകൾ|റീഫണ്ടും റദ്ദാക്കലും|ബന്ധപ്പെടലും പിന്തുണയും".split("|"),
};

type TranslationKey = keyof typeof translations.en | (typeof extraKeys)[number];

export function TranslatedText({
  id,
}: {
  id: TranslationKey;
}) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("buzypeezy-language") as Language | null;

    if (saved && saved in translations) {
      setLanguage(saved);
    }

    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const nextLanguage = customEvent.detail as Language;

      if (nextLanguage in translations) {
        setLanguage(nextLanguage);
      }
    };

    window.addEventListener(
      "buzypeezy-language-change",
      handleChange
    );

    return () => {
      window.removeEventListener(
        "buzypeezy-language-change",
        handleChange
      );
    };
  }, []);

  if (id in translations.en) {
    const baseKey = id as keyof typeof translations.en;
    return <>{translations[language][baseKey] ?? translations.en[baseKey]}</>;
  }

  const extraIndex = extraKeys.indexOf(id as (typeof extraKeys)[number]);
  return <>{extraValues[language][extraIndex] ?? extraValues.en[extraIndex]}</>;
}
