import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Rss, Newspaper, AlertCircle, Loader2, Trash2, Volume2, VolumeX } from 'lucide-react';
import { fetchRSS } from './services/rssService';
import ArticleCard from './components/ArticleCard';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_FEEDS = [ 
  { name: 'Clarin', url: 'https://www.clarin.com/rss/lo-ultimo/'},
  { name: 'Ole', url: 'http://www.ole.com.ar/rss/ultimas-noticias/' },
  { name: 'Perfil', url: 'https://www.perfil.com/feed' },
  { name: 'IProfesional', url: 'https://www.iprofesional.com/rss/home' },
 
];

function App() {
  const [feeds, setFeeds] = useState(DEFAULT_FEEDS);
  const [activeFeedUrl, setActiveFeedUrl] = useState(feeds[0]?.url || '');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [isListeningAll, setIsListeningAll] = useState(false);
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListeningAll;
  }, [isListeningAll]);

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
    if (activeFeedUrl && isListeningAll) {
      window.speechSynthesis.cancel();
      setIsListeningAll(false);
    }
  }, [activeFeedUrl]);

  const fetchAllArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const allArticles = [];
      for (const feed of feeds) {
        try {
          const data = await fetchRSS(feed.url);
          allArticles.push(...data.items);
        } catch (err) {
          console.error(`Error checking ${feed.name}:`, err);
        }
      }
      setArticles(allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)));
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

  const playNewsBumper = () => {
    return new Promise((resolve) => {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playNote = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      playNote(600, now, 0.1);
      playNote(600, now + 0.15, 0.1);
      playNote(800, now + 0.3, 0.5);

      setTimeout(() => {
        audioCtx.close();
        resolve();
      }, 800);
    });
  };

  const handleListenAll = () => {
    if (isListeningAll) {
      window.speechSynthesis.cancel();
      setIsListeningAll(false);
      return;
    }

    if (articles.length === 0) return;

    setIsListeningAll(true);
    isListeningRef.current = true;
    
    let currentIndex = 0;
    const speakNext = async () => {
      if (currentIndex >= articles.length || !window.speechSynthesis || !isListeningRef.current) {
        setIsListeningAll(false);
        return;
      }

      // Tocar sonido de noticiero antes de cada artículo
      await playNewsBumper();
      
      if (!isListeningRef.current) return;

      const article = articles[currentIndex];
      const utterance = new SpeechSynthesisUtterance(`${article.title}. ${article.contentSnippet || ''}`);
          const voices = window.speechSynthesis.getVoices();
      // Priorizar voces de alta calidad (Google o Naturales) y en español
      const preferredVoice = 
        voices.find(v => v.name === 'Google español') ||
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('es')) ||
        voices.find(v => v.lang.includes('es-ES')) ||
        voices.find(v => v.lang.includes('es')) ||
        voices.find(v => v.lang.includes('en'));
        
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => {
        if (isListeningRef.current) {
          currentIndex++;
          speakNext();
        }
      };

      utterance.onerror = () => {
        setIsListeningAll(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header glass">
        <div className="header-content">
          <div className="logo">
            <Newspaper className="logo-icon" size={28} />
            <h1>RSS Reader</h1>
          </div>
          <div className="header-actions">
            <button 
              className={`listen-all-btn ${isListeningAll ? 'listening' : ''}`}
              onClick={handleListenAll}
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
            <ArticleCard key={idx} article={article} />
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
