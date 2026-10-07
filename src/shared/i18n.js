/* Original Scribble interface labels. Plain text only; callers own DOM escaping. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScribbleI18n = api;
})(globalThis, function () {
  'use strict';
  const keys = ['nav.home','nav.notes','nav.transcribe','nav.shortcuts','nav.command','nav.dictionary','nav.files','nav.speechModels','nav.languageModels','nav.tones','nav.memory','nav.settings','nav.help','settings.general','settings.microphone','settings.languages','settings.recording','settings.shortcuts','settings.permissions','settings.privacy','settings.developer','action.save','action.cancel','action.copy','action.edit','action.delete','action.export','action.open','search.workspace','action.dictate','state.allowed','state.notAllowed','state.ready','action.start','action.stop','action.pause','action.resume'];
  // These translations were authored for Scribble, independently of other apps.
  const rows = {
    en: 'Home|Notes|Transcribe|Voice shortcuts|Command Mode|Dictionary|File tools|Speech models|Language models|Tones|Memory|Settings|Help|General|Microphone|Languages|Recording|Shortcuts|Permissions|Privacy & data|Developer|Save|Cancel|Copy|Edit|Delete|Export|Open|Search workspace|Dictate|Allowed|Not yet allowed|Ready|Start|Stop|Pause|Resume',
    bg: 'Начало|Бележки|Транскрибиране|Гласови преки пътища|Режим за команди|Речник|Инструменти за файлове|Модели за разпознаване на реч|Езикови модели|Стилове|Памет|Настройки|Помощ|Общи|Микрофон|Езици|Запис|Преки пътища|Разрешения|Поверителност и данни|За разработчици|Запазване|Отказ|Копиране|Редактиране|Изтриване|Експортиране|Отваряне|Търсене в работното пространство|Диктуване|Разрешено|Все още не е разрешено|Готово|Начало|Спиране|Пауза|Продължаване',
    cs: 'Domů|Poznámky|Přepis|Hlasové zkratky|Režim příkazů|Slovník|Nástroje pro soubory|Modely rozpoznávání řeči|Jazykové modely|Styly|Paměť|Nastavení|Nápověda|Obecné|Mikrofon|Jazyky|Nahrávání|Zkratky|Oprávnění|Soukromí a data|Pro vývojáře|Uložit|Zrušit|Kopírovat|Upravit|Smazat|Exportovat|Otevřít|Hledat v pracovním prostoru|Diktovat|Povoleno|Zatím nepovoleno|Připraveno|Spustit|Zastavit|Pozastavit|Pokračovat',
    de: 'Startseite|Notizen|Transkribieren|Sprachkurzbefehle|Befehlsmodus|Wörterbuch|Dateiwerkzeuge|Spracherkennungsmodelle|Sprachmodelle|Schreibstile|Gedächtnis|Einstellungen|Hilfe|Allgemein|Mikrofon|Sprachen|Aufnahme|Kurzbefehle|Berechtigungen|Datenschutz und Daten|Entwickler|Speichern|Abbrechen|Kopieren|Bearbeiten|Löschen|Exportieren|Öffnen|Arbeitsbereich durchsuchen|Diktieren|Erlaubt|Noch nicht erlaubt|Bereit|Starten|Stoppen|Pausieren|Fortsetzen',
    es: 'Inicio|Notas|Transcribir|Atajos de voz|Modo de comandos|Diccionario|Herramientas de archivos|Modelos de reconocimiento de voz|Modelos de lenguaje|Estilos|Memoria|Ajustes|Ayuda|General|Micrófono|Idiomas|Grabación|Atajos|Permisos|Privacidad y datos|Desarrollador|Guardar|Cancelar|Copiar|Editar|Eliminar|Exportar|Abrir|Buscar en el espacio de trabajo|Dictar|Permitido|Aún no permitido|Listo|Iniciar|Detener|Pausar|Reanudar',
    fr: 'Accueil|Notes|Transcrire|Raccourcis vocaux|Mode commandes|Dictionnaire|Outils de fichiers|Modèles de reconnaissance vocale|Modèles de langage|Styles|Mémoire|Paramètres|Aide|Général|Microphone|Langues|Enregistrement|Raccourcis|Autorisations|Confidentialité et données|Développeur|Enregistrer|Annuler|Copier|Modifier|Supprimer|Exporter|Ouvrir|Rechercher dans l’espace de travail|Dicter|Autorisé|Pas encore autorisé|Prêt|Démarrer|Arrêter|Mettre en pause|Reprendre',
    it: 'Home|Note|Trascrivi|Scorciatoie vocali|Modalità comandi|Dizionario|Strumenti per i file|Modelli di riconoscimento vocale|Modelli linguistici|Stili|Memoria|Impostazioni|Aiuto|Generali|Microfono|Lingue|Registrazione|Scorciatoie|Autorizzazioni|Privacy e dati|Sviluppatore|Salva|Annulla|Copia|Modifica|Elimina|Esporta|Apri|Cerca nell’area di lavoro|Detta|Consentito|Non ancora consentito|Pronto|Avvia|Ferma|Pausa|Riprendi',
    ja: 'ホーム|ノート|文字起こし|音声ショートカット|コマンドモード|辞書|ファイルツール|音声認識モデル|言語モデル|文体|メモリ|設定|ヘルプ|一般|マイク|言語|録音|ショートカット|アクセス許可|プライバシーとデータ|開発者向け|保存|キャンセル|コピー|編集|削除|エクスポート|開く|ワークスペースを検索|音声入力|許可済み|未許可|準備完了|開始|停止|一時停止|再開',
    ko: '홈|노트|음성 전사|음성 단축키|명령 모드|사전|파일 도구|음성 인식 모델|언어 모델|문체|메모리|설정|도움말|일반|마이크|언어|녹음|단축키|권한|개인정보 및 데이터|개발자|저장|취소|복사|편집|삭제|내보내기|열기|작업 공간 검색|받아쓰기|허용됨|아직 허용되지 않음|준비됨|시작|중지|일시 정지|계속',
    pl: 'Strona główna|Notatki|Transkrypcja|Skróty głosowe|Tryb poleceń|Słownik|Narzędzia plików|Modele rozpoznawania mowy|Modele językowe|Style|Pamięć|Ustawienia|Pomoc|Ogólne|Mikrofon|Języki|Nagrywanie|Skróty|Uprawnienia|Prywatność i dane|Dla programistów|Zapisz|Anuluj|Kopiuj|Edytuj|Usuń|Eksportuj|Otwórz|Przeszukaj obszar roboczy|Dyktuj|Dozwolone|Jeszcze niedozwolone|Gotowe|Rozpocznij|Zatrzymaj|Wstrzymaj|Wznów',
    pt: 'Início|Notas|Transcrever|Atalhos de voz|Modo de comandos|Dicionário|Ferramentas de arquivos|Modelos de reconhecimento de fala|Modelos de linguagem|Estilos|Memória|Configurações|Ajuda|Geral|Microfone|Idiomas|Gravação|Atalhos|Permissões|Privacidade e dados|Desenvolvedor|Salvar|Cancelar|Copiar|Editar|Excluir|Exportar|Abrir|Pesquisar no espaço de trabalho|Ditar|Permitido|Ainda não permitido|Pronto|Iniciar|Parar|Pausar|Retomar',
    ru: 'Главная|Заметки|Расшифровка|Голосовые сочетания|Режим команд|Словарь|Инструменты для файлов|Модели распознавания речи|Языковые модели|Стили|Память|Настройки|Справка|Общие|Микрофон|Языки|Запись|Сочетания клавиш|Разрешения|Конфиденциальность и данные|Для разработчиков|Сохранить|Отмена|Копировать|Изменить|Удалить|Экспортировать|Открыть|Поиск в рабочем пространстве|Диктовать|Разрешено|Пока не разрешено|Готово|Начать|Остановить|Пауза|Продолжить',
    sv: 'Hem|Anteckningar|Transkribera|Röstgenvägar|Kommandoläge|Ordbok|Filverktyg|Taligenkänningsmodeller|Språkmodeller|Stilar|Minne|Inställningar|Hjälp|Allmänt|Mikrofon|Språk|Inspelning|Genvägar|Behörigheter|Integritet och data|Utvecklare|Spara|Avbryt|Kopiera|Redigera|Ta bort|Exportera|Öppna|Sök i arbetsytan|Diktera|Tillåtet|Ännu inte tillåtet|Redo|Starta|Stoppa|Pausa|Återuppta',
    tr: 'Ana sayfa|Notlar|Yazıya dök|Sesli kısayollar|Komut modu|Sözlük|Dosya araçları|Konuşma tanıma modelleri|Dil modelleri|Üsluplar|Bellek|Ayarlar|Yardım|Genel|Mikrofon|Diller|Kayıt|Kısayollar|İzinler|Gizlilik ve veriler|Geliştirici|Kaydet|İptal|Kopyala|Düzenle|Sil|Dışa aktar|Aç|Çalışma alanında ara|Dikte et|İzin verildi|Henüz izin verilmedi|Hazır|Başlat|Durdur|Duraklat|Devam et',
    uk: 'Головна|Нотатки|Транскрибування|Голосові скорочення|Режим команд|Словник|Інструменти для файлів|Моделі розпізнавання мовлення|Мовні моделі|Стилі|Пам’ять|Налаштування|Довідка|Загальні|Мікрофон|Мови|Запис|Сполучення клавіш|Дозволи|Конфіденційність і дані|Для розробників|Зберегти|Скасувати|Копіювати|Редагувати|Видалити|Експортувати|Відкрити|Пошук у робочому просторі|Диктувати|Дозволено|Ще не дозволено|Готово|Почати|Зупинити|Пауза|Продовжити',
    vi: 'Trang chủ|Ghi chú|Chép lời|Phím tắt giọng nói|Chế độ lệnh|Từ điển|Công cụ tệp|Mô hình nhận dạng giọng nói|Mô hình ngôn ngữ|Văn phong|Bộ nhớ|Cài đặt|Trợ giúp|Chung|Micrô|Ngôn ngữ|Ghi âm|Phím tắt|Quyền truy cập|Quyền riêng tư và dữ liệu|Nhà phát triển|Lưu|Hủy|Sao chép|Chỉnh sửa|Xóa|Xuất|Mở|Tìm trong không gian làm việc|Đọc chính tả|Đã cho phép|Chưa cho phép|Sẵn sàng|Bắt đầu|Dừng|Tạm dừng|Tiếp tục',
    zh: '首页|笔记|转录|语音快捷操作|命令模式|词典|文件工具|语音识别模型|语言模型|文风|记忆|设置|帮助|常规|麦克风|语言|录音|快捷键|权限|隐私与数据|开发者|保存|取消|复制|编辑|删除|导出|打开|搜索工作区|语音输入|已允许|尚未允许|就绪|开始|停止|暂停|继续',
    'zh-TW': '首頁|筆記|轉錄|語音快捷操作|命令模式|辭典|檔案工具|語音辨識模型|語言模型|文風|記憶|設定|說明|一般|麥克風|語言|錄音|快捷鍵|權限|隱私與資料|開發者|儲存|取消|複製|編輯|刪除|匯出|開啟|搜尋工作區|語音輸入|已允許|尚未允許|就緒|開始|停止|暫停|繼續'
  };
  const surfaceKeys = ['tray.open','tray.startDictation','tray.startNote','tray.pasteLast','tray.quit','tray.tagline','overlay.ready','mode.dictation','mode.command','mode.note','state.recording','state.processing','state.paused','state.muted','overlay.cancelRecording','overlay.stopRecording','overlay.chooseTone','tone.automatic','overlay.microphoneLevel'];
  const surfaceRows = {
    en: 'Open Scribble|Start dictation|Start a note|Paste last dictation|Quit Scribble|Speak your mind|Ready to listen|Dictation|Command|Note|Recording|Processing|Paused|Muted|Cancel recording|Stop recording|Choose tone|Automatic tone|Microphone level',
    bg: 'Отваряне на Scribble|Начало на диктуване|Нова бележка|Поставяне на последната диктовка|Изход от Scribble|Изразете мислите си|Готово за слушане|Диктуване|Команда|Бележка|Записва се|Обработка|На пауза|Без звук|Отказ от записа|Спиране на записа|Избор на стил|Автоматичен стил|Ниво на микрофона',
    cs: 'Otevřít Scribble|Spustit diktování|Začít poznámku|Vložit poslední diktování|Ukončit Scribble|Řekněte, co máte na mysli|Připraveno naslouchat|Diktování|Příkaz|Poznámka|Nahrávání|Zpracování|Pozastaveno|Ztlumeno|Zrušit nahrávání|Zastavit nahrávání|Vybrat styl|Automatický styl|Úroveň mikrofonu',
    de: 'Scribble öffnen|Diktat starten|Notiz beginnen|Letztes Diktat einfügen|Scribble beenden|Sprich deine Gedanken aus|Bereit zum Zuhören|Diktat|Befehl|Notiz|Aufnahme läuft|Verarbeitung|Pausiert|Stummgeschaltet|Aufnahme abbrechen|Aufnahme stoppen|Schreibstil wählen|Automatischer Schreibstil|Mikrofonpegel',
    es: 'Abrir Scribble|Iniciar dictado|Iniciar una nota|Pegar el último dictado|Salir de Scribble|Expresa tus ideas|Listo para escuchar|Dictado|Comando|Nota|Grabando|Procesando|En pausa|Silenciado|Cancelar grabación|Detener grabación|Elegir estilo|Estilo automático|Nivel del micrófono',
    fr: 'Ouvrir Scribble|Démarrer la dictée|Commencer une note|Coller la dernière dictée|Quitter Scribble|Exprimez vos idées|Prêt à écouter|Dictée|Commande|Note|Enregistrement en cours|Traitement en cours|En pause|Microphone coupé|Annuler l’enregistrement|Arrêter l’enregistrement|Choisir un style|Style automatique|Niveau du microphone',
    it: 'Apri Scribble|Avvia dettatura|Inizia una nota|Incolla l’ultima dettatura|Esci da Scribble|Esprimi i tuoi pensieri|Pronto ad ascoltare|Dettatura|Comando|Nota|Registrazione in corso|Elaborazione in corso|In pausa|Microfono disattivato|Annulla registrazione|Ferma registrazione|Scegli stile|Stile automatico|Livello del microfono',
    ja: 'Scribbleを開く|音声入力を開始|ノートを開始|最後の音声入力を貼り付け|Scribbleを終了|思いを言葉に|聞き取り準備完了|音声入力|コマンド|ノート|録音中|処理中|一時停止中|ミュート中|録音をキャンセル|録音を停止|文体を選択|自動の文体|マイク音量',
    ko: 'Scribble 열기|받아쓰기 시작|노트 시작|마지막 받아쓰기 붙여넣기|Scribble 종료|생각을 말해 보세요|들을 준비가 되었습니다|받아쓰기|명령|노트|녹음 중|처리 중|일시 정지됨|음소거됨|녹음 취소|녹음 중지|문체 선택|자동 문체|마이크 음량',
    pl: 'Otwórz Scribble|Rozpocznij dyktowanie|Rozpocznij notatkę|Wklej ostatnie dyktowanie|Zakończ Scribble|Wyraź swoje myśli|Gotowe do słuchania|Dyktowanie|Polecenie|Notatka|Nagrywanie|Przetwarzanie|Wstrzymano|Wyciszono|Anuluj nagrywanie|Zatrzymaj nagrywanie|Wybierz styl|Styl automatyczny|Poziom mikrofonu',
    pt: 'Abrir Scribble|Iniciar ditado|Iniciar uma nota|Colar o último ditado|Sair do Scribble|Expresse suas ideias|Pronto para ouvir|Ditado|Comando|Nota|Gravando|Processando|Pausado|Silenciado|Cancelar gravação|Parar gravação|Escolher estilo|Estilo automático|Nível do microfone',
    ru: 'Открыть Scribble|Начать диктовку|Начать заметку|Вставить последнюю диктовку|Выйти из Scribble|Выразите свои мысли|Готово к прослушиванию|Диктовка|Команда|Заметка|Идёт запись|Обработка|Приостановлено|Звук выключен|Отменить запись|Остановить запись|Выбрать стиль|Автоматический стиль|Уровень микрофона',
    sv: 'Öppna Scribble|Starta diktering|Starta en anteckning|Klistra in senaste dikteringen|Avsluta Scribble|Säg vad du tänker|Redo att lyssna|Diktering|Kommando|Anteckning|Spelar in|Bearbetar|Pausad|Ljud av|Avbryt inspelning|Stoppa inspelning|Välj stil|Automatisk stil|Mikrofonnivå',
    tr: 'Scribble’ı aç|Dikteyi başlat|Not başlat|Son dikteyi yapıştır|Scribble’dan çık|Düşüncelerini dile getir|Dinlemeye hazır|Dikte|Komut|Not|Kaydediliyor|İşleniyor|Duraklatıldı|Sesi kapalı|Kaydı iptal et|Kaydı durdur|Üslup seç|Otomatik üslup|Mikrofon seviyesi',
    uk: 'Відкрити Scribble|Почати диктування|Почати нотатку|Вставити останнє диктування|Вийти зі Scribble|Висловіть свої думки|Готово до прослуховування|Диктування|Команда|Нотатка|Триває запис|Обробка|Призупинено|Звук вимкнено|Скасувати запис|Зупинити запис|Вибрати стиль|Автоматичний стиль|Рівень мікрофона',
    vi: 'Mở Scribble|Bắt đầu đọc chính tả|Bắt đầu ghi chú|Dán bản đọc chính tả gần nhất|Thoát Scribble|Nói lên suy nghĩ của bạn|Sẵn sàng lắng nghe|Đọc chính tả|Lệnh|Ghi chú|Đang ghi âm|Đang xử lý|Đã tạm dừng|Đã tắt tiếng|Hủy ghi âm|Dừng ghi âm|Chọn văn phong|Văn phong tự động|Mức âm micrô',
    zh: '打开 Scribble|开始语音输入|开始笔记|粘贴上次语音输入|退出 Scribble|说出你的想法|准备聆听|语音输入|命令|笔记|录音中|处理中|已暂停|已静音|取消录音|停止录音|选择文风|自动文风|麦克风音量',
    'zh-TW': '開啟 Scribble|開始語音輸入|開始筆記|貼上上次語音輸入|結束 Scribble|說出你的想法|準備聆聽|語音輸入|命令|筆記|錄音中|處理中|已暫停|已靜音|取消錄音|停止錄音|選擇文風|自動文風|麥克風音量'
  };
  const recordingKeys = ['overlay.starting','overlay.listening','overlay.transcribing','overlay.failed','overlay.level'];
  const recordingRows = {
    en:'Starting microphone…|Listening…|Transcribing…|Recording failed|{level}%',
    bg:'Стартиране на микрофона…|Слушане…|Транскрибиране…|Записът не успя|{level}%',
    cs:'Spouštění mikrofonu…|Poslouchám…|Přepisování…|Nahrávání se nezdařilo|{level}%',
    de:'Mikrofon wird gestartet…|Höre zu…|Transkription läuft…|Aufnahme fehlgeschlagen|{level}%',
    es:'Iniciando micrófono…|Escuchando…|Transcribiendo…|Error de grabación|{level}%',
    fr:'Démarrage du microphone…|À l’écoute…|Transcription en cours…|Échec de l’enregistrement|{level}%',
    it:'Avvio del microfono…|In ascolto…|Trascrizione in corso…|Registrazione non riuscita|{level}%',
    ja:'マイクを起動中…|聞き取り中…|文字起こし中…|録音に失敗しました|{level}%',
    ko:'마이크 시작 중…|듣는 중…|전사 중…|녹음 실패|{level}%',
    pl:'Uruchamianie mikrofonu…|Słucham…|Transkrypcja trwa…|Nagrywanie nie powiodło się|{level}%',
    pt:'Iniciando microfone…|Ouvindo…|Transcrevendo…|Falha na gravação|{level}%',
    ru:'Запуск микрофона…|Слушаю…|Расшифровка…|Не удалось записать|{level}%',
    sv:'Startar mikrofonen…|Lyssnar…|Transkriberar…|Inspelningen misslyckades|{level}%',
    tr:'Mikrofon başlatılıyor…|Dinleniyor…|Yazıya dökülüyor…|Kayıt başarısız oldu|{level}%',
    uk:'Запуск мікрофона…|Слухаю…|Транскрибування…|Не вдалося записати|{level}%',
    vi:'Đang khởi động micrô…|Đang lắng nghe…|Đang chép lời…|Ghi âm thất bại|{level}%',
    zh:'正在启动麦克风…|正在聆听…|正在转录…|录音失败|{level}%',
    'zh-TW':'正在啟動麥克風…|正在聆聽…|正在轉錄…|錄音失敗|{level}%'
  };
  const names = {en:'English',bg:'Български',cs:'Čeština',de:'Deutsch',es:'Español',fr:'Français',it:'Italiano',ja:'日本語',ko:'한국어',pl:'Polski',pt:'Português',ru:'Русский',sv:'Svenska',tr:'Türkçe',uk:'Українська',vi:'Tiếng Việt',zh:'简体中文','zh-TW':'繁體中文'};
  const catalogues = Object.create(null);
  for (const [id, row] of Object.entries(rows)) {
    const values = row.split('|'), surfaceValues = surfaceRows[id].split('|'), recordingValues = recordingRows[id].split('|');
    if (values.length !== keys.length) throw new Error(`Invalid original catalogue: ${id}`);
    if (surfaceValues.length !== surfaceKeys.length) throw new Error(`Invalid original surface catalogue: ${id}`);
    if (recordingValues.length !== recordingKeys.length) throw new Error(`Invalid original recording catalogue: ${id}`);
    catalogues[id] = Object.freeze(Object.fromEntries([...keys.map((key,index)=>[key,values[index]]), ...surfaceKeys.map((key,index)=>[key,surfaceValues[index]]), ...recordingKeys.map((key,index)=>[key,recordingValues[index]])]));
  }
  Object.freeze(catalogues);
  const locales = Object.freeze(Object.keys(rows).map(id=>Object.freeze({id,name:names[id],formatLocale:id==='pt'?'pt-BR':id==='zh'?'zh-CN':id,dir:'ltr'})));
  function resolveLocale(locale) {
    if (typeof locale !== 'string') return 'en';
    return locales.find(item=>item.id.toLowerCase()===locale.toLowerCase())?.id || 'en';
  }
  function formattingLocale(locale) { return locales.find(item=>item.id===resolveLocale(locale)).formatLocale; }
  function interpolate(text, params) {
    return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(token,key)=> params && Object.prototype.hasOwnProperty.call(params,key) ? String(params[key]) : token);
  }
  function t(locale,key,params={}) {
    if (typeof key !== 'string') return '';
    const catalogue=catalogues[resolveLocale(locale)];
    const value=Object.prototype.hasOwnProperty.call(catalogue,key)?catalogue[key]:Object.prototype.hasOwnProperty.call(catalogues.en,key)?catalogues.en[key]:key;
    return interpolate(value,params);
  }
  function formatDate(locale,value,options={}) {
    const date=value instanceof Date?value:new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(formattingLocale(locale),options).format(date);
  }
  function formatNumber(locale,value,options={}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    return new Intl.NumberFormat(formattingLocale(locale),options).format(value);
  }
  function plural(locale,count,forms,params={}) {
    if (typeof count !== 'number' || !Number.isFinite(count) || !forms || typeof forms !== 'object') return '';
    const category=new Intl.PluralRules(formattingLocale(locale)).select(count);
    const text=Object.prototype.hasOwnProperty.call(forms,category)?forms[category]:Object.prototype.hasOwnProperty.call(forms,'other')?forms.other:'';
    if (typeof text !== 'string') return '';
    return interpolate(text,{...params,count:formatNumber(locale,count)});
  }
  return Object.freeze({locales,catalogues,resolveLocale,formattingLocale,t,formatDate,formatNumber,plural});
});
