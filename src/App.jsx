import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Rss, Newspaper, AlertCircle, Loader2, Trash2, Volume2, VolumeX } from 'lucide-react';
import { fetchRSS } from './services/rssService';
import ArticleCard from './components/ArticleCard';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_FEEDS = [ 
  { name: 'Clarin', url: 'https://www.clarin.com/rss/lo-ultimo/'},
  { name: 'Ole', url: 'http://www.ole.com.ar/rss/ultimas-noticias/' },
  { name: 'Perfil', url: 'https://www.perfil.com/feed' },
  { name : 'Pagina 12', url: 'https://www.pagina12.com.ar/arc/outboundfeeds/rss/portada'},
 
];

function App() {
  const [feeds, setFeeds] = useState(DEFAULT_FEEDS);
  const [activeFeedUrl, setActiveFeedUrl] = useState(feeds[0]?.url || '');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [showAddFeed, setShowAddFeed] = useState(false);
  
  // Audio & Voice State
  const [currentArticle, setCurrentArticle] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const utteranceRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const allVoices = synth.getVoices();
      // Filter for Spanish voices AND Siri voices
      const filtered = allVoices.filter(v => 
        v.lang.startsWith('es') || // Spanish voices
        v.name.toLowerCase().includes('siri') // Siri voices
      );
      setVoices(filtered);
      
      // Default to Argentine Spanish if available, otherwise general Spanish, otherwise Siri
      if (!selectedVoiceName && filtered.length > 0) {
        const argentineEs = filtered.find(v => v.lang.includes('AR'));
        const generalEs = filtered.find(v => v.lang.startsWith('es'));
        const siriVoice = filtered.find(v => v.name.toLowerCase().includes('siri'));
        setSelectedVoiceName(argentineEs ? argentineEs.name : (generalEs ? generalEs.name : (siriVoice ? siriVoice.name : filtered[0].name)));
      }
    };

    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceName]);

  const playNewsBumper = () => {
    return new Promise((resolve) => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume context if suspended (iOS requirement)
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        
        const playNote = (freq, startTime, duration) => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.08, startTime); // Reduced volume for iOS
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
          } catch (e) {
            console.warn('Error playing note:', e);
          }
        };

        const now = audioCtx.currentTime;
        playNote(600, now, 0.1);
        playNote(600, now + 0.15, 0.1);
        playNote(800, now + 0.3, 0.4); // Shorter duration

        setTimeout(() => {
          audioCtx.close().catch(() => {});
          resolve();
        }, 700); // Shorter timeout
      } catch (error) {
        console.warn('Bumper sound not available:', error);
        resolve(); // Always resolve even on error
      }
    });
  };

  // Handle global audio logic
  const toggleGlobalSpeech = async (article) => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (currentArticle?.link === article.link && isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    synth.cancel();
    setCurrentArticle(article);
    
    // Clean text
    const cleanSnippet = article.contentSnippet || article.content || '';
    let textForTTS = cleanSnippet.replace(/<[^>]*>?/gm, '');
    
    // Remove common promotional phrases from RSS feeds
    textForTTS = textForTTS
      .replace(/leer más\.?$/i, '')
      .replace(/seguir leyendo\.?$/i, '')
      .replace(/ver más\.?$/i, '')
      .replace(/continuar leyendo\.?$/i, '')
      .replace(/\[…\]/g, '')
      .replace(/\.\.\.\.+/g, '...') // Normalize multiple dots
      .replace(/\.\.\.\s*$/g, '')
      
    // Remove URLs and web references
    textForTTS = textForTTS
      .replace(/https?:\/\/[^\s]+/gi, '') // Remove URLs starting with http/https
      .replace(/www\.[^\s]+/gi, '') // Remove URLs starting with www
      .replace(/\b[a-z0-9.-]+\.(com|net|org|ar|es|info|io|co)\b/gi, '') // Remove domain names
      .replace(/\b(ver en|visitar|página|sitio web|web|website)\b/gi, '') // Remove web references
      
    // Remove special characters and clean up
    textForTTS = textForTTS
      .replace(/[©®™]/g, '') // Remove copyright symbols
      .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
      .replace(/\s{2,}/g, ' ') // Remove multiple spaces
      .trim();
    
    const cleanText = textForTTS.substring(0, 3000);

    const sourcePrefix = article.source ? `Noticia de ${article.source}. ` : '';
    const utterance = new SpeechSynthesisUtterance(`${sourcePrefix}${article.title}. ${cleanText}`);
    utteranceRef.current = utterance;
    utterance.lang = 'es-ES';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (isListeningRef.current) {
        playNextArticle(article);
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    const preferredVoice = voices.find(v => v.name === selectedVoiceName);
    if (preferredVoice) utterance.voice = preferredVoice;

    // Play bumper sound before speaking (non-blocking for iOS)
    playNewsBumper().catch(() => {});
    
    // Small delay to let bumper start
    await new Promise(resolve => setTimeout(resolve, 100));

    synth.speak(utterance);
    if (synth.paused) synth.resume();
  };

  const playNextArticle = (current) => {
    const currentIndex = articles.findIndex(a => a.link === current.link);
    if (currentIndex !== -1 && currentIndex < articles.length - 1) {
      // Small delay for natural transition
      setTimeout(() => {
        toggleGlobalSpeech(articles[currentIndex + 1]);
      }, 1000);
    } else {
      isListeningRef.current = false;
      setIsListeningAll(false);
      setCurrentArticle(null);
    }
  };

  useEffect(() => {
    if (activeFeedUrl) {
      loadArticles(activeFeedUrl);
    } else if (activeFeedUrl === '') {
      // Si volvemos a "Todos" sin ser por el botón de escuchar
      if (!isListeningAll) {
        fetchAllArticles();
      }
    }
    
    // Cancelar escucha global si cambiamos a un feed específico
    if (activeFeedUrl && isListeningRef.current) {
      window.speechSynthesis.cancel();
      isListeningRef.current = false;
      setIsListeningAll(false);
    }
  }, [activeFeedUrl]);

  const fetchAllArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all feeds in parallel instead of sequentially
      const feedPromises = feeds.map(async (feed) => {
        try {
          const data = await fetchRSS(feed.url);
          // Attach source name to each article
          const itemsWithSource = data.items.map(item => ({
            ...item,
            source: feed.name
          }));
          return { success: true, items: itemsWithSource, feedName: feed.name };
        } catch (err) {
          console.error(`Error cargando ${feed.name}:`, err);
          return { success: false, feedName: feed.name };
        }
      });

      // Wait for all feeds to complete (whether success or failure)
      const results = await Promise.allSettled(feedPromises);
      
      // Collect successful feeds
      const feedResults = results
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .map(result => result.value.items);

      console.log(`Feeds cargados exitosamente: ${feedResults.length} de ${feeds.length}`);

      // Interleave articles using Round-Robin
      const interleaved = [];
      let hasMore = true;
      let index = 0;

      while (hasMore) {
        hasMore = false;
        for (const items of feedResults) {
          if (index < items.length) {
            interleaved.push(items[index]);
            hasMore = true;
          }
        }
        index++;
      }

      setArticles(interleaved);
      
      // Show warning if some feeds failed
      if (feedResults.length < feeds.length) {
        console.warn(`Solo se pudieron cargar ${feedResults.length} de ${feeds.length} fuentes`);
      }
    } catch (err) {
      setError('Error al cargar todas las noticias.');
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async (url) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRSS(url);
      setArticles(data.items);
    } catch (err) {
      setError('No se pudo cargar el feed. Verifica la URL o intenta más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const addFeed = async (e) => {
    e.preventDefault();
    if (!newFeedUrl) return;
    
    setLoading(true);
    try {
      const data = await fetchRSS(newFeedUrl);
      const newFeed = { name: data.title || 'Nuevo Feed', url: newFeedUrl };
      setFeeds([...feeds, newFeed]);
      setActiveFeedUrl(newFeedUrl);
      setNewFeedUrl('');
      setShowAddFeed(false);
    } catch (err) {
      setError('URL de RSS inválida o inaccesible.');
    } finally {
      setLoading(false);
    }
  };

  const removeFeed = (url) => {
    const updated = feeds.filter(f => f.url !== url);
    setFeeds(updated);
    if (activeFeedUrl === url && updated.length > 0) {
      setActiveFeedUrl(updated[0].url);
    } else if (updated.length === 0) {
      setActiveFeedUrl('');
      setArticles([]);
    }
  };

  const [isListeningAll, setIsListeningAll] = useState(false);

  const toggleListenAll = () => {
    if (isListeningAll) {
      window.speechSynthesis.cancel();
      isListeningRef.current = false;
      setIsListeningAll(false);
      setCurrentArticle(null);
      setIsSpeaking(false);
    } else if (articles.length > 0) {
      isListeningRef.current = true;
      setIsListeningAll(true);
      toggleGlobalSpeech(articles[0]);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header glass">
        <div className="header-content">
          <div className="logo">
            <Newspaper className="logo-icon" size={28} />
            <h1>NotiVoz</h1>
          </div>
          <div className="header-actions">
            {voices.length > 0 && (
              <select 
                className="voice-select glass"
                value={selectedVoiceName}
                onChange={(e) => setSelectedVoiceName(e.target.value)}
              >
                {voices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            )}
            <button 
              className={`listen-all-btn ${isListeningAll ? 'listening' : ''}`}
              onClick={toggleListenAll}
              title={isListeningAll ? "Detener reproducción" : "Escuchar todas las noticias"}
            >
              {isListeningAll ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            <button 
              className="add-btn" 
              onClick={() => setShowAddFeed(!showAddFeed)}
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Add Feed Form */}
        <AnimatePresence>
          {showAddFeed && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="add-feed-form glass"
            >
              <form onSubmit={addFeed}>
                <input 
                  type="url" 
                  placeholder="Pega la URL del RSS aquí..." 
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  required
                />
                <button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Añadir'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feed Selector */}
        <div className="feed-selector">
          <div 
            className={`feed-tab ${activeFeedUrl === '' ? 'active' : ''}`}
          >
            <button 
              className="feed-tab-btn"
              onClick={() => setActiveFeedUrl('')}
            >
              Todos
            </button>
          </div>
          {feeds.map((feed) => (
            <div 
              key={feed.url} 
              className={`feed-tab ${activeFeedUrl === feed.url ? 'active' : ''}`}
            >
              <button 
                className="feed-tab-btn"
                onClick={() => setActiveFeedUrl(feed.url)}
              >
                {feed.name}
              </button>
              <button 
                className="remove-feed-btn"
                onClick={() => removeFeed(feed.url)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Article List */}
        <div className="article-list">
          {loading && (
            <div className="status-container">
              <Loader2 className="animate-spin" size={40} />
              <p>Cargando noticias...</p>
            </div>
          )}

          {error && (
            <div className="status-container error">
              <AlertCircle size={40} />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && articles.map((article, idx) => (
            <ArticleCard 
              key={idx} 
              article={article} 
              onPlay={() => toggleGlobalSpeech(article)}
              isPlaying={currentArticle?.link === article.link && isSpeaking}
            />
          ))}

          {!loading && !error && articles.length === 0 && (
            <div className="status-container">
              <Rss size={40} />
              <p>No hay noticias para mostrar. Añade un feed para comenzar.</p>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .app-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          padding-top: calc(var(--safe-area-top) + 20px);
        }
        .header {
          position: sticky;
          top: 20px;
          z-index: 100;
          padding: 16px 20px;
          margin-bottom: 30px;
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-icon {
          color: var(--primary);
        }
        .logo h1 {
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .add-btn {
          background: var(--primary);
          border: none;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .add-btn:active {
          transform: scale(0.9);
        }
        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .listen-all-btn {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          width: 44px;
          height: 44px;
          border-radius: 14px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .listen-all-btn.listening {
          background: #ff4444;
          border-color: #ff4444;
          animation: pulse 2s infinite;
        }
        .voice-select {
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--glass-border);
          color: white;
          padding: 8px 12px;
          border-radius: 12px;
          font-family: inherit;
          max-width: 150px;
          font-size: 0.8rem;
          outline: none;
        }
        .voice-select option {
          background: var(--bg-dark);
          color: white;
        }
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
        }
        .add-feed-form {
          margin-bottom: 24px;
          padding: 12px;
        }
        .add-feed-form form {
          display: flex;
          gap: 10px;
        }
        .add-feed-form input {
          flex: 1;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--glass-border);
          padding: 12px 16px;
          border-radius: 12px;
          color: white;
          font-family: inherit;
        }
        .add-feed-form button {
          background: white;
          color: black;
          border: none;
          padding: 0 20px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .feed-selector {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 20px;
          margin-bottom: 10px;
          scrollbar-width: none;
        }
        .feed-selector::-webkit-scrollbar {
          display: none;
        }
        .feed-tab {
          display: flex;
          align-items: center;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          white-space: nowrap;
          padding-right: 4px;
        }
        .feed-tab.active {
          background: var(--primary);
          border-color: var(--primary);
        }
        .feed-tab-btn {
          background: none;
          border: none;
          color: white;
          padding: 10px 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .remove-feed-btn {
          background: rgba(0,0,0,0.2);
          border: none;
          color: rgba(255,255,255,0.5);
          width: 24px;
          height: 24px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .remove-feed-btn:hover {
          color: #ff4444;
        }
        .article-list {
          display: flex;
          flex-direction: column;
        }
        .status-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 20px;
          color: var(--text-muted);
          text-align: center;
        }
        .error {
          color: #ff4444;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
