import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';

const AudioPlayer = ({ text, title }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
    } else {
      // Clear any pending speech to avoid queue locks especially on iOS
      synth.cancel();
      setIsLoading(true);

      const cleanText = text.substring(0, 3000); // Limit length for stability
      const utterance = new SpeechSynthesisUtterance(`${title}. ${cleanText}`);
      utteranceRef.current = utterance;

      utterance.onstart = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsLoading(false);
      };

      utterance.onerror = (event) => {
        console.error('SpeechSynthesis error', event);
        setIsSpeaking(false);
        setIsLoading(false);
      };

      // Set voice and language
      utterance.lang = 'es-ES'; // Default to Spanish as requested by user context
      
      const voices = synth.getVoices();
      // Try to find a Spanish voice, otherwise English, otherwise default
      const preferredVoice = voices.find(v => v.lang.startsWith('es')) || 
                             voices.find(v => v.lang.startsWith('en'));
      
      if (preferredVoice) utterance.voice = preferredVoice;

      // Crucial for iOS: The actual speak call must be immediate
      synth.speak(utterance);
      
      // On some versions of iOS, if the queue is empty, we might need a small jumpstart
      if (synth.paused) {
        synth.resume();
      }
    }
  };

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        toggleSpeak();
      }}
      className={`audio-btn glass ${isSpeaking ? 'active' : ''}`}
      disabled={isLoading}
      title={isSpeaking ? "Detener" : "Escuchar"}
    >
      {isLoading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : isSpeaking ? (
        <VolumeX size={20} />
      ) : (
        <Volume2 size={20} />
      )}
      <span>{isLoading ? 'Preparando...' : isSpeaking ? 'Detener' : 'Escuchar'}</span>

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
