import Parser from 'rss-parser';

const parser = new Parser();
const PROXY_URL = 'https://api.allorigins.win/get?url=';

export const fetchRSS = async (url) => {
 
  try {
    
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    const feed = await parser.parseString(data.contents);
    
    return {
      title: feed.title || 'Sin título',
      items: feed.items.map(item => ({
        title: item.title || 'Sin título',
        link: item.link || '',
        pubDate: item.pubDate || '',
        contentSnippet: item.contentSnippet || item.content || ''
      }))
    };
  } catch (error) {
    console.error('Error fetching RSS:', error);
    throw error;
  }
};
