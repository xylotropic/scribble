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
  const names = {en:'English',bg:'Български',cs:'Čeština',de:'Deutsch',es:'Español',fr:'Français',it:'Italiano',ja:'日本語',ko:'한국어',pl:'Polski',pt:'Português',ru:'Русский',sv:'Svenska',tr:'Türkçe',uk:'Українська',vi:'Tiếng Việt',zh:'简体中文','zh-TW':'繁體中文'};
  const catalogues = Object.create(null);
  for (const [id, row] of Object.entries(rows)) {
    const values = row.split('|');
    if (values.length !== keys.length) throw new Error(`Invalid original catalogue: ${id}`);
    catalogues[id] = Object.freeze(Object.fromEntries(keys.map((key,index)=>[key,values[index]])));
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
