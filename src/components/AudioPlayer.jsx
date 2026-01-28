import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

const AudioPlayer = ({ text, title }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [synth, setSynth] = useState(null);

  useEffect(() => {
    setSynth(window.speechSynthesis);
    return () => {
      if (synth) synth.cancel();
    };
  }, []);

  const toggleSpeak = () => {
    if (!synth) return;

    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(`${title}. ${text}`);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      // Try to find a good voice
      const voices = synth.getVoices();
      const preferredVoice = 
        voices.find(v => v.name === 'Google español') ||
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('es')) ||
        voices.find(v => v.lang.includes('es-ES')) ||
        voices.find(v => v.lang.includes('es')) ||
        voices.find(v => v.lang.includes('en'));
        
      if (preferredVoice) utterance.voice = preferredVoice;

      synth.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        toggleSpeak();
      }}
      className="audio-btn glass"
      title={isSpeaking ? "Detener" : "Escuchar"}
    >
      {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
      <span>{isSpeaking ? 'Detener' : 'Escuchar'}</span>

      <style jsx>{`
        .audio-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: none;
          color: white;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          transition: all 0.3s ease;
          margin-top: 12px;
        }
        .audio-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(1.05);
        }
        .audio-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </button>
  );
};

export default AudioPlayer;
