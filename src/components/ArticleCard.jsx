import React from 'react';
import { ExternalLink, Calendar } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

const ArticleCard = ({ article }) => {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Clean text from HTML tags for TTS and snippet
  const cleanSnippet = article.contentSnippet || article.content || '';
  const textForTTS = cleanSnippet.replace(/<[^>]*>?/gm, '');

  return (
    <div className="article-card glass fade-in">
      <div className="article-header">
        <span className="date">
          <Calendar size={14} />
          {formatDate(article.pubDate)}
        </span>
        <a href={article.link} target="_blank" rel="noopener noreferrer" className="link-icon">
          <ExternalLink size={18} />
        </a>
      </div>
      
      <h3 className="title">{article.title}</h3>
      <p className="description">{textForTTS.substring(0, 150)}...</p>
      
      <div className="article-footer">
        <AudioPlayer title={article.title} text={textForTTS} />
      </div>

      <style jsx>{`
        .article-card {
          padding: 24px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .article-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
        }
        .article-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .date {
          font-size: 0.8rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .link-icon {
          color: var(--text-muted);
          transition: color 0.3s;
        }
        .link-icon:hover {
          color: var(--primary);
        }
        .title {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 12px;
          line-height: 1.4;
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .description {
          font-size: 1rem;
          color: var(--text-muted);
          line-height: 1.6;
          margin-bottom: 16px;
        }
        .article-footer {
          margin-top: auto;
        }
      `}</style>
    </div>
  );
};

export default ArticleCard;
